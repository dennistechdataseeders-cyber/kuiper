// backend/scripts/ensureIndexes.js
//
// Builds every index declared in the Mongoose models that is missing in the database.
// It never drops or changes existing indexes, so it is safe to run more than once.
//
//   node scripts/ensureIndexes.js            -> shows the target DB and what is missing
//   node scripts/ensureIndexes.js --confirm  -> creates the missing indexes
//
// On production run it once after deploying (off-peak is best; MongoDB builds indexes
// without blocking reads/writes for long, but it does use CPU/IO on big collections).
//
// Check that a query uses an index (mongosh):
//   db.tickets.find({ assignedTo: ObjectId('...') }).sort({ createdAt: -1 }).explain('executionStats')
//   -> winningPlan should contain IXSCAN (not COLLSCAN); compare totalDocsExamined with nReturned.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const mongoose = require('mongoose');

const CONFIRM = process.argv.includes('--confirm');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  const host = (/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/i.exec(uri) || [])[1];
  await mongoose.connect(uri, { autoIndex: false });
  console.log(`Database: ${mongoose.connection.name} on ${host}${CONFIRM ? '' : '  (dry run - add --confirm to create)'}\n`);

  // load every model file
  const dir = path.join(__dirname, '..', 'models');
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.js')) require(path.join(dir, f));

  let missingTotal = 0;
  for (const name of mongoose.modelNames().sort()) {
    const Model = mongoose.model(name);
    const declared = Model.schema.indexes(); // [ [fields, options], ... ]
    if (!declared.length) continue;
    let existing = [];
    try { existing = await Model.collection.indexes(); } catch { /* collection does not exist yet */ }
    const have = new Set(existing.map((i) => JSON.stringify(i.key)));
    const hasText = existing.some((i) => i.key && i.key._fts === 'text'); // text indexes are stored as {_fts, _ftsx}
    const isText = (fields) => Object.values(fields).includes('text');
    const missing = declared.filter(([fields]) => (isText(fields) ? !hasText : !have.has(JSON.stringify(fields))));
    if (!missing.length) continue;
    missingTotal += missing.length;
    console.log(`${name} (${Model.collection.collectionName}): ${missing.length} missing`);
    for (const [fields, opts] of missing) {
      const label = `  ${JSON.stringify(fields)}${opts && opts.unique ? ' unique' : ''}`;
      if (!CONFIRM) { console.log(label); continue; }
      const t = Date.now();
      try {
        await Model.collection.createIndex(fields, { background: true, ...opts });
        console.log(`${label}  created in ${Date.now() - t} ms`);
      } catch (err) {
        console.log(`${label}  FAILED: ${err.message}`);
      }
    }
  }
  console.log(missingTotal ? `\n${missingTotal} index(es) ${CONFIRM ? 'processed' : 'missing'}.` : 'All declared indexes exist.');
  await mongoose.disconnect();
}

main().catch(async (e) => { console.error(e.message); await mongoose.disconnect().catch(() => {}); process.exit(1); });
