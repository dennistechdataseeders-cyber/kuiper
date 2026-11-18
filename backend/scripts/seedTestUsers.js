// backend/scripts/seedTestUsers.js
//
// Creates ONE test login per role (emails end in @kuiper.test), verifies each login,
// and writes the credentials to scripts/output/test-accounts.{docx,csv} (git-ignored).
//
// Usage:
//   node scripts/seedTestUsers.js                 -> prints target DB, does nothing
//   node scripts/seedTestUsers.js --confirm       -> seeds (refuses if test users already exist)
//   node scripts/seedTestUsers.js --confirm --reset
//                                                 -> deletes ONLY @kuiper.test users and the
//                                                    seeded Test Organization, then seeds
//   --force-prod                                  -> required for any non-local / prod-looking DB
//   --no-data                                     -> users only; skip dummy projects, feeds, tickets, leads, announcements
//
// Users are written straight through the model, so no welcome email (sent only by
// POST /api/admin/users) or zohoMailer notification is triggered.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { seedTestData, removeTestData } = require('./testData');

const args = new Set(process.argv.slice(2));
const CONFIRM = args.has('--confirm');
const RESET = args.has('--reset');
const FORCE_PROD = args.has('--force-prod');
const NO_DATA = args.has('--no-data');   // skip dummy projects / feeds / tickets / leads / announcements

const TEST_DOMAIN = '@kuiper.test';
const TEST_EMAIL_REGEX = /@kuiper\.test$/i;
// The seeded org is tagged by name AND website so --reset never removes a real
// organisation that happens to be called "Test Organization".
const TEST_ORG = { companyName: 'Test Organization', website: 'https://kuiper.test' };

