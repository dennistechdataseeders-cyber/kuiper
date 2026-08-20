// backend/cron/announcementAutomation.js
const cron = require('node-cron');
const mongoose = require('mongoose');
const Announcement = require('../models/Announcement');
const User = require('../models/User');

/**
 * Check for birthdays and work anniversaries and create automated posts
 * Runs daily at 9:00 AM IST
 */
async function createAutomatedAnnouncements() {
    console.log('🎉 Running automated announcement check...');
    const startTime = Date.now();

    try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayMonth = today.getMonth() + 1;
        const todayDay = today.getDate();

        // Get all active users (excluding clients)
        const users = await User.find({
            isActive: true,
            role: { $ne: 'Client' }
        });

        console.log(`👤 Checking ${users.length} users for birthdays and anniversaries`);

        let createdCount = 0;

        for (const user of users) {
            // ============================================
            // CHECK BIRTHDAY
            // ============================================
            if (user.dateOfBirth) {
                const birthDate = new Date(user.dateOfBirth);
                const birthMonth = birthDate.getMonth() + 1;
                const birthDay = birthDate.getDate();

                if (birthMonth === todayMonth && birthDay === todayDay) {
                    // Check if automated post already exists for today
                    const existingBirthday = await Announcement.findOne({
                        isAutomated: true,
                        automatedType: 'birthday',
                        automatedUserId: user._id,
                        createdAt: {
                            $gte: new Date(todayStr),
                            $lt: new Date(todayStr + 'T23:59:59.999Z')
                        }
                    });

                    if (!existingBirthday) {
                        // Create birthday announcement
                        const announcement = new Announcement({
                            title: `🎉 Happy Birthday, ${user.name}!`,
                            description: `Wishing you a fantastic birthday filled with joy and success! 🎂🎈`,
                            image: null,
                            createdBy: user._id,
                            createdByName: 'System',
                            createdByRole: 'System',
                            createdByAvatar: null,
                            isAutomated: true,
                            automatedType: 'birthday',
                            automatedUserId: user._id,
                            likes: [],
                            comments: []
                        });

                        await announcement.save();
                        createdCount++;
                        console.log(`🎂 Birthday announcement created for: ${user.name}`);
                    }
                }
            }

            // ============================================
            // CHECK WORK ANNIVERSARY
            // ============================================
            if (user.dateOfJoining) {
                const joinDate = new Date(user.dateOfJoining);
                const joinMonth = joinDate.getMonth() + 1;
                const joinDay = joinDate.getDate();

                if (joinMonth === todayMonth && joinDay === todayDay) {
                    // Calculate years
                    const years = today.getFullYear() - joinDate.getFullYear();
                    
                    // Check if automated post already exists for today
                    const existingAnniversary = await Announcement.findOne({
                        isAutomated: true,
                        automatedType: 'work_anniversary',
                        automatedUserId: user._id,
                        createdAt: {
                            $gte: new Date(todayStr),
                            $lt: new Date(todayStr + 'T23:59:59.999Z')
                        }
                    });

                    if (!existingAnniversary) {
                        const yearText = years === 1 ? '1st' : 
                                       years === 2 ? '2nd' : 
                                       years === 3 ? '3rd' : 
                                       `${years}th`;
                        
                        // Create work anniversary announcement
                        const announcement = new Announcement({
                            title: `🎊 Happy ${yearText} Work Anniversary, ${user.name}!`,
                            description: `Congratulations on completing ${years} years with us! Thank you for your dedication and hard work. 🎉👏`,
                            image: null,
                            createdBy: user._id,
                            createdByName: 'System',
                            createdByRole: 'System',
                            createdByAvatar: null,
                            isAutomated: true,
                            automatedType: 'work_anniversary',
                            automatedUserId: user._id,
                            likes: [],
                            comments: []
                        });

                        await announcement.save();
                        createdCount++;
                        console.log(`🎊 Work anniversary announcement created for: ${user.name} (${years} years)`);
                    }
                }
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Automated announcements check complete: ${createdCount} new posts created in ${duration}s`);

    } catch (error) {
        console.error('❌ Automated announcement check failed:', error.message);
    }
}

// Schedule to run daily at 9:00 AM IST
cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Running scheduled automated announcement check...');
    await createAutomatedAnnouncements();
}, {
    timezone: "Asia/Kolkata"
});

// Also run once on startup after 30 seconds
setTimeout(() => {
    console.log('🚀 Running initial automated announcement check...');
    createAutomatedAnnouncements();
}, 30000);

console.log('⏰ Automated announcement cron job scheduled (daily at 9:00 AM IST)');

module.exports = { createAutomatedAnnouncements };