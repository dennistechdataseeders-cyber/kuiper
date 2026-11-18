// backend/scripts/exportAllCollections.js
//
// Connects to your MongoDB SERVER and saves EVERY database, with ALL of its collections,
// as JSON files in MongoDB Extended JSON (re-insertable: ObjectIds, Dates and numbers
// keep their exact types).
//
// Run from the backend folder:
//
//   node scripts/exportAllCollections.js
//   node scripts/exportAllCollections.js --out "D:\dennis\server_data"
//   node scripts/exportAllCollections.js --uri "mongodb://user:pass@host:27017" --out "D:\dennis\server_data"
//
// Options:
//   --uri <string>        connection string (default: MONGO_URI from backend/.env)
//   --out <folder>        output folder     (default: D:\dennis\server_data)
//   --only db1,db2        export only these databases
//   --include-system      also export the internal admin / local / config databases
//
// Output layout:
//   <out>\<database>\<collection>.json    (one JSON array per collection)
//   <out>\_manifest.json                  (databases, collections, document counts)
//
// Restore one collection later with:
//   mongoimport --uri "<target uri>" --db <database> --collection <name> --file <out>\<database>\<name>.json --jsonArray

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

let EJSON;
try {
  ({ EJSON } = require('bson'));
} catch (e) {
  const driver = require('mongodb');
  EJSON = (driver.BSON && driver.BSON.EJSON) || driver.EJSON;
}
if (!EJSON) {
  console.error('❌ Could not load the EJSON serializer (bson). Run: npm install bson');
  process.exit(1);
}

// ---------- EDIT THIS DEFAULT IF YOU LIKE ----------
const DEFAULT_OUT_DIR = 'D:\\dennis\\server_data';
// ---------------------------------------------------

const argv = process.argv.slice(2);
const getArg = (flag) => {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};

const uri = getArg('--uri') || process.env.MONGO_URI;
const outDir = path.resolve(getArg('--out') || DEFAULT_OUT_DIR);
const onlyDbs = (getArg('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);
const includeSystem = argv.includes('--include-system');
const SYSTEM_DBS = ['admin', 'local', 'config'];

if (!uri) {
  console.error('❌ No Mongo connection string. Set MONGO_URI in backend/.env or pass --uri "<connection string>"');
  process.exit(1);
}

const safeName = (name) => name.replace(/[<>:"/\\|?*]/g, '_');

// write with back-pressure so big collections don't fill memory
const write = (stream, chunk) =>
  new Promise((resolve, reject) => {
    stream.once('error', reject);
    if (stream.write(chunk)) {
      stream.removeListener('error', reject);
      resolve();
    } else {
      stream.once('drain', () => {
        stream.removeListener('error', reject);
        resolve();
      });
    }
  });

const exportCollection = async (db, name, dbDir) => {
  const file = path.join(dbDir, `${safeName(name)}.json`);
  const stream = fs.createWriteStream(file, { encoding: 'utf8' });
  const cursor = db.collection(name).find({});

  let count = 0;
  await write(stream, '[\n');
  for await (const doc of cursor) {
    // canonical Extended JSON keeps exact BSON types (ObjectId, Date, Int32/Int64, Decimal128 ...)
    await write(stream, (count === 0 ? '' : ',\n') + EJSON.stringify(doc, { relaxed: false }));
    count++;
  }
  await write(stream, '\n]\n');
  await new Promise((resolve, reject) => stream.end((err) => (err ? reject(err) : resolve())));
  return count;
};

// every database on the server (falls back to the DB in the URI if the user may not list them)
const getDatabaseNames = async (client) => {
  try {
    const res = await client.db().admin().listDatabases({ nameOnly: true, authorizedDatabases: true });
    return res.databases.map((d) => d.name);
  } catch (err) {
    const fallback = client.db().databaseName;
    console.log(`⚠️  Could not list all databases (${err.message}).`);
    console.log(`   Falling back to the database in the connection string: "${fallback}"\n`);
    return [fallback];
  }
};

(async () => {
  try {
    fs.mkdirSync(outDir, { recursive: true });

    await mongoose.connect(uri);
    const client = mongoose.connection.getClient ? mongoose.connection.getClient() : mongoose.connection.client;
    console.log('✅ Connected to MongoDB server');
    console.log(`📁 Saving to: ${outDir}\n`);

    let dbNames = (await getDatabaseNames(client)).sort();
    if (onlyDbs.length) {
      dbNames = dbNames.filter((n) => onlyDbs.includes(n));
    } else if (!includeSystem) {
      dbNames = dbNames.filter((n) => !SYSTEM_DBS.includes(n));
    }

    if (dbNames.length === 0) {
      console.log('⚠️  No databases to export.');
      process.exit(0);
    }

    const manifest = {
      exportedAt: new Date().toISOString(),
      format: 'MongoDB Extended JSON (canonical), one JSON array per collection',
      databases: {},
    };

    let totalCollections = 0;
    let totalDocs = 0;

    for (const dbName of dbNames) {
      const db = client.db(dbName);
      const dbDir = path.join(outDir, safeName(dbName));
      fs.mkdirSync(dbDir, { recursive: true });

      const collections = (await db.listCollections({}, { nameOnly: false }).toArray())
        .filter((c) => c.type !== 'view' && !c.name.startsWith('system.'))
        .map((c) => c.name)
        .sort();

      console.log(`🗄️  Database: ${dbName}  (${collections.length} collections)`);
      manifest.databases[dbName] = {};

      for (const name of collections) {
        process.stdout.write(`   ⏳ ${name} ... `);
        const count = await exportCollection(db, name, dbDir);
        manifest.databases[dbName][name] = count;
        totalCollections++;
        totalDocs += count;
        console.log(`${count} documents`);
      }
      console.log('');
    }

    fs.writeFileSync(path.join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    console.log(`✅ Done: ${dbNames.length} databases, ${totalCollections} collections, ${totalDocs} documents`);
    console.log(`   Folder: ${outDir}`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Export failed:', err.message);
    process.exit(1);
  }
})();