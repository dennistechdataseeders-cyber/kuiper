// backend/seed/ticketCategoryDefaults.js
// Starting data = the lists that used to be hard-coded in CreateTicket.jsx,
// plus the new Development > Feasibility > New Feasibility option.
const sub = (name, items = [], extra = {}) => ({ name, items, ...extra });

module.exports = [
  { name: 'Finance', icon: '💰', color: 'emerald', role: 'Finance', subcategories: [
    sub('Reimbursement', ['Employee Expense Claim', 'Client Meeting Expense', 'Travel Expense', 'Internet/Mobile Expense', 'Office Purchase Expense']),
    sub('Payment Requests', ['Vendor Payment', 'Advance Payment', 'Contractor Payment']),
    sub('Invoice Management', ['Generate Invoice', 'Revise Invoice', 'Client Billing Query']),
  ]},
  { name: 'HR', icon: '👥', color: 'pink', role: 'HR', subcategories: [
    sub('Employee Documents', ['Employment Letter', 'Salary Certificate', 'Experience Letter']),
    sub('Attendance & Leave', ['Attendance Correction', 'Leave Regularization', 'Leave Approval']),
    sub('Employee Management', ['Onboarding', 'Exit Process', 'Promotion Request']),
  ]},
  { name: 'Payroll', icon: '💳', color: 'blue', role: 'Finance', subcategories: [
    sub('Salary', ['Salary Query', 'Salary Correction', 'Missing Salary']),
    sub('Incentives', ['Bonus', 'Incentive Calculation', 'Commission Query']),
    sub('Tax & Deductions', ['TDS Query', 'PF Query']),
  ]},
  { name: 'Sales', icon: '📊', color: 'orange', role: 'Sales', subcategories: [
    sub('Lead Management', ['Lead Assignment', 'Lead Designation']),
    sub('Proposal & Pricing', ['Proposal Creation', 'Pricing Approval', 'Dispute Agreement']),
    sub('Client Support', ['Contact Review', 'VDA Request', 'Client Escalation']),
  ]},
  { name: 'Production', icon: '⚙️', color: 'red', role: 'Developer', clientVisible: true,
    // Developers raise Production tickets TO Team Leads (existing behaviour)
    assignOverrides: [{ creatorRoles: ['Developer'], assignRole: 'Team Lead' }],
    subcategories: [
      sub('Data Extraction', ['Feed Not Working', 'Feed Missing Data', 'Feed Shortage Outage', 'Scripts Issues', 'Proxy']),
      sub('Data Quality', ['Duplicate Records', 'Missing Fields', 'Incorrect Shipping']),
      sub('Delivery', ['Delivery Delayed', 'Delivery Failed', 'API Delivery Issue']),
      sub('Maintenance', ['New Feed Request', 'Editing Feed Enhancement']),
      sub('Feasibility', [], { special: true, clientVisible: false }),
      sub('Others', [], { special: true, clientVisible: false }),
      sub('KUIPER', ['Report Bug', 'Latency', 'Request New Feature', 'Login Issue', 'Forget Password', 'Forget Username']),
    ]},
  { name: 'Admin', icon: '🛠️', color: 'gray', role: 'Admin', subcategories: [
    sub('Agency', ['Lease Request', 'Uptime Delay', 'Asset Return']),
    sub('Procurement', ['Machine Purchase', 'Software Purchase']),
    sub('Facilities', ['Internet Link', 'Office Workstation']),
    sub('IT', ['Asset Management', 'Email Access', 'Database Access', 'Server Access']),
    sub('Technical Support', ['System Reset']),
  ]},
  { name: 'IT', icon: '💻', color: 'cyan', role: 'IT', subcategories: [
    sub('Access Management', ['Email Access', 'Database Access', 'Server Access']),
    sub('Technical/Support', ['System Reset']),
    sub('Software Tools', ['Hardware Issues']),
  ]},
  { name: 'Development', icon: '🚀', color: 'violet', role: 'Developer', subcategories: [
    sub('New Feature Request', ['Requirements Request', 'Bug Report']),
    // NEW: Sales / Sales Manager raise this to a Project Manager instead of a developer
    sub('Feasibility', ['New Feasibility'], {
      assignOverrides: [{ creatorRoles: ['Sales', 'Sales Manager'], assignRole: 'Project Manager' }]
    }),
  ]},
].map((c, i) => ({ ...c, order: i }));