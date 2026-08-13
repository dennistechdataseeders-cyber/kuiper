// backend/scripts/migrate-fix-urls.js
//
// One-time migration: rewrites http://api.kuiperapp.co.in/uploads/...
// URLs stored in MongoDB (from before the trust-proxy fix) to https://.
//
// USAGE (from the backend/ directory on the VPS):
//   node scripts/migrate-fix-urls.js            # dry run - shows what WOULD change
//   node scripts/migrate-fix-urls.js --apply     # actually writes the changes
//
// Always run without --apply first and read the output before applying.

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in .env');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

// Only rewrite our own upload links - leaves any other http:// links
// (there shouldn't be any, but this keeps it safe) untouched.
const HTTP_PREFIX_MATCH = '/uploads/';

function fixUrl(url) {
  if (typeof url !== 'string') return url;
  if (url.startsWith('http://') && url.includes(HTTP_PREFIX_MATCH)) {
    return url.replace('http://', 'https://');
  }
  return url;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log(`✅ Connected to MongoDB`);
  console.log(APPLY ? '⚠️  APPLY MODE - changes will be written' : '🔍 DRY RUN - no changes will be written (pass --apply to write)');
  console.log('');

  const db = mongoose.connection.db;
  let totalDocsChanged = 0;
  let totalUrlsFixed = 0;

  // ============================================
  // TICKETS
  // ============================================
  {
    const collection = db.collection('tickets');
    const cursor = collection.find({
      $or: [
        { 'files.url': { $regex: '^http://.*uploads' } },
        { 'comments.files.url': { $regex: '^http://.*uploads' } },
        { 'comments.images': { $regex: '^http://.*uploads' } }
      ]
    });

    let docsChanged = 0;

    for await (const doc of cursor) {
      let changed = false;
      let urlsFixed = 0;

      if (Array.isArray(doc.files)) {
        doc.files.forEach(f => {
          const fixed = fixUrl(f.url);
          if (fixed !== f.url) { f.url = fixed; changed = true; urlsFixed++; }
        });
      }

      if (Array.isArray(doc.comments)) {
        doc.comments.forEach(c => {
          if (Array.isArray(c.files)) {
            c.files.forEach(f => {
              const fixed = fixUrl(f.url);
              if (fixed !== f.url) { f.url = fixed; changed = true; urlsFixed++; }
            });
          }
          if (Array.isArray(c.images)) {
            c.images = c.images.map(img => {
              const fixed = fixUrl(img);
              if (fixed !== img) { changed = true; urlsFixed++; }
              return fixed;
            });
          }
        });
      }

      if (changed) {
        console.log(`  Ticket ${doc._id} (${doc.ticketNumber || 'no-number'}): ${urlsFixed} URL(s)`);
        if (APPLY) {
          await collection.updateOne(
            { _id: doc._id },
            { $set: { files: doc.files, comments: doc.comments } }
          );
        }
        docsChanged++;
        totalUrlsFixed += urlsFixed;
      }
    }

    console.log(`📋 Tickets: ${docsChanged} document(s) ${APPLY ? 'updated' : 'need updating'}`);
    totalDocsChanged += docsChanged;
  }

  // ============================================
  // FEEDS
  // ============================================
  {
    const collection = db.collection('feeds');
    const cursor = collection.find({
      'comments.files.url': { $regex: '^http://.*uploads' }
    });

    let docsChanged = 0;

    for await (const doc of cursor) {
      let changed = false;
      let urlsFixed = 0;

      if (Array.isArray(doc.comments)) {
        doc.comments.forEach(c => {
          if (Array.isArray(c.files)) {
            c.files.forEach(f => {
              const fixed = fixUrl(f.url);
              if (fixed !== f.url) { f.url = fixed; changed = true; urlsFixed++; }
            });
          }
        });
      }

      if (changed) {
        console.log(`  Feed ${doc._id}: ${urlsFixed} URL(s)`);
        if (APPLY) {
          await collection.updateOne(
            { _id: doc._id },
            { $set: { comments: doc.comments } }
          );
        }
        docsChanged++;
        totalUrlsFixed += urlsFixed;
      }
    }

    console.log(`📋 Feeds: ${docsChanged} document(s) ${APPLY ? 'updated' : 'need updating'}`);
    totalDocsChanged += docsChanged;
  }

  // ============================================
  // PROJECTS
  // ============================================
  {
    const collection = db.collection('projects');
    const cursor = collection.find({
      'comments.files.url': { $regex: '^http://.*uploads' }
    });

    let docsChanged = 0;

    for await (const doc of cursor) {
      let changed = false;
      let urlsFixed = 0;

      if (Array.isArray(doc.comments)) {
        doc.comments.forEach(c => {
          if (Array.isArray(c.files)) {
            c.files.forEach(f => {
              const fixed = fixUrl(f.url);
              if (fixed !== f.url) { f.url = fixed; changed = true; urlsFixed++; }
            });
          }
        });
      }

      if (changed) {
        console.log(`  Project ${doc._id}: ${urlsFixed} URL(s)`);
        if (APPLY) {
          await collection.updateOne(
            { _id: doc._id },
            { $set: { comments: doc.comments } }
          );
        }
        docsChanged++;
        totalUrlsFixed += urlsFixed;
      }
    }

    console.log(`📋 Projects: ${docsChanged} document(s) ${APPLY ? 'updated' : 'need updating'}`);
    totalDocsChanged += docsChanged;
  }

  // ============================================
  // USERS (profileImage)
  // ============================================
  {
    const collection = db.collection('users');
    const cursor = collection.find({
      profileImage: { $regex: '^http://.*uploads' }
    });

    let docsChanged = 0;

    for await (const doc of cursor) {
      const fixed = fixUrl(doc.profileImage);
      if (fixed !== doc.profileImage) {
        console.log(`  User ${doc._id} (${doc.email || doc.name || ''}): profileImage`);
        if (APPLY) {
          await collection.updateOne(
            { _id: doc._id },
            { $set: { profileImage: fixed } }
          );
        }
        docsChanged++;
        totalUrlsFixed++;
      }
    }

    console.log(`📋 Users: ${docsChanged} document(s) ${APPLY ? 'updated' : 'need updating'}`);
    totalDocsChanged += docsChanged;
  }

  console.log('');
  console.log('==================================================');
  console.log(`TOTAL: ${totalDocsChanged} document(s), ${totalUrlsFixed} URL(s) ${APPLY ? 'fixed' : 'would be fixed'}`);
  console.log('==================================================');

  if (!APPLY && totalDocsChanged > 0) {
    console.log('');
    console.log('This was a DRY RUN. Re-run with --apply to write these changes:');
    console.log('  node scripts/migrate-fix-urls.js --apply');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});