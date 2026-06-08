require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Project = require('./models/Project');
const gitService = require('./services/gitService');

async function sendTestInvite() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get the developer
    const developer = await User.findOne({ 
      email: 'dennislalwani952003@gmail.com',
      role: 'Developer' 
    });
    
    if (!developer) {
      console.error('❌ Developer not found');
      process.exit(1);
    }
    
    console.log(`👤 Developer: ${developer.name}`);
    console.log(`   GitHub Username: ${developer.githubUsername}`);
    console.log(`   GitHub Linked: ${developer.githubLinked}\n`);
    
    // Get the first project with a GitHub repo
    const project = await Project.findOne({ 
      gitRepoName: { $ne: null, $exists: true } 
    });
    
    if (!project) {
      console.log('❌ No projects with GitHub repos found.');
      console.log('\n💡 Create a project first:');
      console.log('   1. Go to Project Management');
      console.log('   2. Create a new project');
      console.log('   3. Add at least one feed with this developer assigned');
      console.log('   4. Run this script again\n');
      process.exit(1);
    }
    
    console.log(`📁 Project: ${project.projectCustomId}`);
    console.log(`   Repo Name: ${project.gitRepoName}`);
    console.log(`   Repo URL: ${project.gitRepoUrl}\n`);
    
    console.log('📧 Sending GitHub invitation...');
    
    const result = await gitService.addCollaboratorById(
      project.gitRepoName, 
      developer._id,
      'push'
    );
    
    if (result.success) {
      console.log('\n✅ INVITATION SENT SUCCESSFULLY!');
      console.log(`\n📧 The developer (${developer.email}) should receive an email from GitHub (noreply@github.com)`);
      console.log(`🔗 They can also accept here: https://github.com/${process.env.GITHUB_OWNER}/${project.gitRepoName}/invitations`);
    } else {
      console.log(`\n❌ Invitation failed: ${result.error}`);
      if (result.inviteLink) {
        console.log(`\n🔗 Share this invite link with the developer: ${result.inviteLink}`);
      }
      
      // Try alternative method - direct invite link
      console.log('\n💡 Alternative method:');
      const inviteLink = `https://github.com/${process.env.GITHUB_OWNER}/${project.gitRepoName}/invite`;
      console.log(`   Share this link: ${inviteLink}`);
      
      // Also try to send email with the link
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: 'smtp.zoho.in',
        port: 465,
        secure: true,
        auth: {
          user: process.env.ZOHO_EMAIL,
          pass: process.env.ZOHO_APP_PASSWORD,
        },
      });
      
      try {
        await transporter.sendMail({
          from: `"KUIPER" <${process.env.ZOHO_EMAIL}>`,
          to: developer.email,
          subject: `GitHub Repository Access: ${project.gitRepoName}`,
          html: `
            <h3>GitHub Repository Invitation</h3>
            <p>You've been added to project: <strong>${project.projectCustomId}</strong></p>
            <p>Click the link below to accept the GitHub invitation:</p>
            <a href="${inviteLink}" style="display: inline-block; padding: 10px 20px; background-color: #0366d6; color: white; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
            <p>Or copy this link: ${inviteLink}</p>
            <br/>
            <p>Make sure you're logged into GitHub with username: <strong>${developer.githubUsername}</strong></p>
          `
        });
        console.log(`\n📧 Also sent an email with the invite link to ${developer.email}`);
      } catch (emailError) {
        console.log(`\n⚠️ Could not send email: ${emailError.message}`);
      }
    }
    
    process.exit();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

sendTestInvite();