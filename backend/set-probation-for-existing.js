// backend/scripts/set-probation-for-existing.js
const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function setProbationForExisting() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const employees = await User.find({
    role: { $nin: ['Admin', 'Super Admin', 'HR', 'Client'] },
    dateOfJoining: { $ne: null }
  });
  
  let updated = 0;
  
  for (const emp of employees) {
    const joiningDate = new Date(emp.dateOfJoining);
    const threeMonthsLater = new Date(joiningDate);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    const now = new Date();
    
    if (now < threeMonthsLater) {
      emp.isProbationary = true;
      emp.probationEndDate = threeMonthsLater;
      await emp.save();
      updated++;
      console.log(`✅ ${emp.name} set on probation until ${threeMonthsLater.toLocaleDateString()}`);
    } else {
      emp.isProbationary = false;
      emp.probationEndDate = null;
      await emp.save();
      console.log(`✅ ${emp.name} probation already completed`);
    }
  }
  
  console.log(`\n📊 Updated ${updated} employees to probation status`);
  process.exit();
}

setProbationForExisting().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});