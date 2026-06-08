const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import your Models
const Project = require('../models/Project');
const Feed = require('../models/Feed');
const Log = require('../models/Log');
const Task = require('../models/Task');
const WorkLog = require('../models/WorkLog');
const { getServerTimestamp } = require('../utils/serverTime');

// Import your Authentication Middleware
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');


/**
 * @route   GET /api/dev/system-time-check
 * @desc    Get server time — used for:
 *          1. Mismatch detection (>5 min diff or different date blocks access)
 *          2. Client clock offset calculation for server-side time tracking
 *          Returns ISO timestamp so client can compute offset = serverTime - clientReceiveTime
 * @access  Private (Developer)
 */
router.get('/system-time-check', protect, authorize('Developer'), async (req, res) => {
  try {
    // Use getServerTimestamp if available, otherwise fall back to new Date()
    const serverNow = typeof getServerTimestamp === 'function'
      ? getServerTimestamp()
      : new Date();

    res.json({
      success: true,
      serverTime: serverNow.toISOString(),
      serverTimestamp: serverNow.getTime(), // ms epoch — used by client for offset math
      timezone: 'Asia/Kolkata'
    });

  } catch (err) {
    console.error('Time check error:', err);
    res.status(500).json({ error: 'Failed to fetch server time' });
  }
});

/**
 * @route   GET /api/dev/my-projects
 * @desc    Get all projects where the developer is assigned to at least one feed
 * @access  Private (Developer)
 */
router.get('/my-projects', protect, authorize('Developer'), async (req, res) => {
  try {
    const assignedFeeds = await Feed.find({
      assignedDevelopers: req.user._id
    }).select('projectId');

    const projectIds = [...new Set(assignedFeeds.map(f => f.projectId))];

    const projects = await Project.find({
      _id: { $in: projectIds }
    })
      .populate('projectManager', 'name email')
      .sort({ updatedAt: -1 });

    res.json(projects);
  } catch (err) {
    console.error('Error fetching dev projects:', err);
    res.status(500).json({ error: 'Server error while fetching projects' });
  }
});

/**
 * @route   GET /api/dev/my-feeds
 * @desc    Get all individual feeds/tasks assigned to the developer
 * @access  Private (Developer)
 */
router.get('/my-feeds', protect, authorize('Developer'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const feeds = await Feed.find({ 
      assignedDevelopers: req.user._id
    })
      .populate({
        path: 'projectId',
        select: 'name projectCustomId gitRepoUrl gitRepoName country industry',
        model: 'Project'
      })
      .populate('assignedDevelopers', 'name email githubUsername githubLinked')
      .lean()
      .sort({ createdAt: -1 });

    // Enhance each feed with Git path information
    const enhancedFeeds = feeds.map(feed => {
      const project = feed.projectId;
      let gitPath = null;
      
      if (project && project.gitRepoName && project.gitRepoUrl) {
        // Use the same sanitization logic as gitService
        const feedFolderName = feed.name
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        // Create multiple path variations
        gitPath = {
          repoName: project.gitRepoName,
          repoUrl: project.gitRepoUrl,
          feedPath: feedFolderName,
          // Different path levels
          rootPath: `${project.gitRepoUrl}/tree/main/${feedFolderName}`,
          srcPath: `${project.gitRepoUrl}/tree/main/${feedFolderName}/src`,
          docsPath: `${project.gitRepoUrl}/tree/main/${feedFolderName}/docs`,
          testsPath: `${project.gitRepoUrl}/tree/main/${feedFolderName}/tests`,
          configPath: `${project.gitRepoUrl}/tree/main/${feedFolderName}/config`,
          // Full URL for cloning
          cloneUrl: project.gitRepoUrl,
          // Display path for UI
          displayPath: `${feedFolderName}/src`
        };
      }
      
      return {
        ...feed,
        gitPath,
        projectName: project?.name || 'Unknown Project',
        projectCustomId: project?.projectCustomId || 'N/A',
        hasGitRepo: !!(project?.gitRepoName && project?.gitRepoUrl)
      };
    });

    res.json(enhancedFeeds);
  } catch (err) {
    console.error('Error fetching dev feeds:', err);
    res.status(500).json({ error: 'Server error while fetching assigned feeds' });
  }
});

