// backend/check-user-github.js
const mongoose = require('mongoose');
require('dotenv').config();

async function checkUserGitHub() {
    console.log('🔍 CHECKING USER GITHUB STATUS');
    console.log('═'.repeat(50));

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const User = require('./models/User');

    // Check Nayan's user
    const user = await User.findOne({ 
        email: 'nayan.techdataseeders@gmail.com' 
    });

    if (!user) {
        console.log('❌ User not found');
        process.exit(1);
    }

    console.log(`👤 User: ${user.name}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔗 GitHub Username: ${user.githubUsername || 'NOT SET'}`);
    console.log(`🔗 GitHub Linked: ${user.githubLinked}`);
    console.log(`🆔 User ID: ${user._id}`);

    console.log('\n' + '═'.repeat(50));
    console.log('\n💡 If GitHub username is not set, you need to:');
    console.log('   1. Find the developer\'s GitHub username');
    console.log('   2. Update it in the database or via Admin panel');
    console.log('\n   To update via MongoDB:');
    console.log(`   db.users.updateOne(`);
    console.log(`     { email: 'nayan.techdataseeders@gmail.com' },`);
    console.log(`     { $set: { githubUsername: 'ACTUAL_USERNAME', githubLinked: true } }`);
    console.log(`   )`);

    process.exit(0);
}

checkUserGitHub().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});