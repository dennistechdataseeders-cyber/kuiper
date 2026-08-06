// backend/scripts/create-github-repos-for-existing-projects.js
const mongoose = require('mongoose');
const { Octokit } = require('@octokit/rest');
const Project = require('./models/Project');
const Feed = require('./models/Feed');
const gitService = require('./services/gitService');
require('dotenv').config();

// ============================================
// PROJECT CONFIGURATION - Match your KUIPER projects
// ============================================
const PROJECTS_CONFIG = [
    {
        projectId: 'TDS0018-ECOM | MU | Backend Response Catalog',
        feeds: ['Shopee Multiple Region', 'TikTok Multiple Region', 'Lazada Coupon']
    },
    {
        projectId: 'TDS0019-AUTO | AE | PRH Portal Automation',
        feeds: ['PRH Automation Script']
    }
];

// ============================================
// MAIN SCRIPT
// ============================================

async function createGitHubReposForExistingProjects() {
    console.log('🚀 CREATING GITHUB REPOS FOR EXISTING KUIPER PROJECTS');
    console.log('═'.repeat(70));

    // 1. Check GitHub configuration
    console.log('\n📋 1. CHECKING GITHUB CONFIGURATION...');
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;

    if (!token || !owner) {
        console.error('❌ GitHub not configured. Please set GITHUB_TOKEN and GITHUB_OWNER in .env');
        process.exit(1);
    }

    console.log(`   ✅ GitHub configured for: ${owner}`);
    console.log(`   📊 Token: ${token.substring(0, 4)}...${token.substring(token.length - 4)}`);

    // 2. Connect to MongoDB
    console.log('\n📊 2. CONNECTING TO MONGODB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('   ✅ Connected to MongoDB');

    // 3. Initialize Octokit
    console.log('\n🔑 3. INITIALIZING GITHUB API...');
    const octokit = new Octokit({ auth: token });

    try {
        const user = await octokit.users.getAuthenticated();
        console.log(`   ✅ Authenticated as: ${user.data.login}`);
    } catch (error) {
        console.error(`   ❌ GitHub authentication failed: ${error.message}`);
        process.exit(1);
    }

    // 4. Process each project
    console.log('\n📁 4. PROCESSING PROJECTS...');
    console.log('═'.repeat(70));

    const results = {
        created: [],
        skipped: [],
        errors: []
    };

    for (const config of PROJECTS_CONFIG) {
        try {
            console.log(`\n📦 PROCESSING: ${config.projectId}`);
            console.log('─'.repeat(50));

            // 4a. Find the project in KUIPER
            const project = await Project.findOne({ 
                projectCustomId: config.projectId 
            });

            if (!project) {
                console.log(`   ❌ Project not found in KUIPER: ${config.projectId}`);
                results.errors.push({
                    project: config.projectId,
                    error: 'Project not found in KUIPER'
                });
                continue;
            }

            console.log(`   ✅ Found project in KUIPER:`);
            console.log(`      ID: ${project._id}`);
            console.log(`      Name: ${project.name}`);

            // 4b. Check if project already has a GitHub repo
            if (project.gitRepoName && project.gitRepoUrl) {
                console.log(`   ⏭️  Project already has GitHub repo:`);
                console.log(`      Repo: ${project.gitRepoName}`);
                console.log(`      URL: ${project.gitRepoUrl}`);
                
                // Still create feed folders if missing
                await createFeedFolders(project, config.feeds, octokit);
                
                results.skipped.push({
                    project: config.projectId,
                    reason: 'GitHub repo already exists',
                    repoUrl: project.gitRepoUrl
                });
                continue;
            }

            // 4c. Generate repository name
            const repoName = generateRepoName(config.projectId);
            console.log(`   📡 Creating GitHub repository: ${repoName}`);

            // 4d. Create GitHub repository
            let gitRepo = null;
            try {
                gitRepo = await gitService.createRepository(
                    config.projectId,
                    project.description || `Project: ${config.projectId}`,
                    [] // No developers assigned initially
                );

                if (gitRepo && gitRepo.success) {
                    console.log(`   ✅ Repository created successfully`);
                    console.log(`      URL: ${gitRepo.repoUrl}`);
                    console.log(`      Clone URL: ${gitRepo.cloneUrl}`);
                    console.log(`      Invite Link: ${gitRepo.inviteLink}`);

                    // 4e. Update project with GitHub info
                    project.gitRepoUrl = gitRepo.repoUrl;
                    project.gitRepoName = gitRepo.repoName;
                    await project.save();
                    console.log(`   💾 Updated project with GitHub info`);

                    // 4f. Create feed folders
                    await createFeedFolders(project, config.feeds, octokit);

                    results.created.push({
                        project: config.projectId,
                        repoUrl: gitRepo.repoUrl,
                        repoName: gitRepo.repoName,
                        feeds: config.feeds
                    });

                } else {
                    console.log(`   ❌ Repository creation failed`);
                    console.log(`      Error: ${gitRepo?.error || 'Unknown error'}`);
                    results.errors.push({
                        project: config.projectId,
                        error: gitRepo?.error || 'Repository creation failed'
                    });
                }

            } catch (error) {
                console.log(`   ❌ Repository creation failed: ${error.message}`);
                results.errors.push({
                    project: config.projectId,
                    error: error.message
                });
            }

        } catch (error) {
            console.error(`   ❌ Failed to process ${config.projectId}:`, error.message);
            results.errors.push({
                project: config.projectId,
                error: error.message
            });
        }
    }

    // 5. Summary
    printSummary(results);

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    console.log('✅ Script completed!');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateRepoName(projectId) {
    return projectId
        .toLowerCase()
        .replace(/\s*\|\s*/g, '-')
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

async function createFeedFolders(project, feedNames, octokit) {
    console.log(`   📂 Creating feed folders in GitHub...`);

    if (!project.gitRepoName) {
        console.log(`      ⚠️ No Git repo linked, skipping feed folders`);
        return;
    }

    const repoName = project.gitRepoName;
    let createdCount = 0;

    for (const feedName of feedNames) {
        try {
            // Find the feed in KUIPER
            const feed = await Feed.findOne({
                name: feedName,
                projectId: project._id
            });

            if (!feed) {
                console.log(`      ⚠️ Feed not found in KUIPER: ${feedName}`);
                continue;
            }

            console.log(`      📁 Creating folder for feed: ${feedName}`);

            // Create feed folder on GitHub
            const folderResult = await gitService.createFeedFolder(
                repoName,
                feed.name,
                feed._id,
                feed.assignedDevelopers || []
            );

            if (folderResult && folderResult.success) {
                console.log(`         ✅ Folder created: ${folderResult.feedPath}`);
                createdCount++;
            } else {
                console.log(`         ⚠️ Failed to create folder: ${folderResult?.error || 'Unknown error'}`);
            }

        } catch (error) {
            console.log(`      ❌ Failed to create folder for ${feedName}: ${error.message}`);
        }
    }

    console.log(`   📊 Feed folders created: ${createdCount}/${feedNames.length}`);
}

function printSummary(results) {
    console.log('\n' + '═'.repeat(70));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(70));

    console.log(`\n✅ Repositories Created: ${results.created.length}`);
    console.log(`⏭️  Skipped (Already exist): ${results.skipped.length}`);
    console.log(`❌ Errors: ${results.errors.length}`);

    if (results.created.length > 0) {
        console.log('\n📋 Created Repositories:');
        results.created.forEach(r => {
            console.log(`   📁 ${r.project}`);
            console.log(`      Repo: ${r.repoName}`);
            console.log(`      URL: ${r.repoUrl}`);
            console.log(`      Feeds: ${r.feeds.join(', ')}`);
        });
    }

    if (results.skipped.length > 0) {
        console.log('\n⏭️  Skipped (Already exist):');
        results.skipped.forEach(r => {
            console.log(`   📁 ${r.project}`);
            console.log(`      Repo: ${r.repoUrl}`);
            console.log(`      Reason: ${r.reason}`);
        });
    }

    if (results.errors.length > 0) {
        console.log('\n❌ Errors:');
        results.errors.forEach((err, idx) => {
            console.log(`   ${idx + 1}. ${err.project}: ${err.error}`);
        });
    }

    console.log('\n💡 NEXT STEPS:');
    console.log('   1. Check repositories on GitHub:');
    results.created.forEach(r => {
        console.log(`      ${r.repoUrl}`);
    });
    console.log('   2. Share invite links with developers:');
    results.created.forEach(r => {
        console.log(`      ${r.repoUrl}/invite`);
    });
    console.log('   3. Verify feed folders in each repository');
    console.log('   4. Assign developers to feeds in KUIPER');
}

// ============================================
// RUN THE SCRIPT
// ============================================

createGitHubReposForExistingProjects();

module.exports = {
    createGitHubReposForExistingProjects,
    generateRepoName,
    createFeedFolders
};