const OUTPUT_DIR = path.join(__dirname, 'output');
const API_BASE_URL = (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const LOGIN_URL = `${FRONTEND_URL}/login`;

// Role -> extra fields and notes. Landing paths come from frontend/src/App.jsx (landingPath).
const ROLES = [
  { role: 'Super Admin', department: 'Other', landing: '/admin' },
  { role: 'Admin', department: 'Other', landing: '/admin' },
  { role: 'Project Manager', department: 'Other', landing: '/admin/projects' },
  { role: 'Project Coordinator', department: 'Other', landing: '/admin/projects' },
  { role: 'Team Lead', department: 'Developer', landing: '/teamlead' },
  // Second accounts so projects can have several coordinators / team leads
  { role: 'Project Coordinator', suffix: '2', department: 'Other', landing: '/admin/projects' },
  { role: 'Team Lead', suffix: '2', department: 'Developer', landing: '/teamlead' },
  { role: 'Developer', department: 'Developer', landing: '/developer' },
  { role: 'Sales Manager', department: 'Sales', landing: '/sales-manager' },
  { role: 'Sales', department: 'Sales', landing: '/sales' },
  { role: 'HR', department: 'HR', landing: '/hr' },
  { role: 'Finance', department: 'Finance', landing: '/tickets' },
  { role: 'Client', department: 'Other', landing: '/client', org: true, primaryPOC: true },
  {
    role: 'POC', department: 'Other', landing: null, org: true,
    warning: 'No frontend dashboard for POC (App.jsx landingPath has no POC entry) - token works, UI will not open a dashboard',
  },
];

// ---------- helpers ----------

const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ';   // no I, L, O
const LOWER = 'abcdefghijkmnpqrstuvwxyz';  // no l, o
const DIGITS = '23456789';                 // no 0, 1
const SYMBOLS = '!@#$%&*';
const pick = (set) => set[crypto.randomInt(set.length)];

function generatePassword(length = 12) {
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {           // Fisher-Yates with crypto
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const randomSuffix = (n = 4) => Array.from({ length: n }, () => pick(LOWER + DIGITS)).join('');
const slugify = (role) => role.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Parse host(s) and db name without ever printing credentials.
function describeUri(uri) {
  const m = /^(mongodb(?:\+srv)?):\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/i.exec(uri || '');
  if (!m) return null;
  return { scheme: m[1].toLowerCase(), hosts: m[2].split(','), db: m[3] || '(default: test)' };
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|::1|[^:]+\.localhost)(:\d+)?$/i;
const DEV_MARKER = /(^|[.\-_])(dev|test|staging|stage|local|qa|sandbox)([.\-_]|$)/i;

function productionReason(uri, info) {
  if (/prod/i.test(uri)) return 'URI contains "prod"';
  const allLocal = info.hosts.every((h) => LOCAL_HOST.test(h));
  if (allLocal) return null;
  const isAtlas = info.scheme === 'mongodb+srv' || info.hosts.some((h) => /mongodb\.net/i.test(h));
  const clearlyDev = info.hosts.every((h) => DEV_MARKER.test(h.replace(/:\d+$/, ''))) || DEV_MARKER.test(info.db);
  if (clearlyDev) return null;
  return isAtlas
    ? 'Atlas cluster that is not clearly dev/test'
    : 'remote host that is not clearly dev/test (the commented prod URI in .env is a bare IP)';
}

async function tryApiLogin(email, password) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.token) return { ok: true, detail: 'token received' };
    return { ok: false, detail: `HTTP ${res.status}: ${body.error || body.message || 'no token'}` };
  } catch (err) {
    return { ok: null, detail: `backend not reachable (${err.cause?.code || err.name})` };
  }
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function writeDocx(rows, meta) {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
    HeadingLevel, Footer, AlignmentType, PageOrientation, ShadingType,
  } = require('docx');

  const headers = ['Role', 'Name', 'Email', 'Password', 'Login check', 'Notes'];
  const widths = [11, 15, 27, 13, 9, 25];
  const cell = (text, { bold = false, shade } = {}, i = 0) => new TableCell({
    width: { size: widths[i], type: WidthType.PERCENTAGE },
    shading: shade ? { type: ShadingType.CLEAR, fill: shade, color: 'auto' } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: String(text), bold, font: i === 3 ? 'Consolas' : undefined, size: 18 })] })],
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, { bold: true, shade: 'D9E2F3' }, i)) }),
      ...rows.map((r) => new TableRow({
        children: [r.role, r.name, r.email, r.password, r.check, r.notes].map((v, i) =>
          cell(v, i === 4 ? { bold: true, shade: r.check === 'PASS' ? 'E2EFDA' : 'F8CBAD' } : {}, i)),
      })),
    ],
  });

  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Test credentials – local/dev only. Do not share.', italics: true, size: 18 })] })],
        }),
      },
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('KUIPER – Test Accounts')] }),
        new Paragraph({ children: [new TextRun({ text: 'Generated: ', bold: true }), new TextRun(meta.generatedAt)] }),
        new Paragraph({ children: [new TextRun({ text: 'Database: ', bold: true }), new TextRun(`${meta.db} on ${meta.host}`)] }),
        new Paragraph({ children: [new TextRun({ text: 'Login URL: ', bold: true }), new TextRun(meta.loginUrl)] }),
        new Paragraph({ children: [new TextRun({ text: 'Login API checked: ', bold: true }), new TextRun(meta.apiChecked)] }),
        new Paragraph({ children: [new TextRun({ text: 'Dummy data: ', bold: true }), new TextRun(meta.dummyData)] }),
        new Paragraph({ text: '' }),
        table,
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Re-seed with: npm run seed:testusers:reset (deletes only @kuiper.test users, the dummy data they own, and the seeded Test Organization).', size: 18 })] }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const file = path.join(OUTPUT_DIR, 'test-accounts.docx');
  try {
    fs.writeFileSync(file, buffer);
    return file;
  } catch (err) {
    if (!['EBUSY', 'EPERM', 'EACCES'].includes(err.code)) throw err;
    // Usually the previous copy is open in Word - write a timestamped copy instead
    const alt = path.join(OUTPUT_DIR, `test-accounts-${new Date().toISOString().replace(/[:.]/g, '-')}.docx`);
    fs.writeFileSync(alt, buffer);
    console.warn(`\ntest-accounts.docx is locked (open in Word?) - wrote ${path.basename(alt)} instead.`);
    return alt;
  }
}

