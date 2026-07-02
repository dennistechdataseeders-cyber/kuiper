// backend/seedTicketRules.js
const mongoose = require('mongoose');
require('dotenv').config(); // ← ADD THIS LINE AT THE TOP
const TicketAssignmentRule = require('./models/TicketAssignmentRule');

const initialRules = [
  // HR & Admin
  { category: 'HR', subcategory: '', subItem: '', assigneeEmail: 'hr.dataseeders@gmail.com', assigneeName: 'HR Team', priority: 2 },
  { category: 'Admin', subcategory: '', subItem: '', assigneeEmail: 'hr.dataseeders@gmail.com', assigneeName: 'HR Team', priority: 1 },
  
  // Finance & Payroll
  { category: 'Payroll', subcategory: '', subItem: '', assigneeEmail: 'finops@techdataseeders.in', assigneeName: 'Finance Team', priority: 2 },
  { category: 'Finance', subcategory: '', subItem: '', assigneeEmail: 'finops@techdataseeders.in', assigneeName: 'Finance Team', priority: 1 },
  
  // Sales
  { category: 'Sales', subcategory: '', subItem: '', assigneeEmail: 'sales@techdataseeders.in', assigneeName: 'Sales Team', priority: 1 },
  
  // Technical / Development / Production / IT
  { category: 'Production', subcategory: '', subItem: '', assigneeEmail: 'dakshesh@techdataseeders.in', assigneeName: 'Tech Support', priority: 1 },
  { category: 'IT', subcategory: '', subItem: '', assigneeEmail: 'dakshesh@techdataseeders.in', assigneeName: 'Tech Support', priority: 1 },
  { category: 'Development', subcategory: '', subItem: '', assigneeEmail: 'dakshesh@techdataseeders.in', assigneeName: 'Tech Support', priority: 1 },
  { category: 'Production', subcategory: 'Feasibility', subItem: '', assigneeEmail: 'dakshesh@techdataseeders.in', assigneeName: 'Tech Support', priority: 3 },
  
  // More specific rules (higher priority)
  { category: 'Production', subcategory: 'KUIPER', subItem: 'Report Bug', assigneeEmail: 'dakshesh@techdataseeders.in', assigneeName: 'Dev Support', priority: 4 }
];

async function seedRules() {
  try {
    // Check if MONGO_URI is defined
    if (!process.env.MONGO_URI) {
      console.error('❌ MONGO_URI is not defined in .env file');
      console.log('💡 Please make sure you have a .env file in the backend directory with MONGO_URI defined.');
      process.exit(1);
    }
    
    console.log(`🔗 Connecting to MongoDB: ${process.env.MONGO_URI.replace(/\/\/.*@/, '//<credentials>@')}`);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Clear existing rules
    const deleted = await TicketAssignmentRule.deleteMany({});
    console.log(`🗑️ Cleared ${deleted.deletedCount} existing rules`);
    
    // Insert new rules
    const inserted = await TicketAssignmentRule.insertMany(initialRules);
    console.log(`✅ Seeded ${inserted.length} assignment rules`);
    
    // List all inserted rules
    console.log('\n📋 Seeded Rules:');
    inserted.forEach((rule, index) => {
      console.log(`  ${index + 1}. ${rule.category}${rule.subcategory ? ` → ${rule.subcategory}` : ''}${rule.subItem ? ` → ${rule.subItem}` : ''} → ${rule.assigneeEmail} (Priority: ${rule.priority})`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding rules:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Run the seed function
seedRules();