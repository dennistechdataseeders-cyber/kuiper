const { Octokit } = require('@octokit/rest');
const User = require('../models/User');

class GitService {
  constructor() {
    this.token = process.env.GITHUB_TOKEN;
    this.owner = process.env.GITHUB_OWNER;
    this.octokit = null;
    
    if (this.token && this.owner && this.token.startsWith('ghp_')) {
      this.octokit = new Octokit({ 
        auth: this.token,
        userAgent: 'KUIPER-CRM-v1.0'  
      });
      console.log('✅ GitHub service initialized for:', this.owner);
    } else {
      console.warn('⚠️ GitHub token missing or invalid. Git features disabled.');
    }
  }

  // Clean description - remove special characters
  cleanDescription(description) {
    if (!description) return '';
    let cleaned = description.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    cleaned = cleaned.replace(/[^\x20-\x7E]/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.trim().substring(0, 300);
    return cleaned || 'Project repository created from KUIPER CRM';
  }

  // Get GitHub username from email using GitHub search API
  // NOTE: Only works if the developer has set their email to PUBLIC on GitHub
// Get GitHub username from email using GitHub search API
async getUsernameFromEmail(email) {
  if (!this.octokit || !email) return null;
  
  try {
    // First try: Search by email
    const response = await this.octokit.search.users({
      q: `${email} in:email`,
      per_page: 1
    });
    
    if (response.data.total_count > 0 && response.data.items[0]) {
      const username = response.data.items[0].login;
      console.log(`✅ Resolved GitHub username for ${email}: ${username}`);
      return username;
    }

    // Second try: Search by username (if email contains a common username pattern)
    const emailUsername = email.split('@')[0];
    if (emailUsername && emailUsername.length > 3) {
      console.log(`Attempting to find GitHub user by username: ${emailUsername}`);
      try {
        const userResponse = await this.octokit.users.getByUsername({
          username: emailUsername
        });
        
        if (userResponse && userResponse.data) {
          console.log(`✅ Found potential GitHub user: ${userResponse.data.login}`);
          return userResponse.data.login;
        }
      } catch (userErr) {
        // User not found by username, continue
      }
    }

    console.warn(`⚠️ No public GitHub account found for email: ${email}. User may have a private email or no GitHub account.`);
    return null;
  } catch (error) {
    console.log(`Could not find GitHub user for email: ${email}`, error.message);
    return null;
  }
}

  // Get detailed GitHub user info including profile URL
  async getDetailedGitHubUser(email) {
  if (!this.octokit || !email) return null;
  
  try {
    // Try 1: Search by email (only works if user's email is PUBLIC on GitHub)
    const response = await this.octokit.search.users({
      q: `${email} in:email`,
      per_page: 1
    });
    
    if (response.data.total_count > 0 && response.data.items[0]) {
      const username = response.data.items[0].login;
      const userDetails = await this.octokit.users.getByUsername({ username });
      return {
        username,
        profile_url: userDetails.data.html_url,
        avatar_url: userDetails.data.avatar_url,
        name: userDetails.data.name,
        public_repos: userDetails.data.public_repos,
        followers: userDetails.data.followers
      };
    }

    // ✅ NEW Try 2: Fallback — try email prefix as GitHub username
    // Handles the very common case where email is private on GitHub
    const emailUsername = email.split('@')[0];
    if (emailUsername && emailUsername.length > 2) {
      console.log(`⚠️ Email search found nothing. Trying username fallback: ${emailUsername}`);
      try {
        const userDetails = await this.octokit.users.getByUsername({
          username: emailUsername
        });
        if (userDetails && userDetails.data) {
          console.log(`✅ Found GitHub user by username fallback: ${userDetails.data.login}`);
          return {
            username: userDetails.data.login,
            profile_url: userDetails.data.html_url,
            avatar_url: userDetails.data.avatar_url,
            name: userDetails.data.name,
            public_repos: userDetails.data.public_repos,
            followers: userDetails.data.followers
          };
        }
      } catch (fallbackErr) {
        console.warn(`No GitHub user found for username: ${emailUsername}`);
      }
    }

    console.warn(`⚠️ No public GitHub account found for email: ${email}`);
    return null;
  } catch (error) {
    console.error(`Error fetching GitHub user details for ${email}:`, error.message);
    return null;
  }
}

  // Link GitHub account to user by updating their record
  async linkGitHubAccountToUser(userId, email) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if already linked
      if (user.githubUsername && user.githubLinked) {
        console.log(`User ${user.email} already has GitHub linked: ${user.githubUsername}`);
        return {
          success: true,
          alreadyLinked: true,
          githubUsername: user.githubUsername
        };
      }

      // Search for GitHub account
      const githubUser = await this.getDetailedGitHubUser(email);
      
      if (githubUser && githubUser.username) {
        user.githubUsername = githubUser.username;
        user.githubLinked = true;
        await user.save();
        
        console.log(`✅ Linked GitHub account ${githubUser.username} to user ${user.email}`);
        return {
          success: true,
          githubUsername: githubUser.username,
          githubLinked: true,
          profile_url: githubUser.profile_url
        };
      } else {
        user.githubUsername = null;
        user.githubLinked = false;
        await user.save();
        
        console.log(`⚠️ No GitHub account found for ${user.email}`);
        return {
          success: false,
          githubUsername: null,
          githubLinked: false,
          message: 'No public GitHub account found with this email'
        };
      }
    } catch (error) {
      console.error('Error linking GitHub account:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Add collaborator using stored GitHub username
  async addCollaboratorById(repoName, userId, permission = 'push') {
    if (!this.octokit) {
      return { success: false, error: 'GitHub not configured' };
    }

    try {
      // Get user from database
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Check if user has GitHub username
      if (!user.githubUsername || !user.githubLinked) {
        // Try to link automatically
        const linkResult = await this.linkGitHubAccountToUser(userId, user.email);
        
        if (!linkResult.success || !linkResult.githubUsername) {
          return {
            success: false,
            error: 'Developer does not have a linked GitHub account. Please ensure they have a public GitHub account with the same email address.',
            needsManualInvite: true,
            inviteLink: this.getInviteLink(repoName)
          };
        }
        
        // Refresh user data
        const updatedUser = await User.findById(userId);
        user.githubUsername = updatedUser.githubUsername;
        user.githubLinked = updatedUser.githubLinked;
      }

      // Add collaborator using GitHub username
      await this.octokit.repos.addCollaborator({
        owner: this.owner,
        repo: repoName,
        username: user.githubUsername,
        permission: permission
      });

      console.log(`✅ GitHub invitation sent to: ${user.githubUsername} (${user.email})`);
      return {
        success: true,
        email: user.email,
        username: user.githubUsername,
        message: 'Invitation sent successfully'
      };

    } catch (error) {
      if (error.status === 422) {
        return { 
          success: true, 
          email: user?.email, 
          username: user?.githubUsername,
          message: 'Already a collaborator or invitation pending' 
        };
      }
      console.error(`Failed to invite ${user?.email}:`, error.message);
      return {
        success: false,
        email: user?.email,
        error: error.message,
        inviteLink: this.getInviteLink(repoName),
        requiresManualInvite: true
      };
    }
  }

  // Legacy method - kept for backward compatibility but uses stored usernames
  async addCollaboratorByEmail(repoName, email, permission = 'push') {
    if (!this.octokit) {
      return { success: false, error: 'GitHub not configured' };
    }

    try {
      // Find user by email
      const user = await User.findOne({ email: email });
      
      if (!user) {
        return {
          success: false,
          error: 'User not found in database. Please ensure the developer account exists.',
          inviteLink: this.getInviteLink(repoName),
          requiresManualInvite: true
        };
      }

      // Use the ID-based method
      return await this.addCollaboratorById(repoName, user._id, permission);
      
    } catch (error) {
      console.error(`Failed to invite ${email}:`, error.message);
      return {
        success: false,
        email,
        error: error.message,
        inviteLink: this.getInviteLink(repoName),
        requiresManualInvite: true
      };
    }
  }

  // Add multiple collaborators by user IDs
  async addCollaboratorsByIds(repoName, userIds, permission = 'push') {
    const results = [];
    for (const userId of userIds) {
      const result = await this.addCollaboratorById(repoName, userId, permission);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
    }
    return results;
  }

  // Add multiple collaborators by emails (legacy)
  async addCollaboratorsByEmails(repoName, emails, permission = 'push') {
    const results = [];
    for (const email of emails) {
      const result = await this.addCollaboratorByEmail(repoName, email, permission);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return results;
  }

  // Generate an invite link — fallback when API invite fails
  getInviteLink(repoName) {
    if (!this.owner || !repoName) return null;
    return `https://github.com/${this.owner}/${repoName}/invite`;
  }

  // Generate invite links for multiple repositories
  getBulkInviteLinks(repos) {
    const links = {};
    for (const repoName of repos) {
      links[repoName] = this.getInviteLink(repoName);
    }
    return links;
  }

  // Create GitHub repository with collaborators
  async createRepository(projectName, description = '', developerUserIds = []) {
    if (!this.octokit) {
      return { success: false, error: 'GitHub not configured' };
    }

    try {
      const repoName = this.sanitizeRepoName(projectName);
      const cleanDescription = this.cleanDescription(description);
      
      console.log(`Creating GitHub repository: ${repoName}`);
      
      const response = await this.octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: cleanDescription,
        private: true,
        auto_init: true,
        has_issues: true,
        has_projects: true,
        has_wiki: true
      });

      console.log(`✅ GitHub repository created: ${repoName}`);
      
      const addedCollaborators = [];
      const failedCollaborators = [];
      const inviteLink = this.getInviteLink(repoName);
      
      if (developerUserIds && developerUserIds.length > 0) {
        console.log(`Adding ${developerUserIds.length} collaborators...`);
        const results = await this.addCollaboratorsByIds(repoName, developerUserIds, 'push');
        
        for (const result of results) {
          if (result.success) {
            addedCollaborators.push(result);
          } else {
            failedCollaborators.push({
              userId: result.userId,
              email: result.email,
              error: result.error,
              inviteLink: inviteLink
            });
          }
        }
      }
      
      return {
        success: true,
        repoUrl: response.data.html_url,
        cloneUrl: response.data.clone_url,
        repoName: response.data.name,
        addedCollaborators,
        failedCollaborators,
        inviteLink,
        message: failedCollaborators.length > 0 
          ? `Repository created. ${addedCollaborators.length} collaborators added. ${failedCollaborators.length} could not be invited automatically — share the invite link.`
          : `Repository created with ${addedCollaborators.length} collaborators added successfully.`
      };
    } catch (error) {
      console.error('Error creating repository:', error.message);
      
      if (error.status === 422) {
        try {
          const fallbackResponse = await this.octokit.repos.createForAuthenticatedUser({
            name: this.sanitizeRepoName(projectName),
            description: 'Project from KUIPER CRM',
            private: true,
            auto_init: true
          });
          return {
            success: true,
            repoUrl: fallbackResponse.data.html_url,
            cloneUrl: fallbackResponse.data.clone_url,
            repoName: fallbackResponse.data.name,
            addedCollaborators: [],
            failedCollaborators: [],
            inviteLink: this.getInviteLink(fallbackResponse.data.name),
            message: 'Repository created with fallback settings. Share the invite link with developers.'
          };
        } catch (fallbackError) {
          return { success: false, error: fallbackError.message };
        }
      }
      
      return { success: false, error: error.message };
    }
  }

  // Add single collaborator to existing repo using user ID
  async addCollaboratorToRepoById(repoName, userId, permission = 'push') {
    const result = await this.addCollaboratorById(repoName, userId, permission);
    
    if (!result.success && result.requiresManualInvite) {
      result.inviteLink = this.getInviteLink(repoName);
      result.message = `Could not add automatically — ${result.error} Share the invite link instead.`;
    }
    
    return result;
  }

  // Add single collaborator to existing repo using email (legacy)
  async addCollaboratorToRepo(repoName, email, permission = 'push') {
    const result = await this.addCollaboratorByEmail(repoName, email, permission);
    
    if (!result.success && result.requiresManualInvite) {
      result.inviteLink = this.getInviteLink(repoName);
      result.message = `Could not add ${email} automatically — ${result.error} Share the invite link instead.`;
    }
    
    return result;
  }

  // Remove collaborator from repository
  async removeCollaborator(repoName, identifier) {
    if (!this.octokit) {
      return { success: false, error: 'GitHub not configured' };
    }

    try {
      let username = identifier;
      
      // If identifier is email, try to find user in DB first
      if (identifier.includes('@')) {
        const user = await User.findOne({ email: identifier });
        if (user && user.githubUsername) {
          username = user.githubUsername;
        } else {
          // Fallback to API lookup
          const resolvedUsername = await this.getUsernameFromEmail(identifier);
          if (resolvedUsername) {
            username = resolvedUsername;
          } else {
            return { success: false, error: `GitHub user not found for email: ${identifier}` };
          }
        }
      }
      
      await this.octokit.repos.removeCollaborator({
        owner: this.owner,
        repo: repoName,
        username: username
      });
      
      console.log(`✅ Collaborator removed: ${username} from ${repoName}`);
      return { success: true, username };
    } catch (error) {
      console.error(`Error removing collaborator:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Get all collaborators of a repository
  async getCollaborators(repoName) {
    if (!this.octokit) {
      return { success: false, error: 'GitHub not configured' };
    }

    try {
      const response = await this.octokit.repos.listCollaborators({
        owner: this.owner,
        repo: repoName
      });
      
      return { 
        success: true, 
        collaborators: response.data.map(c => ({
          username: c.login,
          permissions: c.permissions
        }))
      };
    } catch (error) {
      console.error('Error fetching collaborators:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Create feed folder in GitHub repo
  async createFeedFolder(repoName, feedName, feedId, assignedDeveloperIds = []) {
    if (!this.octokit) {
      return { success: false, error: 'GitHub not configured' };
    }

    try {
      const folderName = this.sanitizeFeedName(feedName);
      const readmeContent = `# ${feedName}\n\n## Feed ID: ${feedId}\n\n### Purpose\nThis feed folder contains code and documentation related to ${feedName}.\n\n### Structure\n- \`/docs\` - Documentation\n- \`/src\` - Source code\n- \`/tests\` - Test files\n- \`/config\` - Configuration files\n\n### Assigned Developers\n${assignedDeveloperIds.map(id => `- User ID: ${id}`).join('\n') || '- None assigned'}\n\n### Invite Link\nShare this link with developers who need access: ${this.getInviteLink(repoName)}\n`;
      
      const readmePath = `${folderName}/README.md`;
      const readmeBase64 = Buffer.from(readmeContent).toString('base64');
      
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: repoName,
        path: readmePath,
        message: `feat: Add feed folder for ${feedName}`,
        content: readmeBase64,
        committer: {
          name: 'KUIPER CRM',
          email: 'noreply@kuiper.com'
        }
      });
      
      const subfolders = ['docs', 'src', 'tests', 'config'];
      for (const sub of subfolders) {
        const subPath = `${folderName}/${sub}/.gitkeep`;
        const emptyBase64 = Buffer.from('').toString('base64');
        
        await this.octokit.repos.createOrUpdateFileContents({
          owner: this.owner,
          repo: repoName,
          path: subPath,
          message: `chore: Initialize ${sub} folder for ${feedName}`,
          content: emptyBase64,
          committer: {
            name: 'KUIPER CRM',
            email: 'noreply@kuiper.com'
          }
        }).catch(() => {});
      }
      
      console.log(`✅ Feed folder created on GitHub: ${folderName}`);
      return { success: true, feedPath: folderName, inviteLink: this.getInviteLink(repoName) };
    } catch (error) {
      console.error('Error creating feed folder:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Update feed folder name
  async updateFeedFolder(repoName, oldFeedName, newFeedName) {
    if (!this.octokit) {
      return { success: false, error: 'GitHub not configured' };
    }

    try {
      const oldFolder = this.sanitizeFeedName(oldFeedName);
      const newFolder = this.sanitizeFeedName(newFeedName);
      
      const { data: contents } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: repoName,
        path: oldFolder
      }).catch(() => ({ data: [] }));
      
      if (!contents || !Array.isArray(contents)) {
        return { success: true };
      }
      
      for (const file of contents) {
        const newPath = file.path.replace(oldFolder, newFolder);
        const { data: fileData } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: repoName,
          path: file.path
        });
        
        await this.octokit.repos.createOrUpdateFileContents({
          owner: this.owner,
          repo: repoName,
          path: newPath,
          message: `refactor: Rename feed from ${oldFeedName} to ${newFeedName}`,
          content: fileData.content,
          committer: {
            name: 'KUIPER CRM',
            email: 'noreply@kuiper.com'
          }
        });
        
        await this.octokit.repos.deleteFile({
          owner: this.owner,
          repo: repoName,
          path: file.path,
          message: `refactor: Remove old feed folder ${oldFeedName}`,
          sha: fileData.sha,
          committer: {
            name: 'KUIPER CRM',
            email: 'noreply@kuiper.com'
          }
        });
      }
      
      console.log(`✅ Feed folder renamed: ${oldFolder} → ${newFolder}`);
      return { success: true };
    } catch (error) {
      console.error('Error renaming feed folder:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Delete folder from GitHub
  async deleteFeedFolder(repoName, feedName) {
    if (!this.octokit) {
      return { success: false, error: 'GitHub not configured' };
    }

    try {
      const folderName = this.sanitizeFeedName(feedName);
      
      const { data: contents } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: repoName,
        path: folderName
      }).catch(() => ({ data: [] }));
      
      if (!contents || !Array.isArray(contents)) {
        return { success: true };
      }
      
      for (const file of contents) {
        const { data: fileData } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: repoName,
          path: file.path
        });
        
        await this.octokit.repos.deleteFile({
          owner: this.owner,
          repo: repoName,
          path: file.path,
          message: `chore: Remove feed folder ${feedName}`,
          sha: fileData.sha,
          committer: {
            name: 'KUIPER CRM',
            email: 'noreply@kuiper.com'
          }
        });
      }
      
      console.log(`✅ Feed folder deleted: ${folderName}`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting feed folder:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get repository contents
  async getRepoContents(repoName, path = '') {
    if (!this.octokit) return [];

    try {
      const response = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: repoName,
        path: path
      });
      
      if (Array.isArray(response.data)) {
        return response.data.map(item => ({
          name: item.name,
          path: item.path,
          type: item.type,
          size: item.size,
          url: item.html_url
        }));
      }
      
      return [{
        name: response.data.name,
        path: response.data.path,
        type: response.data.type,
        size: response.data.size,
        url: response.data.html_url
      }];
    } catch (error) {
      console.error('Error fetching repo contents:', error.message);
      return [];
    }
  }

  sanitizeRepoName(name) {
    let cleaned = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return cleaned.substring(0, 100) || 'project';
  }

  sanitizeFeedName(name) {
    let cleaned = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return cleaned.substring(0, 100) || 'feed';
  }
}

module.exports = new GitService();