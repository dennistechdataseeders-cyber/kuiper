// backend/controllers/holidayController.js
const Holiday = require('../models/Holiday');
const User = require('../models/User');
const Log = require('../models/Log');

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
// CREATE HOLIDAY
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
        
        res.status(201).json({
            success: true,
            message: 'Holiday created successfully',
            data: populatedHoliday
        });
        
    } catch (error) {
        console.error('Error creating holiday:', error);
        res.status(500).json({ error: 'Failed to create holiday' });
    }
};

// ============================================
// UPDATE HOLIDAY
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
        
        res.json({
            success: true,
            message: 'Holiday updated successfully',
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