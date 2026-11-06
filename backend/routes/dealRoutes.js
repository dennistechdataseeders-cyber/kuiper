// backend/routes/dealRoutes.js
const router = require('express').Router();
const Deal = require('../models/Deal');
const { CONTACT_ROLES } = require('../models/Deal');
const DealStage = require('../models/DealStage');
const Lead = require('../models/Lead');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

router.use(protect);

const POC_DEPARTMENTS = ['CEO', 'CTO', 'Sales', 'Marketing', 'Support', 'Developer', 'Other'];
const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());

// ✅ Helper: validates a stage name against the DealStage collection
//    (auto-seeds the defaults on the very first request).
async function validateStageName(rawStage) {
  const name = clean(rawStage);
  if (!name) return { ok: false, error: 'Stage is required' };

  // Seed defaults on first use so a brand-new install can convert a lead
  // without a separate bootstrap step.
  if ((await DealStage.estimatedDocumentCount()) === 0) {
    const defaults = [
      { name: 'Qualification',              probability: 10 },
      { name: 'Needs Analysis',             probability: 20 },
      { name: 'Value Proposition',          probability: 40 },
      { name: 'Identify Decision Makers',   probability: 60 },
      { name: 'Proposal/Price Quote',       probability: 75 },
      { name: 'Negotiation/Review',         probability: 90 },
      { name: 'Closed Won',                 probability: 100, locked: true },
      { name: 'Closed Lost',                probability: 0,   locked: true },
      { name: 'Closed Lost to Competition', probability: 0,   locked: true }
    ].map((s, i) => ({ ...s, nameKey: s.name.toLowerCase(), order: i + 1 }));
    try {
      await DealStage.insertMany(defaults, { ordered: false });
    } catch (e) {
      // Concurrent seeds — the unique index rejects the dupes. Safe to ignore.
    }
  }

  const found = await DealStage.findOne({ name });
  if (!found) return { ok: false, error: 'Invalid Stage' };
  return { ok: true, stage: found.name };
}