// ---------- main ----------

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set in backend/.env');
  const info = describeUri(uri);
  if (!info) throw new Error('MONGO_URI is not a mongodb:// or mongodb+srv:// URI');

  console.log(`Target database host: ${info.hosts.join(', ')}`);
  console.log(`Target database name: ${info.db}`);

  const prodReason = productionReason(uri, info);
  if (prodReason && !FORCE_PROD) {
    console.error(`\nRefusing: this looks like production (${prodReason}). Pass --force-prod to override.`);
    process.exit(2);
  }
  if (!CONFIRM) {
    console.log('\nDry run - nothing written. Re-run with --confirm (add --reset to replace existing test users).');
    process.exit(0);
  }

  await mongoose.connect(uri);
  const dbName = mongoose.connection.name;
  const dbHost = `${mongoose.connection.host}:${mongoose.connection.port}`;
  console.log(`Connected to ${dbName} on ${dbHost}`);

  const existing = await User.countDocuments({ email: TEST_EMAIL_REGEX });
  if (RESET) {
    const testIds = (await User.find({ email: TEST_EMAIL_REGEX }).select('_id').lean()).map((x) => x._id);
    const delData = await removeTestData(testIds);
    const dataSummary = Object.entries(delData).map(([k, v]) => `${v} ${k}`).join(', ');
    if (dataSummary) console.log(`Reset: removed dummy data owned by test users (${dataSummary}).`);
    const delUsers = await User.deleteMany({ email: TEST_EMAIL_REGEX });
    const delOrgs = await Organization.deleteMany(TEST_ORG);
    console.log(`Reset: removed ${delUsers.deletedCount} @kuiper.test user(s) and ${delOrgs.deletedCount} Test Organization(s).`);
  } else if (existing > 0) {
    console.error(`\n${existing} @kuiper.test user(s) already exist. Run with --reset to replace them.`);
    await mongoose.disconnect();
    process.exit(3);
  }

  let org = await Organization.findOne(TEST_ORG);
  if (!org) {
    org = await Organization.create({ ...TEST_ORG, status: 'Active', pocName: 'Test Client', pocEmail: `test.client${TEST_DOMAIN}` });
    console.log('Created Test Organization.');
  } else {
    console.log('Reusing existing Test Organization.');
  }

  // Create users (passwords kept in memory only)
  const created = [];
  for (const spec of ROLES) {
    const label = spec.suffix ? `${spec.role} ${spec.suffix}` : spec.role;
    const slug = slugify(label);
    const email = `test.${slug}.${randomSuffix()}${TEST_DOMAIN}`;
    const password = generatePassword();
    const doc = {
      name: `Test ${label}`,
      email,
      password: await bcrypt.hash(password, 10),
      role: spec.role,
      department: spec.department,
      isActive: true,
      accessBlockedFrom: null,
    };
    if (spec.org) {
      doc.organizationId = org._id;
      doc.clientType = 'organization';
      doc.isPrimaryPOC = !!spec.primaryPOC;
    }
    const user = await User.create(doc);
    created.push({ spec, user, password });
    console.log(`Created ${label.padEnd(16)} ${email}`);
  }

  const client = created.find((c) => c.spec.role === 'Client');
  if (client) await Organization.updateOne({ _id: org._id }, { $set: { clientUserId: client.user._id } });

  // Dummy data (projects, feeds, tickets, leads, announcements) linked to the test users
  let dataCounts = null;
  if (!NO_DATA) {
    const byRole = Object.fromEntries(created.map((c) => [c.spec.suffix ? `${c.spec.role} ${c.spec.suffix}` : c.spec.role, c.user]));
    dataCounts = await seedTestData(byRole, org);
    console.log(`Dummy data: ${Object.entries(dataCounts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  }

  // Verify
  const rows = [];
  let apiReachable = false;
  for (const { spec, user, password } of created) {
    const fresh = await User.findById(user._id).select('+password');
    const hashOk = !!fresh && await bcrypt.compare(password, fresh.password);
    const api = await tryApiLogin(user.email, password);
    if (api.ok !== null) apiReachable = true;
    const pass = hashOk && api.ok !== false;

    const notes = [];
    if (spec.org) notes.push('linked to Test Organization');
    notes.push(spec.landing ? `lands on ${spec.landing}` : 'no landing page');
    if (spec.warning) notes.push(spec.warning);
    if (!hashOk) notes.push('bcrypt.compare failed');
    if (api.ok === false) notes.push(`API login failed: ${api.detail}`);

    rows.push({
      role: spec.suffix ? `${spec.role} (${spec.suffix})` : spec.role, name: user.name, email: user.email, password,
      check: pass ? 'PASS' : 'FAIL',
      bcrypt: hashOk ? 'ok' : 'FAIL',
      api: api.ok === true ? 'ok' : api.ok === false ? 'FAIL' : 'skipped',
      notes: notes.join('; '),
    });
  }

  await mongoose.disconnect();

  // Outputs
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const meta = {
    generatedAt: new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'long' }),
    db: dbName, host: dbHost, loginUrl: LOGIN_URL,
    apiChecked: apiReachable ? `${API_BASE_URL}/api/auth/login` : 'backend not reachable - bcrypt check only',
    dummyData: dataCounts
      ? `${Object.entries(dataCounts).map(([k, v]) => `${v} ${k}`).join(', ')}. Projects are managed by Test Project Manager or Test Project Coordinator; Test Project Coordinator 2 and Test Team Lead / Team Lead 2 are added through project teams (the Ecommerce project has 2 coordinators and 2 team leads); Test Developer is on the feeds; Test Client is on every project.`
      : 'not seeded (--no-data)',
  };
  const csvPath = path.join(OUTPUT_DIR, 'test-accounts.csv');
  const csv = [
    ['Role', 'Name', 'Email', 'Password', 'Login check', 'Notes'],
    ...rows.map((r) => [r.role, r.name, r.email, r.password, r.check, r.notes]),
  ].map((line) => line.map(csvCell).join(',')).join('\n');
  fs.writeFileSync(csvPath, `${csv}\n# Database: ${dbName} on ${dbHost}\n# Login URL: ${LOGIN_URL}\n# Test credentials – local/dev only. Do not share.\n`);
  const docxPath = await writeDocx(rows, meta);

  // Final summary (the only place passwords are printed)
  console.log(`\nLogin URL: ${LOGIN_URL}`);
  console.log(`Login API: ${meta.apiChecked}\n`);
  console.table(rows.map((r) => ({ Role: r.role, Email: r.email, Password: r.password, bcrypt: r.bcrypt, API: r.api, Result: r.check })));
  console.log(`\nWrote ${docxPath}`);
  console.log(`Wrote ${csvPath}`);

  const failed = rows.filter((r) => r.check === 'FAIL');
  if (failed.length) {
    console.log(`\n${failed.length} role(s) FAILED:`);
    failed.forEach((r) => console.log(`  - ${r.role}: ${r.notes}`));
    process.exitCode = 1;
  }
  const warned = ROLES.filter((s) => s.warning);
  if (warned.length) {
    console.log('\nWarnings:');
    warned.forEach((s) => console.log(`  - ${s.role}: ${s.warning}`));
  }
}

main().catch(async (err) => {
  console.error('Seeding failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
