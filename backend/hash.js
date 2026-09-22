// backend/check-hash.js
const bcrypt = require('bcryptjs');

const storedHash = '$2b$10$hKckUi.WwFKjRE0L6FWbFuduMPHWabVV2qHXTSi52uWNwrDq6oXm6';

const candidates = [
  'password123',
  'password',
  'admin123',
  'Admin@123',
  'welcome123',
  'test123',
];

(async () => {
  for (const candidate of candidates) {
    const match = await bcrypt.compare(candidate, storedHash);
    if (match) {
      console.log(`✅ MATCH: "${candidate}"`);
      process.exit(0);
    } else {
      console.log(`❌ no match: "${candidate}"`);
    }
  }
  console.log('\nNone of the candidates matched.');
})();