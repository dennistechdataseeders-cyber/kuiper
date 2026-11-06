// backend/services/feedGitSyncService.js
// Reads the last commit date of each feed folder from GitHub and stores it on the Feed
// document, so the Project Manager feeds page never has to call GitHub while loading.

const { Octokit } = require('@octokit/rest');
const Feed = require('../models/Feed');
const Project = require('../models/Project');
const gitService = require('./gitService');

const BATCH_SIZE = 5;          // parallel GitHub calls
const BATCH_DELAY_MS = 500;    // pause between batches (rate-limit friendly)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getOctokit = () => {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER) return null;
  return new Octokit({ auth: process.env.GITHUB_TOKEN, userAgent: 'KUIPER-CRM-v1.0' });
};

// Last commit that touched <folder> in the repo. Returns { date, sha } or null if no commits.
async function fetchFolderLastCommit(octokit, repoName, folder) {
  const { data } = await octokit.repos.listCommits({
    owner: process.env.GITHUB_OWNER,
    repo: repoName,
    path: folder,
    per_page: 1
  });
  if (!data || data.length === 0) return null;
  return { date: new Date(data[0].commit.committer.date), sha: data[0].sha };
}

/**
 * Sync feeds' Git dates into MongoDB.
 * @param {Object}  opts
 * @param {String}  [opts.projectId]        only this project
 * @param {Boolean} [opts.onlyNeverSynced]  only feeds that were never synced (startup backfill)
 */
async function syncFeedGitDates({ projectId, onlyNeverSynced = false } = {}) {
  const octokit = getOctokit();
  if (!octokit) return { success: false, error: 'GitHub not configured', updated: 0, failed: 0 };

  const projectFilter = { gitRepoName: { $nin: [null, ''] } };
  if (projectId) projectFilter._id = projectId;

  const projects = await Project.find(projectFilter).select('_id gitRepoName feeds').lean();

  let updated = 0;
  let failed = 0;
  let rateLimited = false;

  for (const project of projects) {
    if (rateLimited) break;

    const feedFilter = { _id: { $in: project.feeds || [] } };
    if (onlyNeverSynced) feedFilter.gitLastSyncedAt = null; // matches missing field too

    const feeds = await Feed.find(feedFilter).select('_id name').lean();
    const ops = [];

    for (let i = 0; i < feeds.length && !rateLimited; i += BATCH_SIZE) {
      const batch = feeds.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((feed) =>
          fetchFolderLastCommit(octokit, project.gitRepoName, gitService.sanitizeFeedName(feed.name))
        )
      );

      results.forEach((res, idx) => {
        const feed = batch[idx];
        if (res.status === 'fulfilled') {
          const commit = res.value; // may be null (folder has no commits yet)
          ops.push({
            updateOne: {
              filter: { _id: feed._id },
              update: {
                $set: {
                  gitLastUpdated: commit ? commit.date : null,
                  gitLastCommitSha: commit ? commit.sha : null,
                  gitLastSyncedAt: new Date()
                }
              }
            }
          });
          updated++;
        } else {
          // keep the old stored value on errors
          failed++;
          const status = res.reason && res.reason.status;
          if (status === 403 || status === 429) rateLimited = true;
          console.error(`Git sync failed for feed "${feed.name}":`, res.reason && res.reason.message);
        }
      });

      if (i + BATCH_SIZE < feeds.length) await sleep(BATCH_DELAY_MS);
    }

    if (ops.length) {
      // timestamps:false so the weekly sync doesn't change every feed's updatedAt
      await Feed.bulkWrite(ops, { timestamps: false });
    }
  }

  return { success: true, updated, failed, rateLimited };
}

module.exports = {
  syncAllFeeds: (opts = {}) => syncFeedGitDates(opts),
  syncProjectFeeds: (projectId) => syncFeedGitDates({ projectId })
};