/**
 * @route   GET /api/dev/feeds/:feedId/generate-script
 * @desc    Generate secure deployment script (push-only, no clone)
 * @access  Private (Developer)
 */
router.get('/feeds/:feedId/generate-script', protect, authorize('Developer'), async (req, res) => {
  try {
    const feed = await Feed.findById(req.params.feedId)
      .populate({
        path: 'projectId',
        select: 'gitRepoUrl gitRepoName name projectCustomId gitRepoOwner'
      });

    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    const project = feed.projectId;
    
    if (!project || !project.gitRepoUrl) {
      return res.status(400).json({ error: 'No Git repository linked to this feed' });
    }

    // Check if developer is assigned to this feed
    const isAssigned = feed.assignedDevelopers.some(
      devId => devId.toString() === req.user._id.toString()
    );
    
    if (!isAssigned) {
      return res.status(403).json({ error: 'Not authorized to access this feed' });
    }

    const feedFolderName = feed.name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Get write token - if not set, use the main token or provide manual instructions
    let writeToken = process.env.GITHUB_WRITE_TOKEN;
    let authenticatedUrl = null;
    
    // Create authenticated URL with write token (if available)
    if (writeToken && writeToken.startsWith('ghp_')) {
      const repoOwner = project.gitRepoOwner || process.env.GITHUB_OWNER;
      authenticatedUrl = `https://${writeToken}@github.com/${repoOwner}/${project.gitRepoName}.git`;
    } else {
      // If no write token, use the main token or provide manual instructions
      console.log('⚠️ GITHUB_WRITE_TOKEN not found, using manual instructions mode');
    }

    // Generate the secure Python script with fallback mode
// In backend/routes/developer.js, find the line around 306 and fix the script generation

// REPLACE the entire script generation section with this corrected version:

const pythonScript = `#!/usr/bin/env python3
"""
DEPLOYMENT SCRIPT for ${feed.name}
- Uploads files to GitHub repository
${authenticatedUrl ? '- Uses secure token authentication' : '- Manual authentication required'}
"""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from datetime import datetime

# ============================================
# CONFIGURATION
# ============================================
REPO_URL = "${project.gitRepoUrl}"
REPO_NAME = "${project.gitRepoName}"
FEED_FOLDER = "${feedFolderName}"
TARGET_PATH = f"{FEED_FOLDER}/src"

# Get current directory (where deploy.py is located)
CURRENT_DIR = Path(__file__).parent.absolute()

print("=" * 70)
print("📦 DEPLOYMENT SCRIPT")
print("📦 Feed: ${feed.name}")
print(f"👤 Developer: ${req.user.name}")
print(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 70)
print(f"📁 Source: {CURRENT_DIR}")
print(f"🎯 Target: ${feed.name}/src")
print()

${authenticatedUrl ? `
# With token authentication
AUTH_REPO_URL = "${authenticatedUrl}"

def run_command(cmd, cwd=None, capture=False):
    """Run shell command and return result"""
    try:
        if capture:
            result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
            return result.returncode == 0, result.stdout, result.stderr
        else:
            subprocess.run(cmd, shell=True, cwd=cwd, check=True)
            return True, "", ""
    except subprocess.CalledProcessError as e:
        return False, "", str(e)
` : `
def run_command(cmd, cwd=None, capture=False, env=None):
    """Run shell command and return result"""
    try:
        if capture:
            result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True, env=env)
            return result.returncode == 0, result.stdout, result.stderr
        else:
            subprocess.run(cmd, shell=True, cwd=cwd, check=True, env=env)
            return True, "", ""
    except subprocess.CalledProcessError as e:
        return False, "", str(e)

def check_git_credentials():
    """Check if git credentials are available"""
    success, stdout, _ = run_command("git config user.name", capture=True)
    has_name = success and stdout.strip()
    success, stdout, _ = run_command("git config user.email", capture=True)
    has_email = success and stdout.strip()
    
    if not has_name or not has_email:
        print("⚠️ Git user not configured. Please run:")
        print('  git config --global user.name "Your Name"')
        print('  git config --global user.email "your.email@example.com"')
        return False
    return True
`}

def create_temp_repo():
    """Create a temporary repository for pushing"""
    temp_dir = Path(tempfile.mkdtemp()) / REPO_NAME
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    print("🔧 Setting up temporary workspace...")
    
    # Initialize git repo
    run_command("git init", cwd=temp_dir)
    
${authenticatedUrl ? `
    # Set up remote with token
    run_command(f"git remote add origin {AUTH_REPO_URL}", cwd=temp_dir)
` : `
    # Set up remote
    run_command(f"git remote add origin {REPO_URL}", cwd=temp_dir)
    
    print("⚠️ You will need to enter your GitHub credentials when pushing")
`}
    
    # Configure git
    run_command('git config user.name "KUIPER Deployment"', cwd=temp_dir)
    run_command('git config user.email "deploy@kuiper.com"', cwd=temp_dir)
    
    return temp_dir

def create_initial_structure(repo_path):
    """Create the complete folder structure"""
    target_folder = repo_path / TARGET_PATH
    target_folder.mkdir(parents=True, exist_ok=True)
    
    readme_content = f"""# ${feed.name} Feed

## Deployment Information
- **Feed ID**: ${feed._id}
- **Last Deployed**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- **Deployed By**: ${req.user.name}

## Structure
- \`/src\` - Source code files
- This folder is automatically updated on each deployment

## Auto-generated by KUIPER CRM
"""
    readme_path = target_folder / "README.md"
    readme_path.write_text(readme_content)
    print(f"  📄 Created: README.md")
    
    return target_folder

def clear_previous_files(folder_path):
    """Clear all previous files in the target folder"""
    if folder_path.exists():
        print("🗑️  Clearing previous files...")
        for item in folder_path.iterdir():
            if item.name == 'README.md':
                continue
            if item.is_file():
                item.unlink()
            elif item.is_dir():
                shutil.rmtree(item)
        print("✓ Previous files cleared")

def copy_new_files(source_dir, target_folder):
    """Copy new files to the target folder"""
    print("📤 Uploading new files...")
    copied = 0
    
    exclude = {'.git', 'deploy.py', '__pycache__', '.DS_Store', 'venv', '.venv', 'node_modules'}
    
    for item in source_dir.iterdir():
        if item.name in exclude:
            continue
        
        dest = target_folder / item.name
        if item.is_file():
            shutil.copy2(item, dest)
            print(f"  📄 Uploaded: {item.name}")
            copied += 1
        elif item.is_dir():
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(item, dest)
            print(f"  📁 Uploaded folder: {item.name}/")
            copied += 1
    
    print(f"✓ Uploaded {copied} items")
    return copied

def commit_and_push(repo_path):
    """Commit and push changes"""
    print("📦 Committing changes...")
    
    # Add all files
    success, _, stderr = run_command("git add .", cwd=repo_path, capture=True)
    if not success:
        print(f"❌ Failed to add files: {stderr}")
        return False
    
    # Check if there are changes
    success, stdout, _ = run_command("git diff --cached --quiet", cwd=repo_path, capture=True)
    if success:
        print("✓ No changes to commit")
        return True
    
    # Commit
    commit_msg = f"Deploy to ${feed.name} feed - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    success, _, stderr = run_command(f'git commit -m "{commit_msg}"', cwd=repo_path, capture=True)
    if not success:
        print(f"❌ Commit failed: {stderr}")
        return False
    
    print("✓ Committed successfully")
    
    # Push to GitHub
    print("🚀 Pushing to GitHub...")
    
    # Try main branch first, then master
    for branch in ['main', 'master']:
        success, stdout, stderr = run_command(f"git push -f origin {branch}", cwd=repo_path, capture=True)
        if success:
            print(f"✓ Successfully pushed to GitHub ({branch} branch)")
            return True
    
    print(f"❌ Push failed: {stderr}")
    return False

def cleanup_temp_repo(repo_path):
    """Clean up temporary repository"""
    try:
        shutil.rmtree(repo_path.parent)
        print("🧹 Cleaned up temporary files")
    except:
        pass

# ============================================
# MAIN DEPLOYMENT PROCESS
# ============================================

try:
${authenticatedUrl ? '' : `
    # Check git credentials
    if not check_git_credentials():
        print("❌ Please configure git credentials first")
        exit(1)
`}
    
    # Step 1: Create temporary repository
    temp_repo = create_temp_repo()
    print(f"✓ Temporary workspace: {temp_repo}")
    
    # Step 2: Create folder structure
    target_folder = create_initial_structure(temp_repo)
    
    # Step 3: Clear previous files
    clear_previous_files(target_folder)
    
    # Step 4: Copy new files
    files_copied = copy_new_files(CURRENT_DIR, target_folder)
    
    if files_copied == 0:
        print("⚠️ No files were uploaded. Check your source directory.")
    else:
        # Step 5: Commit and push
        if commit_and_push(temp_repo):
            print()
            print("=" * 70)
            print("✅ DEPLOYMENT COMPLETE!")
            print(f"📍 Files deployed to: ${feed.name}/src")
            print("=" * 70)
        else:
            print()
            print("=" * 70)
            print("❌ DEPLOYMENT FAILED!")
            print("=" * 70)
    
    # Step 6: Cleanup
    cleanup_temp_repo(temp_repo)
    
except Exception as e:
    print(f"❌ Deployment error: {str(e)}")
    print("=" * 70)
    print("Please contact your system administrator")
    print("=" * 70)
    exit(1)
`;

    res.json({
      success: true,
      script: pythonScript,
      feedInfo: {
        name: feed.name,
        feedPath: feedFolderName,
        targetPath: `${feedFolderName}/src`
      },
      hasWriteToken: !!writeToken
    });
  } catch (err) {
    console.error('Error generating script:', err);
    res.status(500).json({ error: 'Failed to generate script', details: err.message });
  }
});
/**
 * @route   POST /api/dev/complete-feed
 * @desc    Mark a feed as completed by the developer for today
 * @access  Private (Developer)
 */
