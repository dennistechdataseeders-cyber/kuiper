require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function checkDeveloperGitHub() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const developers = await User.find({ role: 'Developer' });
    console.log(`📋 Found ${developers.length} developers\n`);
    console.log('='.repeat(60));
    
    for (const dev of developers) {
      console.log(`\n👤 ${dev.name}`);
      console.log(`   Email: ${dev.email}`);
      console.log(`   GitHub Linked: ${dev.githubLinked ? '✅ Yes' : '❌ No'}`);
      console.log(`   GitHub Username: ${dev.githubUsername || 'Not set'}`);
      console.log(`   Role: ${dev.role}`);
    }
    
    console.log('\n' + '='.repeat(60));
    const linkedCount = developers.filter(d => d.githubLinked).length;
    console.log(`\n📊 Summary: ${linkedCount}/${developers.length} developers have GitHub linked`);
    
    process.exit();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDeveloperGitHub();