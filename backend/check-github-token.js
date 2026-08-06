// backend/check-github-token.js
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

async function checkGitHubToken() {
    console.log('🔍 CHECKING GITHUB TOKEN STATUS');
    console.log('═'.repeat(50));

    // Read token from .env
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;

    if (!token) {
        console.log('❌ GITHUB_TOKEN not found in .env file');
        console.log('   Please add GITHUB_TOKEN to your .env file');
        process.exit(1);
    }

    if (!owner) {
        console.log('❌ GITHUB_OWNER not found in .env file');
        console.log('   Please add GITHUB_OWNER to your .env file');
        process.exit(1);
    }

    console.log(`📋 Configuration:`);
    console.log(`   Token: ${token.substring(0, 4)}...${token.substring(token.length - 4)}`);
    console.log(`   Token length: ${token.length} characters`);
    console.log(`   Owner: ${owner}`);
    console.log('═'.repeat(50));

    // Check if token has the correct format
    if (!token.startsWith('ghp_') && !token.startsWith('gho_') && !token.startsWith('github_pat_')) {
        console.log('⚠️ Warning: Token format may be incorrect.');
        console.log('   Token should start with "ghp_", "gho_", or "github_pat_"');
        console.log(`   Current prefix: ${token.substring(0, 4)}`);
    }

    // Initialize Octokit
    let octokit;
    try {
        octokit = new Octokit({ 
            auth: token,
            userAgent: 'KUIPER-Token-Check-v1.0'
        });
        console.log('✅ Octokit initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize Octokit:', error.message);
        process.exit(1);
    }

    console.log('\n📡 Testing token with GitHub API...');

    try {
        // Test 1: Get authenticated user info
        console.log('\n📡 Test 1: Getting authenticated user info...');
        const userResponse = await octokit.users.getAuthenticated();
        console.log(`   ✅ Token is VALID`);
        console.log(`   👤 Authenticated as: ${userResponse.data.login}`);
        console.log(`   📧 Email: ${userResponse.data.email || 'Not public'}`);
        console.log(`   📅 Account created: ${new Date(userResponse.data.created_at).toLocaleDateString()}`);
        console.log(`   📊 Public repos: ${userResponse.data.public_repos}`);
        console.log(`   👥 Followers: ${userResponse.data.followers}`);

        // Test 2: Rate limit check
        console.log('\n📡 Test 2: Checking rate limits...');
        const rateResponse = await octokit.rateLimit.get();
        const rate = rateResponse.data.rate;
        console.log(`   📊 Rate Limit:`);
        console.log(`      Total: ${rate.limit}`);
        console.log(`      Remaining: ${rate.remaining}`);
        console.log(`      Used: ${rate.used}`);
        console.log(`      Reset time: ${new Date(rate.reset * 1000).toLocaleString()}`);
        console.log(`      Reset in: ${Math.floor((rate.reset * 1000 - Date.now()) / 60000)} minutes`);

        if (rate.remaining < 50) {
            console.log(`   ⚠️ Rate limit is low (${rate.remaining} remaining). Consider waiting or using a token with higher limits.`);
        } else {
            console.log(`   ✅ Rate limit is healthy (${rate.remaining} remaining).`);
        }

        // Test 3: Check token scopes
        console.log('\n📡 Test 3: Checking token scopes...');
        try {
            // Try to list repos (requires repo scope)
            const repoResponse = await octokit.repos.listForAuthenticatedUser({
                per_page: 1,
                sort: 'updated'
            });
            
            // Check if we got a response with repos
            if (repoResponse.data && Array.isArray(repoResponse.data)) {
                console.log(`   ✅ Token has repo access (found ${repoResponse.data.length} repos)`);
            }
        } catch (scopeError) {
            if (scopeError.status === 404) {
                console.log(`   ⚠️ Token may not have repo access (404 error)`);
            } else if (scopeError.status === 401) {
                console.log(`   ❌ Token is invalid or expired (401 Unauthorized)`);
            } else {
                console.log(`   ⚠️ Scope check returned: ${scopeError.status} - ${scopeError.message}`);
            }
        }

        // Test 4: Check if token can access the owner's repos
        if (owner) {
            console.log(`\n📡 Test 4: Checking access to ${owner}'s repositories...`);
            try {
                const ownerRepos = await octokit.repos.listForUser({
                    username: owner,
                    per_page: 1
                });
                console.log(`   ✅ Can access ${owner}'s repositories (found ${ownerRepos.data.length})`);
            } catch (ownerError) {
                if (ownerError.status === 404) {
                    console.log(`   ❌ User "${owner}" not found or token cannot access`);
                } else if (ownerError.status === 401) {
                    console.log(`   ❌ Token is invalid (401 Unauthorized)`);
                } else {
                    console.log(`   ⚠️ Error checking owner: ${ownerError.status} - ${ownerError.message}`);
                }
            }
        }

        // Test 5: Check token expiration (for PATs)
        if (token.startsWith('github_pat_')) {
            console.log('\n📡 Test 5: Checking PAT expiration...');
            try {
                // PATs don't expire unless revoked, but we can check if it's working
                console.log('   ℹ️ GitHub Personal Access Tokens (PATs) don\'t expire automatically.');
                console.log('   They can only be revoked manually by the user or organization admin.');
            } catch (expError) {
                console.log(`   ⚠️ Could not check expiration: ${expError.message}`);
            }
        } else {
            console.log('\n📡 Test 5: Token type check...');
            if (token.startsWith('ghp_')) {
                console.log('   ℹ️ This is a classic Personal Access Token (ghp_).');
                console.log('   Classic PATs don\'t expire unless revoked.');
                console.log('   For better security, consider using a fine-grained PAT (github_pat_).');
            } else if (token.startsWith('gho_')) {
                console.log('   ℹ️ This is a GitHub OAuth token.');
                console.log('   OAuth tokens can expire based on the OAuth app configuration.');
            }
        }

        // Summary
        console.log('\n' + '═'.repeat(50));
        console.log('📋 SUMMARY:');
        console.log(`   ✅ Token Status: VALID`);
        console.log(`   👤 User: ${userResponse.data.login}`);
        console.log(`   📊 Rate Limit: ${rate.remaining}/${rate.limit} remaining`);
        console.log(`   ⏰ Reset in: ${Math.floor((rate.reset * 1000 - Date.now()) / 60000)} minutes`);

        const isRateLimitLow = rate.remaining < 50;
        if (isRateLimitLow) {
            console.log(`   ⚠️ Rate limit is low. Consider using a token with higher limits or wait for reset.`);
        } else {
            console.log(`   ✅ All systems normal. Token is working correctly.`);
        }

        console.log('\n💡 Recommendations:');
        if (rate.remaining < 50) {
            console.log('   • Wait for rate limit reset (or use a higher-rate token)');
        }
        if (!token.startsWith('github_pat_') && !token.startsWith('gho_')) {
            console.log('   • Consider creating a fine-grained PAT (github_pat_) with specific permissions');
        }
        console.log('   • Keep your token secure and never commit it to version control');
        console.log('   • For best results, use a token with repo, admin:repo_hook, and user permissions');

    } catch (error) {
        console.error('\n❌ TOKEN CHECK FAILED:');
        console.error(`   Error: ${error.message}`);
        
        if (error.status === 401) {
            console.log('   ❌ Token is INVALID or EXPIRED');
            console.log('   💡 Solution: Generate a new token at https://github.com/settings/tokens');
            console.log('      Required scopes: repo, admin:repo_hook, user');
        } else if (error.status === 403) {
            console.log('   ❌ Token is VALID but rate limit exceeded or insufficient permissions');
            console.log('   💡 Solution: Wait for rate limit reset or check token permissions');
        } else if (error.status === 404) {
            console.log('   ⚠️ Token may be valid but user not found');
            console.log('   💡 Check if GITHUB_OWNER is correct in .env');
        } else {
            console.log(`   ⚠️ Unexpected error (${error.status || 'unknown'})`);
        }

        if (error.response) {
            console.log(`   📥 Response status: ${error.response.status}`);
            console.log(`   📥 Response data:`, JSON.stringify(error.response.data, null, 2));
        }

        process.exit(1);
    }
}

// Run the check
checkGitHubToken();