router.post('/complete-feed', protect, authorize('Developer'), async (req, res) => {
  try {
    const { feedId, description, completedAt } = req.body;

    if (!feedId) return res.status(400).json({ error: 'Feed ID is required' });
    if (!description || !description.trim()) return res.status(400).json({ error: 'Description is required' });

    const feed = await Feed.findById(feedId);
    if (!feed) return res.status(404).json({ error: 'Feed not found' });

    const isAssigned = feed.assignedDevelopers.some(
      devId => devId.toString() === req.user._id.toString()
    );
    if (!isAssigned) return res.status(403).json({ error: 'Not authorized to complete this feed' });

    const today = new Date().toISOString().split('T')[0];

    if (!feed.completionHistory) feed.completionHistory = [];

    const alreadyCompleted = feed.completionHistory.some(h => h && h.date === today);
    if (alreadyCompleted) return res.status(400).json({ error: 'Feed already completed for today' });

    feed.completionHistory.push({
      date: today,
      completedBy: req.user._id,
      description,
      completedAt: completedAt ? new Date(completedAt) : new Date()
    });

    feed.completed = true;
    feed.completedAt = completedAt ? new Date(completedAt) : new Date();
    feed.completedBy = req.user._id;
    feed.completionDescription = description;
    
    await feed.save();

    if (Log) {
      try {
        await Log.create({
          actionType: 'FEED_COMPLETED',
          performerId: req.user._id,
          feedId: feed._id,
          projectId: feed.projectId,
          details: description,
          timestamp: new Date()
        });
      } catch (logError) {
        console.error('Log creation error (non-critical):', logError.message);
      }
    }

    res.json({
      success: true,
      message: `Feed "${feed.name}" marked as completed for today`,
      feed: {
        id: feed._id,
        name: feed.name,
        completed: feed.completed,
        completionHistory: feed.completionHistory
      }
    });

  } catch (err) {
    console.error('=== COMPLETE FEED ERROR ===', err.message);
    res.status(500).json({ error: 'Server error while completing feed', details: err.message });
  }
});

