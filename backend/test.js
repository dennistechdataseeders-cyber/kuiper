const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// mock block removed — real zohoMailer.js will be used

const leaveBucketService = require('./services/leaveBucketService');

async function testYearEnd() {
  await mongoose.connect(process.env.MONGO_URI);
  leaveBucketService.getISTDate = () => new Date('2027-04-01T00:00:00+05:30');

  console.log(await leaveBucketService.sendFinancialYearReport());
  process.exit(0);
}
testYearEnd().catch(e => { console.error(e); process.exit(1); });