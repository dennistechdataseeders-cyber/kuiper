// backend/cron/holidayReminder.js
// Sends holiday reminder announcements and emails at 6 PM IST the day before a holiday

const cron = require('node-cron');
const mongoose = require('mongoose');
const Holiday = require('../models/Holiday');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const sendEmail = require('../services/zohoMailer');

/**
 * Format date for display in announcements and emails
 */
function formatDateDisplay(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

/**
 * Check if a date is a holiday
 */
async function checkHoliday(date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    
    const holiday = await Holiday.findOne({
        date: { $gte: start, $lte: end }
    });
    return holiday;
}

/**
 * Get IST date string for today and tomorrow
 */
function getISTDateStrings() {
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    // Today's date
    const todayStr = istNow.toISOString().split('T')[0];
    
    // Tomorrow's date
    const tomorrow = new Date(istNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    return { todayStr, tomorrowStr, istNow };
}

/**
 * Create holiday announcement
 */
async function createHolidayAnnouncement(holiday) {
    const holidayName = holiday.name || 'Holiday';
    const holidayDate = formatDateDisplay(holiday.date);
    const isOptional = holiday.isOptional ? ' (Optional Holiday)' : '';
    
    const title = `📢 Holiday Tomorrow: ${holidayName}${isOptional}`;
    const description = `Dear Team,\n\nThis is to inform you that tomorrow (${holidayDate}) is observed as ${holidayName}${isOptional}.\n\nPlease plan your work accordingly. Enjoy the day off!\n\n---\nThis is an automated reminder from KUIPER HRMS.`;
    
    const announcement = new Announcement({
        title: title,
        description: description,
        image: null,
        createdBy: null, // System generated
        createdByName: 'KUIPER HRMS',
        createdByRole: 'System',
        createdByAvatar: null,
        isAutomated: true,
        automatedType: 'holiday_reminder',
        automatedUserId: null,
        likes: [],
        comments: [],
        viewedBy: []
    });
    
    await announcement.save();
    return announcement;
}

/**
 * Send holiday reminder emails to all employees (except Client, Admin, Super Admin, HR)
 */
async function sendHolidayReminderEmails(holiday, announcement) {
    const holidayName = holiday.name || 'Holiday';
    const holidayDate = formatDateDisplay(holiday.date);
    const isOptional = holiday.isOptional ? ' (Optional Holiday)' : '';
    
    // Get all active employees EXCLUDING: Client, Admin, Super Admin, HR
    const employees = await User.find({
        isActive: true,
        role: { $nin: ['Client', 'Admin', 'Super Admin', 'HR'] }
    }).select('name email role');
    
    if (employees.length === 0) {
        console.log('⚠️ No employees found to send holiday reminder emails');
        return 0;
    }
    
    console.log(`📧 Sending holiday reminder emails to ${employees.length} employees`);
    
    const frontendUrl = process.env.FRONTEND_URL || 'https://kuiperapp.co.in';
    const announcementUrl = `${frontendUrl}/announcements`;
    
    // Email template - FIXED: No moment.js usage
    const emailHtml = (employeeName) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
  </style>
</head>
<body style="margin:0; padding:0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f0f4f8; color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8; padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="550" cellpadding="0" cellspacing="0" border="0" style="max-width:550px; width:100%; background:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding:32px 36px; border-bottom:1px solid #e2e8f0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-right:12px; width:38px; vertical-align: middle;">
                    <img src="https://res.cloudinary.com/dhcwcyqke/image/upload/q_auto/f_auto/v1777631279/login_img_oycuic.png" alt="KUIPER" style="width:38px; height:38px; border-radius:10px; display:block;">
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size:20px; font-weight:800; color:#2563eb;">KUIPER</div>
                    <div style="font-size:8px; font-weight:600; color:#94a3b8; letter-spacing:0.25em; text-transform:uppercase; margin-top:3px;">HRMS • Holiday Reminder</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #7c3aed, #6d28d9); padding:28px 36px;">
              <div style="font-size:24px; font-weight:800; color:white; margin-bottom:4px;">📢 Holiday Tomorrow</div>
              <div style="font-size:14px; color:#c4b5fd; font-weight:500;">${holidayName}${isOptional}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="font-size:15px; margin:0 0 20px 0; line-height:1.6; color:#1e293b;">Dear <strong>${employeeName}</strong>,</p>
              
              <p style="font-size:14px; color:#475569; margin-bottom:24px; line-height:1.7;">
                This is to inform you that <strong>tomorrow (${holidayDate})</strong> is observed as <strong>${holidayName}</strong>${isOptional}.
              </p>
              
              <!-- Holiday Details -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; border-collapse: separate; margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:14px 18px; border-bottom:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Holiday</div>
                    <div style="font-size:15px; font-weight:800; color:#7c3aed; margin-top:2px;">${holidayName}</div>
                  </td>
                  <td width="50%" style="padding:14px 18px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Date</div>
                    <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:2px;">${holidayDate}</div>
                  </td>
                </tr>
                ${holiday.isOptional ? `
                <tr>
                  <td colspan="2" style="padding:14px 18px;">
                    <div style="font-size:10px; font-weight:700; color:#7c3aed; text-transform:uppercase; letter-spacing:0.05em;">Type</div>
                    <div style="font-size:14px; font-weight:700; color:#7c3aed; margin-top:2px;">Optional Holiday</div>
                  </td>
                </tr>
                ` : ''}
                ${holiday.description ? `
                <tr>
                  <td colspan="2" style="padding:14px 18px;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Description</div>
                    <div style="font-size:13px; color:#475569; margin-top:2px;">${holiday.description}</div>
                  </td>
                </tr>
                ` : ''}
              </table>

              <!-- Action Button -->
              <a href="${announcementUrl}" style="display:block; text-align:center; background:#7c3aed; color:white; text-decoration:none; padding:14px; border-radius:12px; font-weight:700; font-size:13px;">
                View Announcements →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc; padding:24px 36px; text-align:center; border-radius:0 0 24px 24px;">
              <div style="font-size:10px; color:#94a3b8;">KUIPER HRMS • Automated Holiday Reminder</div>
              <div style="font-size:8px; color:#cbd5e1; margin-top:2px;">Please do not reply to this email</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    
    let sentCount = 0;
    let failedCount = 0;
    
    // Send emails with a small delay between each to avoid rate limiting
    for (const employee of employees) {
        try {
            const html = emailHtml(employee.name);
            await sendEmail({
                to: employee.email,
                subject: `📢 Holiday Tomorrow: ${holidayName}${isOptional}`,
                html: html
            });
            sentCount++;
            console.log(`📧 Holiday reminder email sent to: ${employee.email} (${employee.role})`);
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (emailError) {
            failedCount++;
            console.error(`❌ Failed to send holiday reminder email to ${employee.email}:`, emailError.message);
        }
    }
    
    console.log(`📧 Holiday reminder emails: ${sentCount} sent, ${failedCount} failed`);
    return sentCount;
}

/**
 * Create notifications for all employees (except Client, Admin, Super Admin, HR)
 */
async function createHolidayNotifications(holiday, announcement) {
    const holidayName = holiday.name || 'Holiday';
    const holidayDate = formatDateDisplay(holiday.date);
    
    // Get all active employees EXCLUDING: Client, Admin, Super Admin, HR
    const employees = await User.find({
        isActive: true,
        role: { $nin: ['Client', 'Admin', 'Super Admin', 'HR'] }
    }).select('_id name');
    
    if (employees.length === 0) {
        console.log('⚠️ No employees found to create notifications');
        return 0;
    }
    
    let notificationCount = 0;
    
    for (const employee of employees) {
        try {
            // Add notification to user's unreadNotifications array
            const user = await User.findById(employee._id);
            if (!user) continue;
            
            if (!user.unreadNotifications) {
                user.unreadNotifications = [];
            }
            
            // Check if notification already exists to avoid duplicates
            const exists = user.unreadNotifications.some(
                n => n.type === 'new_announcement' && 
                     n.announcementId && 
                     n.announcementId && 
                     n.announcementId.toString() === announcement._id.toString()
            );
            
            if (exists) continue;
            
            user.unreadNotifications.push({
                type: 'new_announcement',
                announcementId: announcement._id,
                message: `📢 Holiday Tomorrow: ${holidayName} on ${holidayDate}`,
                createdAt: new Date(),
                read: false
            });
            
            user.notificationCount = (user.notificationCount || 0) + 1;
            await user.save();
            notificationCount++;
            
            // Emit socket notification
            const io = global.io;
            if (io) {
                io.to(employee._id.toString()).emit('new_announcement', {
                    announcementId: announcement._id,
                    title: `📢 Holiday Tomorrow: ${holidayName}`,
                    createdByName: 'KUIPER HRMS',
                    createdAt: announcement.createdAt
                });
            }
        } catch (err) {
            console.error(`❌ Failed to create notification for ${employee.name}:`, err.message);
        }
    }
    
    console.log(`📢 Created notifications for ${notificationCount} employees`);
    return notificationCount;
}

/**
 * Main function to check for holidays and send reminders
 */
async function sendHolidayReminders() {
    console.log('⏰ Running holiday reminder check...');
    const startTime = Date.now();
    
    try {
        // Check if mongoose is connected
        if (mongoose.connection.readyState !== 1) {
            console.log('⚠️ Database not connected, skipping holiday reminder');
            return;
        }
        
        const { todayStr, tomorrowStr, istNow } = getISTDateStrings();
        
        console.log(`📅 Today (IST): ${todayStr}`);
        console.log(`📅 Tomorrow (IST): ${tomorrowStr}`);
        
        // Check if tomorrow is a holiday
        const holiday = await checkHoliday(tomorrowStr);
        
        if (!holiday) {
            console.log('ℹ️ No holiday found for tomorrow. No reminders needed.');
            return;
        }
        
        console.log(`🎉 Found holiday for tomorrow: ${holiday.name} (${tomorrowStr})`);
        
        // Check if we already sent a reminder for this holiday today
        const existingAnnouncement = await Announcement.findOne({
            isAutomated: true,
            automatedType: 'holiday_reminder',
            'description': { $regex: `tomorrow.*${holiday.name}`, $options: 'i' },
            createdAt: {
                $gte: new Date(todayStr + 'T00:00:00.000Z'),
                $lt: new Date(todayStr + 'T23:59:59.999Z')
            }
        });
        
        if (existingAnnouncement) {
            console.log(`ℹ️ Holiday reminder for ${holiday.name} already sent today. Skipping.`);
            return;
        }
        
        // Step 1: Create announcement
        console.log('📝 Creating holiday announcement...');
        const announcement = await createHolidayAnnouncement(holiday);
        console.log(`✅ Announcement created: ${announcement._id}`);
        
        // Step 2: Send emails
        console.log('📧 Sending holiday reminder emails...');
        const emailCount = await sendHolidayReminderEmails(holiday, announcement);
        console.log(`✅ Emails sent to ${emailCount} employees`);
        
        // Step 3: Create in-app notifications
        console.log('🔔 Creating in-app notifications...');
        const notificationCount = await createHolidayNotifications(holiday, announcement);
        console.log(`✅ Notifications created for ${notificationCount} employees`);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Holiday reminder process completed in ${duration}s`);
        console.log(`   📢 Announcement: ${announcement.title}`);
        console.log(`   📧 Emails sent: ${emailCount}`);
        console.log(`   🔔 Notifications: ${notificationCount}`);
        
    } catch (error) {
        console.error('❌ Holiday reminder check failed:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}

// =========================================================
// SCHEDULE: Run at 6:00 PM IST every day
// =========================================================
cron.schedule('45 18 * * *', async () => {
    console.log('⏰ Running scheduled holiday reminder check (6:25 PM IST)...');
    await sendHolidayReminders();
}, {
    timezone: "Asia/Kolkata"
});

// Also run once on startup to catch any missed holidays
setTimeout(() => {
    console.log('🚀 Running initial holiday reminder check on startup...');
    sendHolidayReminders();
}, 60000); // Wait 60 seconds for database connection

console.log('⏰ Holiday reminder cron job scheduled (daily at 6:25 PM IST)');

module.exports = { sendHolidayReminders };