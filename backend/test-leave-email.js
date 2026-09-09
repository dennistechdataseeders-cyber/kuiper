// backend/test-leave-email.js
const mongoose = require('mongoose');
require('dotenv').config();
const sendEmail = require('./services/zohoMailer');

async function testLeaveEmail() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');
        
        const User = require('./models/User');
        
        // Get an HR user
        const hrUser = await User.findOne({ role: 'HR', isActive: true });
        
        if (!hrUser) {
            console.log('❌ No HR user found!');
            console.log('   Please create an HR user first.');
            process.exit(1);
        }
        
        console.log(`👤 Found HR user: ${hrUser.name} (${hrUser.email})`);
        
        // Test email
        const testHtml = `
            <h1>Test Leave Notification</h1>
            <p>This is a test email for leave notifications.</p>
            <p>HR User: ${hrUser.name}</p>
            <p>Time: ${new Date().toISOString()}</p>
        `;
        
        console.log(`📧 Sending test email to: ${hrUser.email}`);
        
        const result = await sendEmail({
            to: hrUser.email,
            subject: 'TEST: Leave Notification - Please Ignore',
            html: testHtml
        });
        
        console.log('✅ Test email sent successfully!');
        console.log('   Message ID:', result.messageId || 'N/A');
        
        await mongoose.disconnect();
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('   Stack:', error.stack);
    }
}

testLeaveEmail();