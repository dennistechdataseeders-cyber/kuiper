const https = require('https');

/**
 * Search for GitHub user by email address
 * @param {string} email - Email address to search for
 * @param {string} token - GitHub Personal Access Token (optional but recommended)
 * @returns {Promise<object>} - User information or null if not found
 */
async function getGitHubUserByEmail(email, token = null) {
    // Validate email
    if (!email || typeof email !== 'string') {
        throw new Error('Please provide a valid email address');
    }

    // Method 1: Search users API with email query
    // Note: This only finds users who have made their email public on GitHub
    const searchUrl = `https://api.github.com/search/users?q=${encodeURIComponent(email)}+in:email`;
    
    const options = {
        headers: {
            'User-Agent': 'Node.js-Script',
            'Accept': 'application/vnd.github.v3+json'
        }
    };

    if (token) {
        options.headers['Authorization'] = `token ${token}`;
    }

    try {
        const searchResult = await makeRequest(searchUrl, options);
        
        if (searchResult.total_count > 0 && searchResult.items.length > 0) {
            // Get detailed user information
            const username = searchResult.items[0].login;
            const userDetails = await getUserDetails(username, token);
            return userDetails;
        }
        
        return null;
    } catch (error) {
        console.error('Error searching for user:', error.message);
        return null;
    }
}

/**
 * Get detailed user information by username
 * @param {string} username - GitHub username
 * @param {string} token - GitHub Personal Access Token
 * @returns {Promise<object>} - User details
 */
async function getUserDetails(username, token = null) {
    const url = `https://api.github.com/users/${username}`;
    
    const options = {
        headers: {
            'User-Agent': 'Node.js-Script',
            'Accept': 'application/vnd.github.v3+json'
        }
    };

    if (token) {
        options.headers['Authorization'] = `token ${token}`;
    }

    const userData = await makeRequest(url, options);
    
    return {
        username: userData.login,
        name: userData.name || null,
        email: userData.email || null,
        bio: userData.bio || null,
        company: userData.company || null,
        location: userData.location || null,
        public_repos: userData.public_repos,
        followers: userData.followers,
        following: userData.following,
        created_at: userData.created_at,
        updated_at: userData.updated_at,
        profile_url: userData.html_url,
        avatar_url: userData.avatar_url
    };
}

/**
 * Make HTTPS request
 * @param {string} url - Request URL
 * @param {object} options - Request options
 * @returns {Promise<object>} - Parsed JSON response
 */
function makeRequest(url, options) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, options, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                if (response.statusCode === 200) {
                    try {
                        const parsedData = JSON.parse(data);
                        resolve(parsedData);
                    } catch (error) {
                        reject(new Error('Failed to parse JSON response'));
                    }
                } else if (response.statusCode === 403) {
                    reject(new Error('API rate limit exceeded. Please provide a GitHub token or try again later.'));
                } else if (response.statusCode === 404) {
                    resolve(null);
                } else {
                    reject(new Error(`HTTP ${response.statusCode}: ${data}`));
                }
            });
        });
        
        request.on('error', (error) => {
            reject(error);
        });
        
        request.end();
    });
}

/**
 * Alternative method: Search through user's public events/commits
 * This can find users who have email in their commit history
 * @param {string} username - GitHub username
 * @param {string} targetEmail - Email to search for
 * @param {string} token - GitHub Personal Access Token
 * @returns {Promise<boolean>} - Whether email found in user's events
 */
async function searchEmailInUserEvents(username, targetEmail, token = null) {
    const url = `https://api.github.com/users/${username}/events/public`;
    
    const options = {
        headers: {
            'User-Agent': 'Node.js-Script',
            'Accept': 'application/vnd.github.v3+json'
        }
    };

    if (token) {
        options.headers['Authorization'] = `token ${token}`;
    }

    try {
        const events = await makeRequest(url, options);
        
        for (const event of events) {
            if (event.type === 'PushEvent' && event.payload.commits) {
                for (const commit of event.payload.commits) {
                    if (commit.author && commit.author.email === targetEmail) {
                        return true;
                    }
                }
            }
        }
        return false;
    } catch (error) {
        console.error(`Error checking events for ${username}:`, error.message);
        return false;
    }
}

/**
 * Main function to find GitHub username by email
 * @param {string} email - Email address to search
 * @param {string} token - GitHub Personal Access Token (optional)
 */
async function findGitHubUserByEmail(email, token = null) {
    console.log(`🔍 Searching for GitHub user with email: ${email}\n`);
    
    const userInfo = await getGitHubUserByEmail(email, token);
    
    if (userInfo && userInfo.username) {
        console.log('✅ User found!\n');
        console.log('📋 User Information:');
        console.log('─'.repeat(50));
        console.log(`Username:    ${userInfo.username}`);
        console.log(`Name:        ${userInfo.name || 'Not provided'}`);
        console.log(`Public Email:${userInfo.email || 'Not public'}`);
        console.log(`Bio:         ${userInfo.bio || 'Not provided'}`);
        console.log(`Company:     ${userInfo.company || 'Not provided'}`);
        console.log(`Location:    ${userInfo.location || 'Not provided'}`);
        console.log(`Repos:       ${userInfo.public_repos}`);
        console.log(`Followers:   ${userInfo.followers}`);
        console.log(`Following:   ${userInfo.following}`);
        console.log(`Profile:     ${userInfo.profile_url}`);
        console.log('─'.repeat(50));
        
        return userInfo;
    } else {
        console.log('❌ No user found with that email address in GitHub\'s public database.');
        console.log('\n💡 Notes:');
        console.log('• The email must be set as "Public" on the user\'s GitHub profile');
        console.log('• Using a GitHub token increases rate limits (5000/hr vs 60/hr)');
        console.log('• Some users may have their email hidden in commits');
        return null;
    }
}

// Example usage with the provided email
const targetEmail = 'dennislalwani952003@gmail.com';

// Optional: Add your GitHub Personal Access Token to increase rate limit
// Get one from: https://github.com/settings/tokens
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;

// Run the search
findGitHubUserByEmail(targetEmail, GITHUB_TOKEN)
    .then(result => {
        if (result && result.username) {
            console.log(`\n🎯 Found username: ${result.username}`);
        }
    })
    .catch(error => {
        console.error('An error occurred:', error);
    });

// Export functions for use in other modules
module.exports = {
    getGitHubUserByEmail,
    getUserDetails,
    searchEmailInUserEvents,
    findGitHubUserByEmail
};