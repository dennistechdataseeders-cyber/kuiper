// backend/routes/developer.js - COMPLETE FIXED VERSION (v2: hardened main-only push)

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import your Models
const Project = require('../models/Project');
const Feed = require('../models/Feed');
const Log = require('../models/Log');
const Task = require('../models/Task');
const WorkLog = require('../models/WorkLog');
const TicketWorkLog = require('../models/TicketWorkLog');
const WorkDescription = require('../models/WorkDescription');

const { getServerTimestamp } = require('../utils/serverTime');

// Import your Authentication Middleware
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

/**
 * @route   GET /api/dev/system-time-check
 * @desc    Get server time
 * @access  Private (Developer)
 */
router.get('/system-time-check', protect, authorize('Developer'), async (req, res) => {
  try {
    const serverNow = typeof getServerTimestamp === 'function'
      ? getServerTimestamp()
      : new Date();

    res.json({
      success: true,
      serverTime: serverNow.toISOString(),
      serverTimestamp: serverNow.getTime(),
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
        const feedFolderName = feed.name
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        gitPath = {
          repoName: project.gitRepoName,
          repoUrl: project.gitRepoUrl,
          feedPath: feedFolderName,
          rootPath: `${project.gitRepoUrl}/tree/main/${feedFolderName}`,
          srcPath: `${project.gitRepoUrl}/tree/main/${feedFolderName}/src`,
          docsPath: `${project.gitRepoUrl}/tree/main/${feedFolderName}/docs`,
          testsPath: `${project.gitRepoUrl}/tree/main/${feedFolderName}/tests`,
          configPath: `${project.gitRepoUrl}/tree/main/${feedFolderName}/config`,
          cloneUrl: project.gitRepoUrl,
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
 * @desc    Generate secure deployment script
 *          - Clones the existing repo (preserves all history / other feeds' folders)
 *          - Touches ONLY <feedFolder>/src
 *          - Always targets the 'main' branch — no 'master' fallback, no force push
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

    let writeToken = process.env.GITHUB_WRITE_TOKEN;
    let authenticatedUrl = null;

    if (writeToken && writeToken.startsWith('ghp_')) {
      const repoOwner = project.gitRepoOwner || process.env.GITHUB_OWNER;
      authenticatedUrl = `https://${writeToken}@github.com/${repoOwner}/${project.gitRepoName}.git`;
    }

    const pythonScript = `#!/usr/bin/env python3
"""
DEPLOYMENT SCRIPT for ${feed.name}
- Clones the existing repository (full history + all other feed folders preserved)
- Updates ONLY the folder for this feed (${feedFolderName}/src)
- Pushes directly to the 'main' branch on GitHub — no 'master' fallback, never force-pushed
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
REPO_NAME = "${project.gitRepoName}"
FEED_FOLDER = "${feedFolderName}"
TARGET_PATH = f"{FEED_FOLDER}/src"  # The ONLY folder this script is allowed to touch
TARGET_BRANCH = "main"              # Hardcoded. Every push goes to 'main'. No master fallback.

# Allowed file extensions to be pushed
ALLOWED_EXTENSIONS = {'.py', '.txt', '.exe', '.bat'}

# Get current directory (where deploy.py is located)
CURRENT_DIR = Path(__file__).parent.absolute()

print("=" * 70)
print("📦 DEPLOYMENT SCRIPT (Incremental Update — main branch only)")
print("📦 Feed: ${feed.name}")
print(f"👤 Developer: ${req.user.name}")
print(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 70)
print(f"📁 Local Source: {CURRENT_DIR}")
print(f"🎯 Remote Target: ${project.gitRepoName}/{TARGET_PATH}")
print(f"🌿 Target Branch: {TARGET_BRANCH}")
print(f"📋 Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}")
print()

${authenticatedUrl ? `
AUTH_REPO_URL = "${authenticatedUrl}"
` : `
AUTH_REPO_URL = "${project.gitRepoUrl}"
`}

def run_command(cmd, cwd=None, capture=False):
    """Run shell command and return result"""
    try:
        if capture:
            result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True, check=False)
            return result.returncode == 0, result.stdout, result.stderr
        else:
            subprocess.run(cmd, shell=True, cwd=cwd, check=True)
            return True, "", ""
    except subprocess.CalledProcessError as e:
        return False, "", str(e)

def update_feed_folder(repo_path):
    """Clears ONLY this feed's src folder and copies new files into it.
    Every other folder in the repo (other feeds, docs, tests, config, README) is left untouched."""
    target_folder = repo_path / TARGET_PATH
    print(f"🗑️  Clearing previous files in '{TARGET_PATH}'...")
    if target_folder.exists():
        shutil.rmtree(target_folder)
    target_folder.mkdir(parents=True, exist_ok=True)
    print("✓ Previous files cleared")

    print("📤 Copying new allowed files...")
    copied = 0
    exclude = {'.git', 'deploy.py', '__pycache__', '.DS_Store', 'venv', '.venv', 'node_modules'}

    for item in CURRENT_DIR.rglob('*'):
        if any(excl in str(item) for excl in exclude):
            continue
        if item.is_file() and item.suffix.lower() in ALLOWED_EXTENSIONS:
            relative_path = item.relative_to(CURRENT_DIR)
            dest_file = target_folder / relative_path
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, dest_file)
            print(f"  📄 Copied: {relative_path}")
            copied += 1

    print(f"✓ Copied {copied} allowed file(s)")
    return copied

def ensure_main_branch_exists(repo_path):
    """Make sure we're on a local 'main' branch that tracks origin/main whenever possible.
    - If origin/main exists, always base off it (this is what keeps deploys safe/non-destructive).
    - Only if 'main' truly doesn't exist anywhere is a brand new one created from HEAD."""
    success_remote, _, _ = run_command(
        f"git show-ref --verify --quiet refs/remotes/origin/{TARGET_BRANCH}", cwd=repo_path, capture=True
    )

    if success_remote:
        print(f"🌿 Checking out '{TARGET_BRANCH}' tracking origin/{TARGET_BRANCH}...")
        # -B resets/creates the local branch to match origin/main exactly, avoiding any
        # stale local branch from a previous run interfering with the sync.
        run_command(f"git checkout -B {TARGET_BRANCH} origin/{TARGET_BRANCH}", cwd=repo_path)
        return

    success_local, _, _ = run_command(
        f"git show-ref --verify --quiet refs/heads/{TARGET_BRANCH}", cwd=repo_path, capture=True
    )
    if success_local:
        print(f"🌿 Checking out existing local branch '{TARGET_BRANCH}'...")
        run_command(f"git checkout {TARGET_BRANCH}", cwd=repo_path)
        return

    # No 'main' branch anywhere yet — create it from the current HEAD (repo's default branch)
    print(f"⚠️  Branch '{TARGET_BRANCH}' not found on origin. Creating it from current HEAD...")
    run_command(f"git checkout -b {TARGET_BRANCH}", cwd=repo_path)

def push_with_retry(repo_path, max_attempts=3):
    """Push to origin/main. If it's rejected because someone else pushed in the meantime,
    pull --rebase and retry instead of ever force-pushing."""
    for attempt in range(1, max_attempts + 1):
        success, out, err = run_command(f"git push -u origin {TARGET_BRANCH}", cwd=repo_path, capture=True)
        if success:
            return True, err
        if 'rejected' in (err or '').lower() or 'non-fast-forward' in (err or '').lower():
            print(f"↻ Remote has new commits (attempt {attempt}/{max_attempts}). Rebasing and retrying...")
            run_command(f"git pull --rebase origin {TARGET_BRANCH}", cwd=repo_path, capture=True)
            continue
        # Some other failure — no point retrying blindly
        return False, err
    return False, err

def main():
    if not any(CURRENT_DIR.glob("*")):
        print("⚠️ Source directory is empty. Nothing to deploy.")
        return

    temp_dir = Path(tempfile.mkdtemp())
    repo_path = temp_dir / REPO_NAME

    try:
        # 1. Clone the existing repository (full history, ALL feed folders intact)
        print(f"📡 Cloning repository '{REPO_NAME}'...")
        success, _, err = run_command(f"git clone {AUTH_REPO_URL} {repo_path}", capture=True)
        if not success:
            print(f"❌ Failed to clone repository: {err}")
            return
        print("✅ Repository cloned successfully.")

        # 2. Ensure we are on 'main', synced with origin/main
        ensure_main_branch_exists(repo_path)

        # 3. Update ONLY this feed's folder
        files_copied = update_feed_folder(repo_path)
        if files_copied == 0:
            print("⚠️ No new files were copied. Nothing to commit.")
            return

        # 4. Commit the changes
        print("📦 Committing changes...")
        run_command('git config user.name "KUIPER Deployment"', cwd=repo_path)
        run_command('git config user.email "deploy@kuiper.com"', cwd=repo_path)
        run_command("git add .", cwd=repo_path)

        success, _, _ = run_command("git diff --cached --quiet", cwd=repo_path, capture=True)
        if success:  # returncode 0 means "no differences" → nothing to commit
            print("✓ No changes to commit.")
            return

        commit_msg = f"Update feed '${feed.name}' - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        run_command(f'git commit -m "{commit_msg}"', cwd=repo_path)

        # 5. Push to 'main' only — normal push, retried with rebase on conflict, NEVER forced
        print(f"🚀 Pushing to GitHub (branch: {TARGET_BRANCH})...")
        success, err = push_with_retry(repo_path)
        if not success:
            print(f"❌ Push failed: {err}")
            print("   Your changes were committed locally but not pushed.")
            print("   No remote data was touched or overwritten.")
            return

        print()
        print("=" * 70)
        print("✅ DEPLOYMENT COMPLETE!")
        print(f"📍 Files deployed to: {TARGET_PATH}")
        print(f"🌿 Branch: {TARGET_BRANCH}")
        print("=" * 70)

    finally:
        # 6. Clean up the temporary directory
        print("🧹 Cleaning up temporary files...")
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    main()
`;

    res.json({
      success: true,
      script: pythonScript,
      feedInfo: {
        name: feed.name,
        feedPath: feedFolderName,
        targetPath: `${feedFolderName}/src`,
        targetBranch: 'main'
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

// ============================================
// ✅ FIXED: WORKLOG ROUTES
// ============================================

/**
 * @route   GET /api/dev/worklog
 * @desc    Get worklogs for today with net time calculation
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
            timeBlocks: [],
            totalTime: 0
          });
        }

        // ✅ FIX: Get today's description for this feed
        const todayDescription = await WorkDescription.findOne({
          developer: req.user._id,
          feed: feed._id,
          date: today
        });

        // ✅ FIX: Check if user can edit today's log
        const canEditToday = true;

        return {
          feed,
          worklog: log,
          todayDescription: todayDescription || null,
          canEditToday: canEditToday
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error('Error fetching worklogs:', err);
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
 * @route   POST /api/dev/worklog/log-description
 * @desc    Save or update work description for a feed
 * @access  Private (Developer)
 */
router.post('/worklog/log-description', protect, authorize('Developer'), async (req, res) => {
  try {
    const { feedId, description, isEdit } = req.body;
    const developerId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Find existing description for today
    let existing = await WorkDescription.findOne({
      developer: developerId,
      feed: feedId,
      date: today
    });

    if (existing) {
      if (isEdit) {
        // ✅ EDIT MODE: Replace the entire description
        existing.description = description.trim();
      } else {
        // ✅ APPEND MODE: Add new description with timestamp
        const timestamp = new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        existing.description += `\n\n[${timestamp}] ${description.trim()}`;
      }
      await existing.save();
      return res.json(existing);
    }

    // Create new description
    const log = await WorkDescription.create({
      developer: developerId,
      feed: feedId,
      description: description.trim(),
      date: today
    });

    res.status(201).json(log);
  } catch (err) {
    console.error('Error saving work description:', err);
    res.status(500).json({ error: 'Failed to save work description' });
  }
});
/**
 * @route   GET /api/dev/worklog/today-descriptions
 * @desc    Get all today's descriptions for the developer
 * @access  Private (Developer)
 */
router.get('/worklog/today-descriptions', protect, authorize('Developer'), async (req, res) => {
  try {
    const developerId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const logs = await WorkDescription.find({
      developer: developerId,
      date: today
    }).populate('feed', 'name');

    res.json(logs);
  } catch (error) {
    console.error('Error fetching descriptions:', error);
    res.status(500).json({ error: 'Failed to fetch descriptions' });
  }
});

// ============================================
// ✅ FIXED: TICKET WORKLOG ROUTES - SHOWS NET TIME
// ============================================

/**
 * Helper: Calculate net time without overlap for a ticket
 * This merges overlapping time blocks and returns total unique time
 */
function calculateTicketNetTime(worklog) {
  if (!worklog || !worklog.timeBlocks || worklog.timeBlocks.length === 0) {
    return worklog?.totalTime || 0;
  }

  // Get all intervals from time blocks
  const intervals = [];
  const now = Date.now();

  worklog.timeBlocks.forEach(block => {
    if (block.startTime && block.endTime) {
      intervals.push({
        start: new Date(block.startTime).getTime(),
        end: new Date(block.endTime).getTime()
      });
    } else if (block.startTime && !block.endTime && !worklog.isRunning) {
      // If still running, use current time
      intervals.push({
        start: new Date(block.startTime).getTime(),
        end: now
      });
    }
  });

  // If currently running, add current session
  if (worklog.isRunning && worklog.startedAt) {
    intervals.push({
      start: new Date(worklog.startedAt).getTime(),
      end: now
    });
  }

  if (intervals.length === 0) {
    return worklog.totalTime || 0;
  }

  // Sort intervals by start time
  intervals.sort((a, b) => a.start - b.start);

  // Merge overlapping intervals
  const merged = [{ ...intervals[0] }];
  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  // Calculate total net time
  const totalMs = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
  return Math.floor(totalMs / 1000);
}

/**
 * @route   GET /api/dev/ticket-worklog
 * @desc    Get all ticket worklogs for today with NET TIME
 * @access  Private (Developer, PM, Admin, Team Lead)
 */
router.get('/ticket-worklog', protect, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const Ticket = require('../models/Ticket');
    const TicketWorkLog = require('../models/TicketWorkLog');
    const Project = require('../models/Project');

    let ticketQuery = {};
    const userRole = req.user.role;
    const userId = req.user._id;

    // ============================================
    // ROLE-BASED TICKET FILTERING
    // ============================================
    if (userRole === 'Developer') {
      ticketQuery = {
        $or: [
          { assignedTo: userId },
          { watchers: userId }
        ],
        status: { $in: ['Open', 'In Progress'] }
      };
    }
    else if (userRole === 'Project Manager') {
      const pmProjects = await Project.find({ projectManager: userId }).select('_id');
      const projectIds = pmProjects.map(p => p._id);

      ticketQuery = {
        $or: [
          { projectId: { $in: projectIds } },
          { assignedTo: userId },
          { createdBy: userId },
          { watchers: userId }
        ],
        status: { $in: ['Open', 'In Progress'] }
      };
    }
    else if (userRole === 'Team Lead') {
      const tlProjects = await Project.find({ teamLead: userId }).select('_id');
      const projectIds = tlProjects.map(p => p._id);

      ticketQuery = {
        $or: [
          { projectId: { $in: projectIds } },
          { assignedTo: userId },
          { createdBy: userId },
          { watchers: userId }
        ],
        status: { $in: ['Open', 'In Progress'] }
      };
    }
    else if (userRole === 'Admin') {
      ticketQuery = {
        status: { $in: ['Open', 'In Progress'] }
      };
    }
    else {
      ticketQuery = {
        assignedTo: userId,
        status: { $in: ['Open', 'In Progress'] }
      };
    }

    console.log(`🔍 Fetching tickets for ${userRole} with query:`, JSON.stringify(ticketQuery));

    // Fetch tickets based on role
    const tickets = await Ticket.find(ticketQuery)
      .select('_id title ticketNumber priority projectId status')
      .populate('projectId', 'name projectCustomId');

    console.log(`📊 Found ${tickets.length} tickets for ${userRole}`);

    // Build worklogs for each ticket
    const result = await Promise.all(
      tickets.map(async (ticket) => {
        let log = await TicketWorkLog.findOne({
          developerId: userId,
          ticketId: ticket._id,
          date: today
        });

        // If no worklog exists, create one
        if (!log) {
          log = await TicketWorkLog.create({
            developerId: userId,
            ticketId: ticket._id,
            projectId: ticket.projectId?._id || ticket.projectId,
            date: today,
            timeBlocks: [],
            totalTime: 0,
            description: ''
          });
          console.log(`📝 Created new worklog for ${userRole} on ticket: ${ticket.ticketNumber}`);
        }

        // ✅ FIX: Calculate NET TIME for this ticket
        const netTime = calculateTicketNetTime(log);
        const rawTime = log.totalTime || 0;
        const overlapTime = Math.max(0, rawTime - netTime);

        // Create a copy with net time included
        const worklogWithNet = {
          ...log.toObject(),
          netTime: netTime,
          overlapTime: overlapTime,
          rawTime: rawTime
        };

        return { ticket, worklog: worklogWithNet };
      })
    );

    res.json(result);
  } catch (err) {
    console.error('Error fetching ticket worklogs:', err);
    res.status(500).json({ error: 'Failed to fetch ticket worklogs', details: err.message });
  }
});

/**
 * @route   POST /api/dev/ticket-worklog/start/:ticketId
 * @desc    Start timer for a ticket
 * @access  Private (Developer, PM, Admin)
 */
router.post('/ticket-worklog/start/:ticketId', protect, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const userId = req.user._id;
    const Ticket = require('../models/Ticket');

    const ticket = await Ticket.findById(req.params.ticketId);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check if user has access to this ticket
    const userRole = req.user.role;
    const hasAccess = (
      ticket.assignedTo?.toString() === userId.toString() ||
      ticket.createdBy?.toString() === userId.toString() ||
      userRole === 'Admin' ||
      userRole === 'Project Manager' ||
      userRole === 'Team Lead'
    );

    if (!hasAccess) {
      return res.status(403).json({ error: 'Not authorized to start timer on this ticket' });
    }

    let log = await TicketWorkLog.findOne({
      developerId: userId,
      ticketId: req.params.ticketId,
      date: today
    });

    if (!log) {
      log = await TicketWorkLog.create({
        developerId: userId,
        ticketId: req.params.ticketId,
        projectId: ticket.projectId,
        date: today,
        timeBlocks: []
      });
    }

    if (log.isRunning) {
      return res.status(400).json({ error: 'Timer already running for this ticket' });
    }

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

    // Calculate net time for response
    const netTime = calculateTicketNetTime(log);

    res.json({
      success: true,
      worklog: {
        ...log.toObject(),
        netTime: netTime
      },
      serverTimestamp: serverNow.getTime()
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

/**
 * @route   POST /api/dev/ticket-worklog/pause/:ticketId
 * @desc    Pause timer for a ticket
 * @access  Private (Developer, PM, Admin)
 */
router.post('/ticket-worklog/pause/:ticketId', protect, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const log = await TicketWorkLog.findOne({
      developerId: req.user._id,
      ticketId: req.params.ticketId,
      date: today
    });

    if (!log) {
      return res.status(404).json({ error: 'Ticket worklog not found' });
    }

    if (!log.isRunning) {
      return res.status(400).json({ error: 'Timer is not running' });
    }

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

    const netTime = calculateTicketNetTime(log);

    res.json({
      success: true,
      worklog: {
        ...log.toObject(),
        netTime: netTime
      },
      serverTimestamp: serverNow.getTime()
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to pause timer' });
  }
});

/**
 * @route   POST /api/dev/ticket-worklog/stop/:ticketId
 * @desc    Stop timer for a ticket
 * @access  Private (Developer, PM, Admin)
 */
router.post('/ticket-worklog/stop/:ticketId', protect, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const log = await TicketWorkLog.findOne({
      developerId: req.user._id,
      ticketId: req.params.ticketId,
      date: today
    });

    if (!log) {
      return res.status(404).json({ error: 'Ticket worklog not found' });
    }

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
    const netTime = calculateTicketNetTime(log);

    res.json({
      success: true,
      worklog: {
        ...log.toObject(),
        netTime: netTime
      },
      serverTimestamp: serverNow.getTime()
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

/**
 * @route   POST /api/dev/ticket-worklog/description
 * @desc    Save description for a ticket worklog
 * @access  Private (Developer, PM, Admin)
 */
router.post('/ticket-worklog/description', protect, async (req, res) => {
  try {
    const { ticketId, description } = req.body;
    const today = new Date().toISOString().split('T')[0];

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    let log = await TicketWorkLog.findOne({
      developerId: req.user._id,
      ticketId: ticketId,
      date: today
    });

    if (!log) {
      const Ticket = require('../models/Ticket');
      const ticket = await Ticket.findById(ticketId);

      log = await TicketWorkLog.create({
        developerId: req.user._id,
        ticketId: ticketId,
        projectId: ticket?.projectId,
        date: today,
        description: description.trim(),
        timeBlocks: []
      });
    } else {
      // ✅ FIX: Append to existing description with timestamp
      const timestamp = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      log.description = log.description
        ? `${log.description}\n\n[${timestamp}] ${description.trim()}`
        : description.trim();
      await log.save();
    }

    const netTime = calculateTicketNetTime(log);

    res.json({
      success: true,
      worklog: {
        ...log.toObject(),
        netTime: netTime
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save description' });
  }
});

module.exports = router;