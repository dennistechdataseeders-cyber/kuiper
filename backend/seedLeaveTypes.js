// backend/seedLeaveTypes.js
const mongoose = require('mongoose');
require('dotenv').config();
const LeaveType = require('./models/LeaveType');

const defaultLeaveTypes = [
    { 
        name: 'Casual', 
        code: 'CL', 
        maxDays: 12, 
        isActive: true, 
        requiresApproval: true,
        description: 'General purpose casual leave'
    },
    { 
        name: 'Sick', 
        code: 'SL', 
        maxDays: 4, 
        isActive: true, 
        requiresApproval: true,
        description: 'Medical and health-related leave'
    },
    { 
        name: 'Vacation', 
        code: 'VL', 
        maxDays: 2, 
        isActive: true, 
        requiresApproval: true,
        description: 'Planned vacation and travel leave'
    }
];

async function seedLeaveTypes() {
    try {
        if (!process.env.MONGO_URI) {
            console.error('❌ MONGO_URI is not defined in .env file');
            process.exit(1);
        }
        
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');
        
        // Clear existing leave types
        const deleted = await LeaveType.deleteMany({});
        console.log(`🗑️ Cleared ${deleted.deletedCount} existing leave types`);
        
        // Insert default leave types
        const inserted = await LeaveType.insertMany(defaultLeaveTypes);
        console.log(`✅ Seeded ${inserted.length} leave types:`);
        console.log('\n📋 Leave Types Configuration:');
        console.log('═'.repeat(50));
        
        let totalPaid = 0;
        inserted.forEach(lt => {
            console.log(`  📌 ${lt.name} (${lt.code})`);
            console.log(`     Max Days: ${lt.maxDays} days`);
            console.log(`     Status: ${lt.isActive ? '✅ Active' : '❌ Inactive'}`);
            console.log(`     Approval Required: ${lt.requiresApproval ? 'Yes' : 'No'}`);
            console.log(`     ${lt.description}`);
            console.log('');
            totalPaid += lt.maxDays;
        });
        
        console.log('═'.repeat(50));
        console.log(`📊 Total Paid Leave Quota: ${totalPaid} days/year`);
        console.log(`   (Casual: 12 + Sick: 4 + Vacation: 2 = 18 days)`);
        console.log(`   Monthly Accrual: ${(totalPaid / 12).toFixed(1)} days/month`);
        console.log('');
        console.log('📌 Notes:');
        console.log('   - Leave balances reset annually');
        console.log('   - All leave types require HR approval');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error seeding leave types:', err.message);
        if (err.stack) console.error(err.stack);
        process.exit(1);
    }
}

// Run the seed function
seedLeaveTypes();