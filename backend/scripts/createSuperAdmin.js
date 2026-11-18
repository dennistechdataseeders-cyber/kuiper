// backend/scripts/createSuperAdmin.js
//
// Creates (or resets) a Super Admin login.
//
// 1) Edit the DEFAULTS below, or pass values on the command line.
// 2) Run from the backend folder:
//
//      node scripts/createSuperAdmin.js
//      node scripts/createSuperAdmin.js --email boss@company.com --password "Str0ng#Pass" --name "Dennis"
//      node scripts/createSuperAdmin.js --reset     (existing user: reset password + make Super Admin)
//
// Uses MONGO_URI from backend/.env (same as server.js). The password is hashed with
// bcryptjs (10 rounds), exactly like seedAdmin.js, so normal login works.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// ---------- EDIT THESE ----------
const DEFAULTS = {
  name: 'Super Admin',
  email: 'superadmin@example.com',
  password: 'ChangeMe@123',
};
// --------------------------------

const argv = process.argv.slice(2);
const getArg = (flag) => {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const RESET = argv.includes('--reset');

const name = getArg('--name') || DEFAULTS.name;
const email = (getArg('--email') || DEFAULTS.email).trim().toLowerCase();
const password = getArg('--password') || DEFAULTS.password;

(async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/kuiper';
    await mongoose.connect(uri);
    console.log(`✅ Connected to MongoDB (${mongoose.connection.name})`);

    const hashed = await bcrypt.hash(password, 10);
    const existing = await User.findOne({ email });

    if (existing) {
      if (!RESET) {
        console.log(`⚠️  A user with ${email} already exists (role: ${existing.role}).`);
        console.log('   Nothing changed. Re-run with --reset to set this password and make them Super Admin.');
        process.exit(0);
      }
      existing.password = hashed;
      existing.role = 'Super Admin';
      existing.isActive = true;
      existing.accessBlockedFrom = null;
      await existing.save();
      console.log(`✅ Updated ${email}: role = Super Admin, password reset.`);
    } else {
      await User.create({
        name,
        email,
        password: hashed,
        role: 'Super Admin',
        department: 'Other',
        isActive: true,
      });
      console.log('✅ Super Admin created');
    }

    console.log('   Email   :', email);
    console.log('   Password:', password);
    console.log('   Change this password after your first login.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();