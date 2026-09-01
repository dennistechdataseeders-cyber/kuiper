// backend/controllers/holidayController.js
const Holiday = require('../models/Holiday');
const User = require('../models/User');
const Log = require('../models/Log');
const sendEmail = require('../services/zohoMailer');
const { getHolidayCreatedTemplate } = require('../templates/holidayEmailTemplates');

// ============================================
// GET ALL HOLIDAYS
// ============================================
exports.getHolidays = async (req, res) => {
    try {
        const { year, month } = req.query;
        let filter = {};
        
        if (year && month) {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0, 23, 59, 59, 999);
            filter.date = { $gte: start, $lte: end };
        } else if (year) {
            const start = new Date(year, 0, 1);
            const end = new Date(year, 11, 31, 23, 59, 59, 999);
            filter.date = { $gte: start, $lte: end };
        }
        
        const holidays = await Holiday.find(filter)
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email')
            .sort({ date: 1 });
        
        res.json({
            success: true,
            data: holidays
        });
    } catch (error) {
        console.error('Error fetching holidays:', error);
        res.status(500).json({ error: 'Failed to fetch holidays' });
    }
};

// ============================================
// GET HOLIDAY BY ID
// ============================================
exports.getHolidayById = async (req, res) => {
    try {
        const holiday = await Holiday.findById(req.params.id)
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email');
        
        if (!holiday) {
            return res.status(404).json({ error: 'Holiday not found' });
        }
        
        res.json({
            success: true,
            data: holiday
        });
    } catch (error) {
        console.error('Error fetching holiday:', error);
        res.status(500).json({ error: 'Failed to fetch holiday' });
    }
};