/**
 * @route   PATCH /api/dev/feeds/:id/status
 * @desc    Update the status of an assigned feed and log the activity
 * @access  Private (Developer)
 */
router.patch('/feeds/:id/status', protect, authorize('Developer'), async (req, res) => {
  try {
    const { status, description } = req.body;
    const feedId = req.params.id;

    const feed = await Feed.findById(feedId);
    if (!feed) return res.status(404).json({ error: 'Feed not found' });

    const isAssigned = feed.assignedDevelopers.some(
      devId => devId.toString() === req.user._id.toString()
    );
    if (!isAssigned) return res.status(403).json({ error: 'Not authorized to update this feed' });

    feed.status = status;
    await feed.save();

    if (Log) {
      await Log.create({
        actionType: 'FEED_STATUS_UPDATED',
        performerId: req.user._id,
        feedId: feed._id,
        details: description || `Feed status updated to ${status}`,
        timestamp: new Date()
      });
    }

    const io = req.app.get('io');
    if (io) io.to(req.user._id.toString()).emit('feed_updated', feed);

    res.json({ message: `Feed status updated to ${status}`, feed });

  } catch (err) {
    console.error('Error updating feed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   PATCH /api/dev/tasks/:taskId
 * @desc    Update the status of an assigned task
 * @access  Private (Developer)
 */
router.patch('/tasks/:taskId', protect, authorize('Developer'), async (req, res) => {
  try {
    const { status, details, name } = req.body;
    const task = await Task.findById(req.params.taskId);

    if (!task) return res.status(404).json({ error: 'Task not found' });

    const isAssigned = task.targetUsers.some(
      userId => userId.toString() === req.user._id.toString()
    );
    if (!isAssigned) return res.status(403).json({ error: 'Not authorized to update this task' });

    if (status) task.status = status;
    if (details) task.details = details;
    if (name) task.name = name;
    if (status === 'Completed') task.completedAt = new Date();

    await task.save();

    const io = req.app.get('io');
    if (io) io.to(req.user._id.toString()).emit('task_updated', task);

    if (Log) {
      await Log.create({
        actionType: 'TASK_COMPLETED',
        performerId: req.user._id,
        details: `Completed task: ${task.name}`,
        timestamp: new Date()
      });
    }

    res.json({ message: 'Task updated successfully', task });

  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/dev/my-bucket
 * @desc    Get all incomplete tasks for the developer
 * @access  Private (Developer)
 */
router.get('/my-bucket', protect, authorize('Developer'), async (req, res) => {
  try {
    const tasks = await Task.find({
      targetUsers: req.user._id,
      status: { $ne: 'Completed' }
    })
      .populate('projectId', 'name')
      .populate('performerId', 'name')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET /api/dev/worklog
 * @desc    Get worklogs for today
 * @access  Private (Developer)
 */
router.get('/worklog', protect, authorize('Developer'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const feeds = await Feed.find({
      assignedDevelopers: req.user._id
    }).populate('projectId', 'name');

    const result = await Promise.all(
      feeds.map(async (feed) => {
        let log = await WorkLog.findOne({
          developerId: req.user._id,
          feedId: feed._id,
          date: today
        });

        if (!log) {
          log = await WorkLog.create({
            developerId: req.user._id,
            feedId: feed._id,
            projectId: feed.projectId?._id,
            date: today,
            timeBlocks: []
          });
        }

        return { feed, worklog: log };
      })
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch worklogs' });
  }
});

/**
 * @route   POST /api/dev/worklog/start/:feedId
 * @desc    Start timer for a feed
 * @access  Private (Developer)
 */
router.post('/worklog/start/:feedId', protect, authorize('Developer'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const log = await WorkLog.findOne({
      developerId: req.user._id,
      feedId: req.params.feedId,
      date: today
    });

    if (!log) return res.status(404).json({ error: 'Worklog not found' });
    if (log.isRunning) return res.status(400).json({ error: 'Timer already running' });

    const serverNow = new Date();

    log.startedAt = serverNow;
    log.isRunning = true;

    if (!log.timeBlocks) log.timeBlocks = [];

    log.timeBlocks.push({
      startTime: serverNow,
      endTime: null,
      duration: 0
    });

    await log.save();

    res.json({
      success: true,
      worklog: log,
      serverTimestamp: serverNow.getTime()
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

/**
 * @route   POST /api/dev/worklog/pause/:feedId
 * @desc    Pause timer for a feed
 * @access  Private (Developer)
 */
router.post('/worklog/pause/:feedId', protect, authorize('Developer'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const log = await WorkLog.findOne({
      developerId: req.user._id,
      feedId: req.params.feedId,
      date: today
    });

    if (!log) return res.status(404).json({ error: 'Worklog not found' });
    if (!log.isRunning) return res.status(400).json({ error: 'Timer is not running' });

    const serverNow = new Date();
    const diff = Math.floor((serverNow.getTime() - new Date(log.startedAt).getTime()) / 1000);

    log.totalTime += diff;

    if (log.timeBlocks?.length > 0) {
      const currentBlock = log.timeBlocks[log.timeBlocks.length - 1];
      if (currentBlock && !currentBlock.endTime) {
        currentBlock.endTime = serverNow;
        currentBlock.duration = diff;
      }
    }

    log.isRunning = false;
    log.startedAt = null;

    await log.save();

    res.json({
      success: true,
      worklog: log,
      serverTimestamp: serverNow.getTime()
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to pause timer' });
  }
});

/**
 * @route   POST /api/dev/worklog/stop/:feedId
 * @desc    Stop timer for a feed
 * @access  Private (Developer)
 */
router.post('/worklog/stop/:feedId', protect, authorize('Developer'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const log = await WorkLog.findOne({
      developerId: req.user._id,
      feedId: req.params.feedId,
      date: today
    });

    if (!log) return res.status(404).json({ error: 'Worklog not found' });

    if (log.isRunning) {
      const serverNow = new Date();
      const diff = Math.floor((serverNow.getTime() - new Date(log.startedAt).getTime()) / 1000);

      log.totalTime += diff;

      if (log.timeBlocks?.length > 0) {
        const currentBlock = log.timeBlocks[log.timeBlocks.length - 1];
        if (currentBlock && !currentBlock.endTime) {
          currentBlock.endTime = serverNow;
          currentBlock.duration = diff;
        }
      }
    }

    log.isRunning = false;
    log.startedAt = null;

    await log.save();

    const serverNow = new Date();

    res.json({
      success: true,
      worklog: log,
      serverTimestamp: serverNow.getTime()
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

/**
 * @route   POST /api/dev/worklog/deduct-break/:feedId
 * @desc    Deduct break time from a feed's worklog
 * @access  Private (Developer)
 */
router.post('/worklog/deduct-break/:feedId', protect, authorize('Developer'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { breakSeconds, breakDescription } = req.body;

    if (!breakSeconds || breakSeconds <= 0) {
      return res.status(400).json({ error: 'Valid break duration is required' });
    }

    const log = await WorkLog.findOne({
      developerId: req.user._id,
      feedId: req.params.feedId,
      date: today
    });

    if (!log) return res.status(404).json({ error: 'Worklog not found' });

    if (!log.breakEntries) log.breakEntries = [];
    if (!log.totalBreakTime) log.totalBreakTime = 0;

    log.totalBreakTime += breakSeconds;
    log.breakEntries.push({
      duration: breakSeconds,
      reason: breakDescription || 'Break/Lunch',
      timestamp: new Date()
    });
    
    log.netTime = Math.max(0, (log.totalTime || 0) - log.totalBreakTime);
    
    await log.save();

    if (Log) {
      await Log.create({
        actionType: 'BREAK_DEDUCTED',
        performerId: req.user._id,
        feedId: req.params.feedId,
        details: `Deducted ${Math.floor(breakSeconds / 60)} minutes break: ${breakDescription || 'No reason provided'}`,
        timestamp: new Date()
      });
    }

    res.json(log);
  } catch (err) {
    console.error('Error deducting break time:', err);
    res.status(500).json({ error: 'Failed to deduct break time' });
  }
});

module.exports = router;