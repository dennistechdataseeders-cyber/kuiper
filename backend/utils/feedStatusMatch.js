// backend/utils/feedStatusMatch.js
// The ONE rule that links a FeedStatus record (written by the scrapers / pipeline) to a Project
// and a Feed. FeedStatus.project is free text: the pipeline may send the project's custom id, its
// name or its _id, so all three are accepted, ignoring case and extra spaces.
// A record saved WITHOUT a project is matched by feed name alone, but only when exactly one feed
// in KUIPER has that name, so it can never show up under the wrong project.

const Feed = require('../models/Feed');
const FeedStatus = require('../models/FeedStatus');

// What the write endpoints in clientRoutes.js store when the pipeline sends no project
const NO_PROJECT = [null, '', 'Unknown', 'Unknown Project'];

const normalize = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// Custom id wins over _id, _id wins over name (names are not unique)
const projectKeys = (project) => [project.projectCustomId, project._id, project.name].map(normalize);

/**
 * Which project does each stored FeedStatus.project value belong to?
 * One small lookup (distinct on an indexed field), whatever the number of projects or feeds.
 * @returns {Promise<Map<string, string[]>>} stored value -> project ids
 */
async function mapStoredProjects(projects) {
  const byKey = [new Map(), new Map(), new Map()];
  for (const project of projects) {
    projectKeys(project).forEach((key, i) => {
      if (!key) return;
      byKey[i].set(key, [...(byKey[i].get(key) || []), String(project._id)]);
    });
  }
  const stored = await FeedStatus.distinct('project');
  const result = new Map();
  for (const value of stored) {
    const key = normalize(value);
    const ids = byKey[0].get(key) || byKey[1].get(key) || byKey[2].get(key);
    if (ids) result.set(value, ids);
  }
  return result;
}

/**
 * @returns {Promise<{ projectValues: Array, assign: Function }>}
 *   projectValues: values for FeedStatus.find({ project: { $in: projectValues }, ... })
 *   assign(records): [{ record, projectIds }] - records with no match are left out, and records
 *   that carry a project come before those matched by name only
 */
async function createStatusMatcher(projects) {
  const stored = await mapStoredProjects(projects);
  const ids = new Set(projects.map((p) => String(p._id)));

  const assign = async (records) => {
    const matched = [];
    const noProject = [];
    for (const record of records) {
      if (NO_PROJECT.includes(record.project ?? null)) noProject.push(record);
      else if (stored.has(record.project)) matched.push({ record, projectIds: stored.get(record.project) });
    }
    if (noProject.length) {
      const owners = new Map(); // feed name -> project ids of every feed with that name
      for (const feed of await Feed.find({}).select('name projectId').lean()) {
        const name = normalize(feed.name);
        owners.set(name, [...(owners.get(name) || []), String(feed.projectId)]);
      }
      for (const record of noProject) {
        const owner = owners.get(normalize(record.feed_name));
        if (owner?.length === 1 && ids.has(owner[0])) matched.push({ record, projectIds: owner });
      }
    }
    return matched;
  };

  return { projectValues: [...stored.keys(), ...NO_PROJECT], assign };
}

const feedKey = (projectId, feedName) => `${projectId}|${normalize(feedName)}`;

module.exports = { NO_PROJECT, normalize, createStatusMatcher, feedKey };
