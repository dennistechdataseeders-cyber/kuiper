// backend/test-token.js
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

async function testToken() {
  console.log('🔍 Testing GitHub token...');
  console.log(`Token prefix: ${process.env.GITHUB_TOKEN?.substring(0, 10)}...`);
  console.log(`Owner: ${process.env.GITHUB_OWNER}`);

  try {
    const octokit = new Octokit({ 
      auth: process.env.GITHUB_TOKEN,
      userAgent: 'KUIPER-TEST-v1.0'
    });

    // Test 1: Get authenticated user
    const user = await octokit.users.getAuthenticated();
    console.log(`✅ Authenticated as: ${user.data.login}`);
    console.log(`   User ID: ${user.data.id}`);

    // Test 2: List repositories
    const repos = await octokit.repos.listForAuthenticatedUser({
      per_page: 5
    });
    console.log(`✅ Found ${repos.data.length} repositories`);
    repos.data.forEach(repo => {
      console.log(`   - ${repo.name} (${repo.private ? 'private' : 'public'})`);
    });

    // Test 3: Create a test repository (dry run with small name)
    console.log('\n📝 Testing repository creation permission...');
    try {
      const testRepo = await octokit.repos.createForAuthenticatedUser({
        name: `test-repo-${Date.now()}`,
        description: 'Test repository creation',
        private: true,
        auto_init: true
      });
      console.log(`✅ Successfully created test repository: ${testRepo.data.name}`);
      
      // Clean up: delete the test repo
      await octokit.repos.delete({
        owner: process.env.GITHUB_OWNER,
        repo: testRepo.data.name
      });
      console.log(`🗑️ Test repository deleted`);
    } catch (createError) {
      if (createError.status === 401) {
        console.log('❌ Token does not have permission to create repositories');
      } else {
        console.log(`⚠️ Create test failed: ${createError.message}`);
      }
    }

    console.log('\n✅ Token is valid!');
  } catch (error) {
    console.error('❌ Token test failed:');
    if (error.status === 401) {
      console.log('   Token is invalid or expired');
      console.log('   Generate a new token at: https://github.com/settings/tokens');
      console.log('   Make sure to select the "repo" scope');
    } else if (error.status === 403) {
      console.log('   Token does not have required permissions');
      console.log('   Make sure to select the "repo" scope');
    } else {
      console.log(`   ${error.message}`);
    }
  }
}

testToken();