// ============================================
// CREATE HOLIDAY - WITH EMAIL NOTIFICATIONS
// ============================================
exports.createHoliday = async (req, res) => {
    try {
        const { date, name, description, isOptional } = req.body;
        
        if (!date || !name) {
            return res.status(400).json({ error: 'Date and Holiday name are required' });
        }
        
        // Check if holiday already exists on this date
        const existing = await Holiday.findOne({
            date: new Date(date)
        });
        
        if (existing) {
            return res.status(400).json({ 
                error: 'A holiday already exists on this date',
                existing: existing
            });
        }
        
        const holiday = new Holiday({
            date: new Date(date),
            name: name.trim(),
            description: description || '',
            isOptional: isOptional || false,
            createdBy: req.user._id
        });
        
        await holiday.save();
        
        // Log the action
        await Log.create({
            actionType: 'HOLIDAY_CREATED',
            performerId: req.user._id,
            details: `Created holiday: ${name} on ${new Date(date).toLocaleDateString()}`,
            timestamp: new Date()
        });
        
        const populatedHoliday = await Holiday.findById(holiday._id)
            .populate('createdBy', 'name email');
        
        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.emit('holiday_updated', {
                action: 'created',
                holiday: populatedHoliday
            });
        }

        // ============================================
        // SEND HOLIDAY NOTIFICATION EMAILS
        // ============================================
        try {
            // Get all active users except Admins (they already know)
            const users = await User.find({ 
                isActive: true,
                role: { $nin: ['Admin', 'Super Admin'] }
            }).select('email name role');
            
            console.log(`📧 Sending holiday notification to ${users.length} employees`);

            const frontendUrl = process.env.FRONTEND_URL || 'https://kuiperapp.co.in';
            
            // Create email content once to reuse
            const emailHtml = getHolidayCreatedTemplate({
                name: holiday.name,
                date: holiday.date,
                description: holiday.description,
                isOptional: holiday.isOptional,
                frontendUrl: frontendUrl
            });

            // Send emails in batches to avoid overwhelming the email service
            const batchSize = 20;
            const emailPromises = [];
            
            for (let i = 0; i < users.length; i += batchSize) {
                const batch = users.slice(i, i + batchSize);
                const batchPromises = batch.map(async (user) => {
                    try {
                        await sendEmail({
                            to: user.email,
                            subject: `🎉 New Holiday: ${holiday.name} (${new Date(holiday.date).toLocaleDateString()})`,
                            html: emailHtml
                        });
                        console.log(`✅ Holiday email sent to: ${user.email}`);
                    } catch (emailError) {
                        console.error(`❌ Failed to send holiday email to ${user.email}:`, emailError.message);
                    }
                });
                
                // Wait for current batch to complete before starting next
                await Promise.all(batchPromises);
                
                // Small delay between batches to avoid rate limiting
                if (i + batchSize < users.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            console.log(`📧 Holiday notification emails sent to ${users.length} employees`);

        } catch (emailError) {
            console.error('Holiday email notification failed:', emailError.message);
            // Don't fail the request if emails fail - the holiday is already created
        }
        
        res.status(201).json({
            success: true,
            message: 'Holiday created successfully and notifications sent',
            data: populatedHoliday
        });
        
    } catch (error) {
        console.error('Error creating holiday:', error);
        res.status(500).json({ error: 'Failed to create holiday' });
    }
};

// ============================================
// UPDATE HOLIDAY - WITH EMAIL NOTIFICATIONS
// ============================================
exports.updateHoliday = async (req, res) => {
    try {
        const { date, name, description, isOptional } = req.body;
        const holiday = await Holiday.findById(req.params.id);
        
        if (!holiday) {
            return res.status(404).json({ error: 'Holiday not found' });
        }
        
        // Check if another holiday exists on this date
        if (date) {
            const existing = await Holiday.findOne({
                date: new Date(date),
                _id: { $ne: req.params.id }
            });
            
            if (existing) {
                return res.status(400).json({ 
                    error: 'Another holiday already exists on this date',
                    existing: existing
                });
            }
        }
        
        // Store old values for notification
        const oldName = holiday.name;
        const oldDate = holiday.date;
        const oldIsOptional = holiday.isOptional;
        const oldDescription = holiday.description;
        
        const updates = {};
        if (date) updates.date = new Date(date);
        if (name) updates.name = name.trim();
        if (description !== undefined) updates.description = description;
        if (isOptional !== undefined) updates.isOptional = isOptional;
        updates.updatedBy = req.user._id;
        updates.updatedAt = new Date();
        
        const updatedHoliday = await Holiday.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        ).populate('createdBy', 'name email')
         .populate('updatedBy', 'name email');
        
        // Log the action
        await Log.create({
            actionType: 'HOLIDAY_UPDATED',
            performerId: req.user._id,
            details: `Updated holiday: ${updatedHoliday.name} on ${updatedHoliday.date.toLocaleDateString()}`,
            timestamp: new Date()
        });
        
        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.emit('holiday_updated', {
                action: 'updated',
                holiday: updatedHoliday
            });
        }

        // ============================================
        // SEND HOLIDAY UPDATE NOTIFICATION EMAILS
        // ============================================
        try {
            // Only send update notifications if significant changes were made
            const hasSignificantChanges = 
                oldName !== updatedHoliday.name ||
                oldDate.getTime() !== updatedHoliday.date.getTime() ||
                oldIsOptional !== updatedHoliday.isOptional ||
                (oldDescription || '') !== (updatedHoliday.description || '');

            if (hasSignificantChanges) {
                // Get all active users except Admins
                const users = await User.find({ 
                    isActive: true,
                    role: { $nin: ['Admin', 'Super Admin'] }
                }).select('email name role');
                
                console.log(`📧 Sending holiday update notification to ${users.length} employees`);

                const frontendUrl = process.env.FRONTEND_URL || 'https://kuiperapp.co.in';
                
                // Create a different template for updates
                const emailHtml = getHolidayUpdatedTemplate({
                    oldName: oldName,
                    newName: updatedHoliday.name,
                    oldDate: oldDate,
                    newDate: updatedHoliday.date,
                    oldIsOptional: oldIsOptional,
                    newIsOptional: updatedHoliday.isOptional,
                    oldDescription: oldDescription,
                    newDescription: updatedHoliday.description,
                    frontendUrl: frontendUrl
                });

                // Send emails in batches
                const batchSize = 20;
                for (let i = 0; i < users.length; i += batchSize) {
                    const batch = users.slice(i, i + batchSize);
                    const batchPromises = batch.map(async (user) => {
                        try {
                            await sendEmail({
                                to: user.email,
                                subject: `📝 Holiday Updated: ${updatedHoliday.name} (${new Date(updatedHoliday.date).toLocaleDateString()})`,
                                html: emailHtml
                            });
                        } catch (emailError) {
                            console.error(`Failed to send holiday update email to ${user.email}:`, emailError.message);
                        }
                    });
                    await Promise.all(batchPromises);
                    if (i + batchSize < users.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

                console.log(`📧 Holiday update emails sent to ${users.length} employees`);
            }

        } catch (emailError) {
            console.error('Holiday update email notification failed:', emailError.message);
            // Don't fail the request if emails fail
        }
        
        res.json({
            success: true,
            message: 'Holiday updated successfully and notifications sent',
            data: updatedHoliday
        });
        
    } catch (error) {
        console.error('Error updating holiday:', error);
        res.status(500).json({ error: 'Failed to update holiday' });
    }
};

// ============================================
// DELETE HOLIDAY
// ============================================
exports.deleteHoliday = async (req, res) => {
    try {
        const holiday = await Holiday.findById(req.params.id);
        
        if (!holiday) {
            return res.status(404).json({ error: 'Holiday not found' });
        }
        
        const holidayName = holiday.name;
        const holidayDate = holiday.date.toLocaleDateString();
        
        await Holiday.findByIdAndDelete(req.params.id);
        
        // Log the action
        await Log.create({
            actionType: 'HOLIDAY_DELETED',
            performerId: req.user._id,
            details: `Deleted holiday: ${holidayName} on ${holidayDate}`,
            timestamp: new Date()
        });
        
        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.emit('holiday_updated', {
                action: 'deleted',
                holidayId: req.params.id
            });
        }

        // ============================================
        // SEND HOLIDAY DELETION NOTIFICATION EMAILS
        // ============================================
        try {
            // Get all active users except Admins
            const users = await User.find({ 
                isActive: true,
                role: { $nin: ['Admin', 'Super Admin'] }
            }).select('email name role');
            
            console.log(`📧 Sending holiday deletion notification to ${users.length} employees`);

            const frontendUrl = process.env.FRONTEND_URL || 'https://kuiperapp.co.in';
            
            const emailHtml = getHolidayDeletedTemplate({
                name: holidayName,
                date: holidayDate,
                frontendUrl: frontendUrl
            });

            // Send emails in batches
            const batchSize = 20;
            for (let i = 0; i < users.length; i += batchSize) {
                const batch = users.slice(i, i + batchSize);
                const batchPromises = batch.map(async (user) => {
                    try {
                        await sendEmail({
                            to: user.email,
                            subject: `🗑️ Holiday Removed: ${holidayName} (${holidayDate})`,
                            html: emailHtml
                        });
                    } catch (emailError) {
                        console.error(`Failed to send holiday deletion email to ${user.email}:`, emailError.message);
                    }
                });
                await Promise.all(batchPromises);
                if (i + batchSize < users.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            console.log(`📧 Holiday deletion emails sent to ${users.length} employees`);

        } catch (emailError) {
            console.error('Holiday deletion email notification failed:', emailError.message);
            // Don't fail the request if emails fail
        }
        
        res.json({
            success: true,
            message: 'Holiday deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting holiday:', error);
        res.status(500).json({ error: 'Failed to delete holiday' });
    }
};

// ============================================
// GET UPCOMING HOLIDAYS
// ============================================
exports.getUpcomingHolidays = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const holidays = await Holiday.find({
            date: { $gte: today }
        })
        .sort({ date: 1 })
        .limit(parseInt(limit));
        
        res.json({
            success: true,
            data: holidays
        });
    } catch (error) {
        console.error('Error fetching upcoming holidays:', error);
        res.status(500).json({ error: 'Failed to fetch upcoming holidays' });
    }
};

// ============================================
// CHECK IF DATE IS HOLIDAY
// ============================================
exports.checkHoliday = async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }
        
        const isHoliday = await Holiday.isHoliday(new Date(date));
        
        if (isHoliday) {
            const holiday = await Holiday.findOne({
                date: {
                    $gte: new Date(date).setHours(0, 0, 0, 0),
                    $lte: new Date(date).setHours(23, 59, 59, 999)
                }
            });
            return res.json({
                success: true,
                isHoliday: true,
                holiday: holiday
            });
        }
        
        res.json({
            success: true,
            isHoliday: false
        });
    } catch (error) {
        console.error('Error checking holiday:', error);
        res.status(500).json({ error: 'Failed to check holiday' });
    }
};