// ============================================
// GET /api/deals — list
// ============================================
router.get('/', async (req, res) => {
  try {
    const { search, stage, organizationId } = req.query;
    const filter = {};
    if (stage) filter.stage = stage;
    if (organizationId) filter.organizationId = organizationId;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ dealName: rx }, { contactName: rx }];
    }

    const deals = await Deal.find(filter)
      .populate('organizationId', 'companyName website')
      .populate('owner', 'name email')
      .populate('leadId', 'companyName')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: deals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET /api/deals/:id
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate('organizationId')
      .populate('owner', 'name email')
      .populate('leadId')
      .populate('createdBy', 'name email');
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    res.json({ success: true, data: deal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// POST /api/deals/convert/:leadId
// Lead -> Deal, and the lead's details flow into Account + Contact.
// ============================================
router.post('/convert/:leadId', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  let createdOrgId = null; // for cleanup if the Deal itself fails to save

  try {
    const {
      dealName, amount, closingDate, stage, contactRole, ownerId,
      accountMode,   // 'new' (default) | 'existing'
      accountId,     // required when accountMode === 'existing'
      customFields   // values of fields created in Customize Modules → Deals
    } = req.body;

    // ---------- validate ----------
    if (!clean(closingDate)) return res.status(400).json({ error: 'Closing Date cannot be empty.' });
    if (isNaN(new Date(closingDate).getTime())) return res.status(400).json({ error: 'Closing Date is invalid.' });
    if (!clean(dealName)) return res.status(400).json({ error: 'Deal Name is required' });

    // ✅ Stage validated against the DealStage collection (no more enum)
    const stageCheck = await validateStageName(stage || 'Qualification');
    if (!stageCheck.ok) return res.status(400).json({ error: stageCheck.error });
    const finalStage = stageCheck.stage;

    const finalRole = clean(contactRole);
    if (finalRole && !CONTACT_ROLES.includes(finalRole)) {
      return res.status(400).json({ error: 'Invalid Contact Role' });
    }

    const finalAmount = clean(amount) === '' ? 0 : Number(amount);
    if (Number.isNaN(finalAmount) || finalAmount < 0) {
      return res.status(400).json({ error: 'Amount must be a valid number' });
    }

    const lead = await Lead.findById(req.params.leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (lead.isConverted) return res.status(409).json({ error: 'This lead has already been converted to a Deal' });

    const finalOwnerId = ownerId || req.user._id;
    const ownerUser = await User.findById(finalOwnerId).select('_id');
    if (!ownerUser) return res.status(400).json({ error: 'Selected owner not found' });

    // ---------- 1. ACCOUNT ----------
    let org = null;
    let accountCreated = false;

    if (accountMode === 'existing') {
      if (!accountId) return res.status(400).json({ error: 'Please choose an existing Account' });
      org = await Organization.findById(accountId);
      if (!org) return res.status(404).json({ error: 'Selected Account not found' });
    } else {
      // "Create New Account" — but never duplicate a company that already exists (case-insensitive)
      org = await Organization.findOne({
        companyName: { $regex: new RegExp(`^${escapeRegex(lead.companyName)}$`, 'i') }
      });
      if (!org) {
        org = await Organization.create({
          companyName: lead.companyName,
          website: lead.website || '',
          address: [lead.address?.flatHouse, lead.address?.streetAddress, lead.address?.city,
                    lead.address?.stateProvince, lead.address?.zipPostalCode, lead.address?.countryRegion]
                    .map(clean).filter(Boolean).join(', '),
          addressDetails: lead.address || {},
          industry: lead.industry || undefined,
          noOfEmployees: lead.noOfEmployees || undefined,
          salesRepId: ownerUser._id,
          status: 'New',
          pointsOfContact: []
        });
        accountCreated = true;
        createdOrgId = org._id;
      }
    }

    // ---------- 2. CONTACT (POC inside the Account) ----------
    const primary = (lead.contacts || []).find(c => c.isPrimary) || (lead.contacts || [])[0];
    let contactId = null;
    let contactName = '';

    if (primary) {
      const first = clean(primary.firstName);
      const last = clean(primary.lastName) === '-' ? '' : clean(primary.lastName);
      contactName = [first, last].filter(Boolean).join(' ') || lead.companyName;
      const email = clean(primary.email);

      const matches = (p) =>
        (p.pocName && p.pocName.toLowerCase() === contactName.toLowerCase()) ||
        (email && p.pocEmail && p.pocEmail.toLowerCase() === email.toLowerCase());

      let existingPoc = (org.pointsOfContact || []).find(matches);

      if (!existingPoc) {
        const isFirst = !org.pointsOfContact || org.pointsOfContact.length === 0;
        await Organization.updateOne({ _id: org._id }, {
          $push: {
            pointsOfContact: {
              pocName: contactName,
              pocEmail: email || undefined,
              pocPhone: clean(primary.phone) || clean(primary.mobile) || undefined,
              mobile: clean(primary.mobile) || undefined,
              title: clean(primary.title) || undefined,
              department: POC_DEPARTMENTS.includes(primary.department) ? primary.department : 'Other',
              isPrimary: isFirst,
              addedAt: new Date()
            }
          }
        });
        const fresh = await Organization.findById(org._id);
        existingPoc = (fresh.pointsOfContact || []).find(matches);
      }
      contactId = existingPoc?._id || null;
    }

    // ---------- 3. DEAL ----------
    const deal = await Deal.create({
      dealName: clean(dealName),
      amount: finalAmount,
      closingDate: new Date(closingDate),
      stage: finalStage,
      contactRole: finalRole,
      leadId: lead._id,
      organizationId: org._id,
      contactId,
      contactName,
      customFields: Array.isArray(customFields) ? customFields : [],
      owner: ownerUser._id,
      createdBy: req.user._id
    });

    // ---------- 4. MARK LEAD AS CONVERTED ----------
    lead.isConverted = true;
    lead.convertedAt = new Date();
    lead.convertedBy = req.user._id;
    lead.dealId = deal._id;
    lead.organizationId = org._id;
    lead.leadStatus = 'Converted';
    lead.updatedBy = req.user._id;
    await lead.save();

    res.status(201).json({
      success: true,
      data: deal,
      account: { _id: org._id, companyName: org.companyName, created: accountCreated }
    });
  } catch (err) {
    console.error('❌ Convert Lead → Deal error:', err);
    // Don't leave an orphan Account behind if the Deal never got saved
    if (createdOrgId) {
      const dealSaved = await Deal.exists({ organizationId: createdOrgId }).catch(() => null);
      if (!dealSaved) await Organization.findByIdAndDelete(createdOrgId).catch(() => {});
    }
    res.status(400).json({ error: err.message || 'Failed to convert lead' });
  }
});

// ============================================
// PUT /api/deals/:id
// ============================================
router.put('/:id', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    // ✅ Validate stage when the caller is changing it
    if (req.body.stage !== undefined) {
      const stageCheck = await validateStageName(req.body.stage);
      if (!stageCheck.ok) return res.status(400).json({ error: stageCheck.error });
      req.body.stage = stageCheck.stage;
    }

    const allowed = ['dealName', 'amount', 'closingDate', 'stage', 'contactRole', 'owner', 'customFields'];
    const update = { updatedBy: req.user._id };
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const deal = await Deal.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('organizationId', 'companyName')
      .populate('owner', 'name email');
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    res.json({ success: true, data: deal });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// DELETE /api/deals/:id
// ============================================
router.delete('/:id', authorize('Admin', 'Sales Manager'), async (req, res) => {
  try {
    const deal = await Deal.findByIdAndDelete(req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
