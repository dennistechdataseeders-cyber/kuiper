// backend/routes/leadRoutes.js
const router = require('express').Router();
const Lead = require('../models/Lead');
const LeadFieldSchema = require('../models/LeadFieldSchema');
const ModuleField = require('../models/ModuleField'); // fields added in Customize Modules
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');

router.use(protect);

// ============================================
// Custom-field helpers
// The Leads form sends select options as { value, locked } objects, but
// Lead.dynamicFields[].options is [String] — Mongoose throws a CastError on
// the objects, so normalise them to plain strings before saving.
// ============================================
const optionText = (o) =>
  typeof o === 'string' ? o : String(o?.label ?? o?.value ?? '');

function cleanDynamicFields(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(d => d && d.fieldKey)
    .map(d => ({
      fieldKey: d.fieldKey,
      label: d.label,
      type: d.type,
      section: d.section,
      value: d.value,
      options: (Array.isArray(d.options) ? d.options : []).map(optionText).filter(Boolean),
      required: !!d.required
    }));
}

// ============================================
// Country options
// ============================================
const COUNTRY_OPTIONS = [
  'Afghanistan','Aland Islands','Albania','Algeria','American Samoa','Andorra','Angola','Anguilla',
  'Antarctica','Antigua and Barbuda','Argentina','Armenia','Aruba','Australia','Austria','Azerbaijan',
  'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bermuda','Bhutan',
  'Bolivia','Bonaire, Sint Eustatius and Saba','Bosnia and Herzegovina','Botswana','Bouvet Island',
  'Brazil','British Indian Ocean Territory','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia',
  'Cameroon','Canada','Cape Verde','Cayman Islands','Central African Republic','Chad','Chile','China',
  'Christmas Island','Cocos (Keeling) Islands','Colombia','Comoros','Cook Islands','Costa Rica',
  "Cote D'Ivoire (Ivory Coast)",'Croatia','Cuba','Curaçao','Cyprus','Czech Republic',
  'Democratic Republic of the Congo','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador',
  'Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Falkland Islands',
  'Faroe Islands','Fiji Islands','Finland','France','French Guiana','French Southern Territories',
  'Gabon','Gambia','Georgia','Germany','Ghana','Gibraltar','Greece','Greenland','Grenada','Guadeloupe',
  'Guam','Guatemala','Guernsey and Alderney','Guinea','Guinea-Bissau','Guyana','Haiti',
  'Heard Island and McDonald Islands','Honduras','Hong Kong S.A.R.','Hungary','Iceland','India',
  'Indonesia','Iran','Iraq','Ireland','Isle of Man','Israel','Italy','Jamaica','Japan','Jersey','Jordan',
  'Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho',
  'Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Macau S.A.R.','Madagascar','Malawi',
  'Malaysia','Maldives','Mali','Malta','Marshall Islands','Martinique','Mauritania','Mauritius',
  'Mayotte','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Montserrat','Morocco',
  'Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Caledonia','New Zealand',
  'Nicaragua','Niger','Nigeria','Niue','Norfolk Island','North Korea','North Macedonia',
  'Northern Mariana Islands','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea',
  'Paraguay','Peru','Philippines','Pitcairn Island','Poland','Portugal','Puerto Rico','Qatar',
  'Republic of the Congo','Reunion','Romania','Russia','Rwanda',
  'Saint Helena, Ascension and Tristan da Cunha','Saint Kitts and Nevis','Saint Lucia',
  'Saint Pierre and Miquelon','Saint Vincent and The Grenadines','Saint-Barthelemy',
  'Saint-Martin (French part)','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal',
  'Serbia','Seychelles','Sierra Leone','Singapore','Sint Maarten (Dutch part)','Slovakia','Slovenia',
  'Solomon Islands','Somalia','South Africa','South Georgia','South Korea','South Sudan','Spain',
  'Sri Lanka','Sudan','Suriname','Svalbard and Jan Mayen Islands','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tokelau','Tonga',
  'Trinidad and Tobago','Tunisia','Turkmenistan','Turks and Caicos Islands','Tuvalu','Türkiye',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
  'Vanuatu','Vatican City State (Holy See)','Venezuela','Vietnam','Virgin Islands (British)',
  'Wallis and Futuna Islands','Western Sahara','Yemen','Zambia','Zimbabwe'
];

// ============================================
// Default field layout
// ============================================
const DEFAULT_FIELDS = [
  { fieldKey: 'leadOwner',      label: 'Lead Owner',       type: 'text',   section: 'Lead Information', order: 1,  isDefault: true, required: true },
  { fieldKey: 'firstName',      label: 'First Name',       type: 'text',   section: 'Lead Information', order: 2,  isDefault: true },
  { fieldKey: 'title',          label: 'Title',            type: 'text',   section: 'Lead Information', order: 3,  isDefault: true },
  { fieldKey: 'phone',          label: 'Phone',            type: 'phone',  section: 'Lead Information', order: 4,  isDefault: true },
  { fieldKey: 'mobile',         label: 'Mobile',           type: 'phone',  section: 'Lead Information', order: 5,  isDefault: true },
  {
    fieldKey: 'leadSource',
    label: 'Lead Source',
    type: 'select',
    section: 'Lead Information',
    order: 6,
    isDefault: true,
    options: [
      '-None-','Advertisement','Cold Call','Employee Referral','External Referral','Online Store',
      'Partner','Public Relations','Sales Email Alias','Seminar Partner','Internal Seminar',
      'Trade Show','Web Download','Web Research','Chat','X (Twitter)','Facebook'
    ]
  },
  {
    fieldKey: 'industry',
    label: 'Industry',
    type: 'select',
    section: 'Lead Information',
    order: 7,
    isDefault: true,
    options: ['ECOM','FOOD','HTL','TRVL','FNC','SCLM','JOB','AUTO','IT','Other']
  },
  { fieldKey: 'company',        label: 'Company',          type: 'text',   section: 'Lead Information', order: 8,  isDefault: true, required: true },
  { fieldKey: 'lastName',       label: 'Last Name',        type: 'text',   section: 'Lead Information', order: 9,  isDefault: true, required: true },
  { fieldKey: 'email',          label: 'Email',            type: 'email',  section: 'Lead Information', order: 10, isDefault: true },
  { fieldKey: 'fax',            label: 'Fax',              type: 'phone',  section: 'Lead Information', order: 11, isDefault: true },
  { fieldKey: 'website',        label: 'Website',          type: 'text',   section: 'Lead Information', order: 12, isDefault: true },
  {
    fieldKey: 'leadStatus',
    label: 'Lead Status',
    type: 'select',
    section: 'Lead Information',
    order: 13,
    isDefault: true,
    options: [
      'Attempted to Contact','Contact in Future','Contacted','Junk Lead','Lost Lead',
      'Not Contacted','Pre-Qualified','Not Qualified'
    ]
  },
  { fieldKey: 'noOfEmployees',  label: 'No. of Employees', type: 'number', section: 'Lead Information', order: 14, isDefault: true },
  {
    fieldKey: 'rating',
    label: 'Rating',
    type: 'select',
    section: 'Lead Information',
    order: 15,
    isDefault: true,
    options: ['-None-','Acquired','Active','Market Failed','Project Cancelled','Shut Down']
  },
  {
    fieldKey: 'address.countryRegion',
    label: 'Country / Region',
    type: 'select',
    section: 'Address Information',
    order: 16,
    isDefault: true,
    options: COUNTRY_OPTIONS
  },
  { fieldKey: 'address.flatHouse',      label: 'Flat / House No. / Building / Apartment Name', type: 'text', section: 'Address Information', order: 17, isDefault: true },
  { fieldKey: 'address.streetAddress',  label: 'Street Address',   type: 'text', section: 'Address Information', order: 18, isDefault: true },
  { fieldKey: 'address.city',           label: 'City',             type: 'text', section: 'Address Information', order: 19, isDefault: true },
  { fieldKey: 'address.stateProvince',  label: 'State / Province', type: 'text', section: 'Address Information', order: 20, isDefault: true },
  { fieldKey: 'address.zipPostalCode',  label: 'Zip / Postal Code',type: 'text', section: 'Address Information', order: 21, isDefault: true },
  { fieldKey: 'address.latitude',       label: 'Latitude',         type: 'text', section: 'Address Information', order: 22, isDefault: true },
  { fieldKey: 'address.longitude',      label: 'Longitude',        type: 'text', section: 'Address Information', order: 23, isDefault: true },
  { fieldKey: 'description',    label: 'Description',      type: 'textarea', section: 'Description Information', order: 24, isDefault: true }
];

async function ensureDefaultFields() {
  for (const d of DEFAULT_FIELDS) {
    await LeadFieldSchema.updateOne(
      { fieldKey: d.fieldKey },
      { $setOnInsert: d },
      { upsert: true }
    );
  }
}

// ============================================
// OPTION HELPERS
// ============================================
const normalizeOptions = (opts = []) =>
  (opts || [])
    .map(o =>
      typeof o === 'string'
        ? { value: o, locked: false }
        : { value: String(o?.value ?? ''), locked: !!o?.locked }
    )
    .filter(o => o.value !== '');

const PROTECTED_VALUES = new Set(['-none-']);

async function loadSelectField(fieldKey) {
  const field = await LeadFieldSchema.findOne({ fieldKey });
  if (!field) return { error: 'Field not found' };
  if (field.type !== 'select') return { error: 'Only select fields support options' };
  return { field };
}

// ============================================
// FIELD SCHEMA ROUTES
// ============================================
router.get('/fields', async (req, res) => {
  try {
    await ensureDefaultFields();
    const fields = await LeadFieldSchema.find({ isActive: true }).sort({ order: 1 });
    res.json({ success: true, data: fields });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fields', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const { label, type, section, placeholder, options, required } = req.body;
    if (!label) return res.status(400).json({ error: 'Label is required' });

    const fieldKey = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const count = await LeadFieldSchema.countDocuments();

    const normalized = Array.isArray(options)
      ? normalizeOptions(options)
      : [];

    const field = await LeadFieldSchema.create({
      fieldKey,
      label,
      type: type || 'text',
      section: section || 'Custom',
      placeholder: placeholder || '',
      options: normalized,
      required: !!required,
      order: count + 1,
      isDefault: false
    });

    res.status(201).json({ success: true, data: field });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/fields/:fieldKey', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const field = await LeadFieldSchema.findOne({ fieldKey: req.params.fieldKey });
    if (!field) return res.status(404).json({ error: 'Field not found' });
    if (field.isDefault) return res.status(400).json({ error: 'Default fields cannot be removed' });

    field.isActive = false;
    await field.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fields/seed', authorize('Admin'), async (req, res) => {
  try {
    await ensureDefaultFields();
    res.json({ success: true, message: 'Default fields seeded' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// DROPDOWN OPTION MANAGEMENT
// (must be declared BEFORE the generic /:id routes below)
// ============================================

router.post(
  '/fields/:fieldKey/options',
  authorize('Admin', 'Sales', 'Sales Manager'),
  async (req, res) => {
    try {
      const value = (req.body.value || '').toString().trim();
      if (!value) return res.status(400).json({ error: 'Option value is required' });
      if (value.length > 60) return res.status(400).json({ error: 'Option value must be 60 characters or fewer' });

      const { field, error } = await loadSelectField(req.params.fieldKey);
      if (error) return res.status(400).json({ error });

      const current = normalizeOptions(field.options);
      const dup = current.find(o => o.value.toLowerCase() === value.toLowerCase());
      if (dup) return res.status(409).json({ error: `"${value}" already exists` });

      field.options = [...current, { value, locked: !!req.body.locked }];
      await field.save();
      res.status(201).json({ success: true, data: field });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.patch(
  '/fields/:fieldKey/options',
  authorize('Admin', 'Sales', 'Sales Manager'),
  async (req, res) => {
    try {
      const oldValue = (req.body.oldValue || '').toString().trim();
      const newValue = (req.body.newValue || '').toString().trim();

      if (!oldValue || !newValue) {
        return res.status(400).json({ error: 'oldValue and newValue are required' });
      }
      if (newValue.length > 60) {
        return res.status(400).json({ error: 'Option value must be 60 characters or fewer' });
      }
      if (PROTECTED_VALUES.has(oldValue.toLowerCase())) {
        return res.status(400).json({ error: `"${oldValue}" is a built-in option and cannot be renamed` });
      }

      const { field, error } = await loadSelectField(req.params.fieldKey);
      if (error) return res.status(400).json({ error });

      const current = normalizeOptions(field.options);
      const target = current.find(o => o.value === oldValue);
      if (!target) return res.status(404).json({ error: `Option "${oldValue}" not found` });
      if (target.locked) return res.status(400).json({ error: `"${oldValue}" is locked and cannot be renamed` });

      const clash = current.find(
        o => o.value.toLowerCase() === newValue.toLowerCase() && o.value !== oldValue
      );
      if (clash) return res.status(409).json({ error: `"${newValue}" already exists` });

      field.options = current.map(o => (o.value === oldValue ? { ...o, value: newValue } : o));
      await field.save();
      res.json({ success: true, data: field });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.delete(
  '/fields/:fieldKey/options/:value',
  authorize('Admin', 'Sales', 'Sales Manager'),
  async (req, res) => {
    try {
      const value = decodeURIComponent(req.params.value || '').trim();
      if (!value) return res.status(400).json({ error: 'Option value is required' });
      if (PROTECTED_VALUES.has(value.toLowerCase())) {
        return res.status(400).json({ error: `"${value}" is a built-in option and cannot be removed` });
      }

      const { field, error } = await loadSelectField(req.params.fieldKey);
      if (error) return res.status(400).json({ error });

      const current = normalizeOptions(field.options);
      const target = current.find(o => o.value === value);
      if (!target) return res.status(404).json({ error: `Option "${value}" not found` });
      if (target.locked) return res.status(400).json({ error: `"${value}" is locked and cannot be removed` });

      field.options = current.filter(o => o.value !== value);
      await field.save();
      res.json({ success: true, data: field });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ============================================
// FILTER SCHEMA
//
// GET /api/leads/filters — everything the Lead page's filter bar
// needs to render dynamically from the current field schema
// (including custom fields). Returns one entry per filterable field:
//
//   {
//     fieldKey, label, type, section,
//     options,        // dropdown option values (strings) for `select`
//     distinctValues, // every value currently in leads for this field,
//                     // unioned with `options` for select fields
//   }
//
// Must be declared BEFORE /:id.
// ============================================
const FILTERABLE_TYPES = new Set(['select', 'text', 'email', 'phone', 'number', 'date']);
const EXCLUDE_FIELD_KEYS = new Set([
  'leadOwner',           // handled separately as an owner picker
  'description',         // free text — search handles it
  'address.latitude',
  'address.longitude',
  'address.flatHouse',
  'address.streetAddress'
]);

router.get('/filters', async (req, res) => {
  try {
    await ensureDefaultFields();
    const fields = await LeadFieldSchema.find({ isActive: true }).sort({ order: 1 }).lean();

    const filterable = fields.filter(
      f => FILTERABLE_TYPES.has(f.type) && !EXCLUDE_FIELD_KEYS.has(f.fieldKey)
    );

    // Load just what we need for distinctValue computation.
    const leads = await Lead.find({}).select(
      'companyName industry leadSource leadStatus rating website noOfEmployees address contacts dynamicFields'
    ).lean();

    const getPath = (obj, key) =>
      key.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);

    const distinctFor = (fieldKey) => {
      const set = new Set();
      for (const l of leads) {
        let v;
        if (fieldKey === 'company')             v = l.companyName;
        else if (fieldKey === 'industry')       v = l.industry;
        else if (fieldKey === 'leadSource')     v = l.leadSource;
        else if (fieldKey === 'leadStatus')     v = l.leadStatus;
        else if (fieldKey === 'rating')         v = l.rating;
        else if (fieldKey === 'website')        v = l.website;
        else if (fieldKey === 'noOfEmployees')  v = l.noOfEmployees;
        else if (['firstName', 'lastName', 'email', 'phone', 'mobile'].includes(fieldKey)) {
          const p = (l.contacts || []).find(c => c.isPrimary) || (l.contacts || [])[0];
          v = p ? (fieldKey === 'email' ? p.email : p[fieldKey]) : undefined;
        } else if (fieldKey.startsWith('address.')) {
          v = getPath(l, fieldKey);
        } else {
          // Custom field — lives under dynamicFields[]
          const dyn = (l.dynamicFields || []).find(f => f.fieldKey === fieldKey);
          v = dyn ? dyn.value : undefined;
        }
        if (v !== undefined && v !== null && v !== '') set.add(String(v));
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    };

    const coreData = filterable.map(f => {
      const opts = normalizeOptions(f.options)
        .map(o => o.value)
        .filter(v => v && v !== '-None-');

      const distinctValues = f.type === 'select'
        ? Array.from(new Set([...opts, ...distinctFor(f.fieldKey)]))
            .sort((a, b) => a.localeCompare(b))
        : distinctFor(f.fieldKey);

      return {
        fieldKey: f.fieldKey,
        label: f.label,
        type: f.type,
        section: f.section,
        options: opts,
        distinctValues
      };
    });

    // ✅ Fields created in Customize Modules → Leads are stored in ModuleField
    //    (not LeadFieldSchema), so add them here — each one becomes a filter
    //    automatically. Pick List options are the saved option labels, because
    //    the label is what the Leads form stores in dynamicFields[].value.
    const MODULE_FILTER_TYPES = {
      'Single Line': 'text', 'Multi-Line': 'text', 'URL': 'text',
      'Email': 'email', 'Phone': 'phone', 'Pick List': 'select',
      'Date': 'date', 'Date/Time': 'date',
      'Number': 'number', 'Decimal': 'number', 'Currency': 'number',
      'Percent': 'number', 'Long Integer': 'number'
    };
    const knownKeys = new Set(coreData.map(f => f.fieldKey));
    const moduleFields = await ModuleField.find({ moduleName: 'Leads', isActive: true })
      .sort({ order: 1 }).lean();

    const moduleData = moduleFields
      .filter(f => MODULE_FILTER_TYPES[f.type] && !knownKeys.has(f.fieldKey))
      .map(f => {
        const type = MODULE_FILTER_TYPES[f.type];
        const opts = (f.options || []).map(o => o.label).filter(Boolean);
        const distinctValues = type === 'select'
          ? Array.from(new Set([...opts, ...distinctFor(f.fieldKey)]))
              .sort((a, b) => a.localeCompare(b))
          : distinctFor(f.fieldKey);
        return { fieldKey: f.fieldKey, label: f.label, type, section: 'Custom', options: opts, distinctValues };
      });

    const data = [...coreData, ...moduleData];

    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ /api/leads/filters error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// LEADS CRUD
// ============================================

// GET / — list with search
router.get('/', async (req, res) => {
  try {
    const { search, includeConverted } = req.query;
    let filter = {};
    if (includeConverted !== 'true') {
      filter.isConverted = { $ne: true };
    }
    if (search) {
      filter.$or = [
        { companyName: new RegExp(search, 'i') },
        { website:     new RegExp(search, 'i') },
        { industry:    new RegExp(search, 'i') },
        { 'contacts.firstName': new RegExp(search, 'i') },
        { 'contacts.lastName':  new RegExp(search, 'i') },
        { 'contacts.email':     new RegExp(search, 'i') }
      ];
    }
    const leads = await Lead.find(filter)
      .populate('leadOwner', 'name email')
      .populate('organizationId', 'companyName')
      .populate('dealId', 'dealName stage')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: leads });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id — single lead
router.get('/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('leadOwner', 'name email')
      .populate('organizationId', 'companyName')
      .populate('createdBy', 'name email');
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / — create Lead only
router.post('/', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  console.log('📥 POST /api/leads body:', JSON.stringify(req.body, null, 2));

  try {
    const body = req.body;

    const companyName = (body.companyName || body.company || '').trim();
    if (!companyName) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    let rawContacts = Array.isArray(body.contacts) ? body.contacts : [];

    if (rawContacts.length === 0) {
      const first = (body.firstName || '').trim();
      const last  = (body.lastName  || '').trim();
      const name  = [first, last].filter(Boolean).join(' ').trim()
                    || body.pocName
                    || companyName;

      rawContacts = [{
        firstName: first || name.split(' ')[0] || 'Contact',
        lastName:  last  || name.split(' ').slice(1).join(' ') || '',
        email:     body.email  || body.pocEmail || '',
        phone:     body.phone  || body.mobile   || body.pocPhone || '',
        title:     body.title || '',
        department: body.department || 'Other',
        isPrimary: true
      }];
    }

    const formattedContacts = rawContacts.map(c => {
      const fn = (c.firstName || '').toString().trim();
      const ln = (c.lastName || '').toString().trim();
      const em = (c.email || '').toString().trim();
      const ph = (c.phone || '').toString().trim();

      if (!fn && !ln && !em && !ph) return null;

      return {
        firstName: fn || 'Contact',
        lastName:  ln || '-',
        email:     em || undefined,
        phone:     ph || undefined,
        title:     c.title || undefined,
        department: c.department || 'Other',
        isPrimary: c.isPrimary === true
      };
    }).filter(Boolean);

    if (formattedContacts.length === 0) {
      return res.status(400).json({ error: 'At least one valid contact (POC) is required' });
    }

    if (!formattedContacts.some(c => c.isPrimary)) {
      formattedContacts[0].isPrimary = true;
    }

    const payload = {
      companyName,
      website: body.website || undefined,
      industry: body.industry || undefined,
      noOfEmployees: body.noOfEmployees ? Number(body.noOfEmployees) : undefined,
      address: body.address || {},
      contacts: formattedContacts,
      leadOwner: body.leadOwnerId || body.leadOwner || req.user._id,
      leadSource: body.leadSource || 'Web Research',
      leadStatus: body.leadStatus || 'Not Contacted',
      description: body.description || undefined,
      dynamicFields: cleanDynamicFields(body.dynamicFields),
      createdBy: req.user._id
    };

    const newLead = await Lead.create(payload);

    console.log('✅ Created Lead:', newLead.companyName, '→ id:', newLead._id);

    res.status(201).json({ success: true, data: newLead });
  } catch (err) {
    console.error('❌ Lead Create Error:', err.message);
    console.error(err.stack);
    res.status(400).json({ error: err.message || 'Failed to create lead' });
  }
});

// PUT /:id — edit a lead (company info, primary contact, address, description,
// custom fields). Only known fields are accepted (no blind spreading of req.body).
router.put('/:id', authorize('Admin', 'Sales', 'Sales Manager'), async (req, res) => {
  try {
    const body = req.body || {};
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    if (body.companyName !== undefined) {
      const name = String(body.companyName || '').trim();
      if (!name) return res.status(400).json({ error: 'Company name is required' });
      lead.companyName = name;
    }

    ['website', 'industry', 'description'].forEach(k => {
      if (body[k] !== undefined) lead[k] = body[k] === '' ? undefined : body[k];
    });
    ['leadSource', 'leadStatus'].forEach(k => {
      if (body[k]) lead[k] = body[k];
    });

    if (body.noOfEmployees !== undefined) {
      lead.noOfEmployees =
        body.noOfEmployees === '' || body.noOfEmployees === null
          ? undefined
          : Number(body.noOfEmployees);
    }

    if (body.address && typeof body.address === 'object') {
      ['countryRegion', 'flatHouse', 'streetAddress', 'city', 'stateProvince', 'zipPostalCode']
        .forEach(k => {
          if (body.address[k] !== undefined) lead.set(`address.${k}`, body.address[k] || undefined);
        });
    }

    if (Array.isArray(body.contacts)) {
      const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
      const contacts = body.contacts
        .map(c => {
          const fn = str(c.firstName), ln = str(c.lastName);
          if (!fn && !ln && !str(c.email) && !str(c.phone) && !str(c.mobile)) return null;
          const out = {
            firstName: fn || 'Contact',
            lastName: ln || '-',
            email: str(c.email) || undefined,
            phone: str(c.phone) || undefined,
            mobile: str(c.mobile) || undefined,
            title: str(c.title) || undefined,
            department: c.department || 'Other',
            isPrimary: c.isPrimary === true
          };
          if (c._id) out._id = c._id;   // keep the existing contact id
          return out;
        })
        .filter(Boolean);

      if (contacts.length === 0) {
        return res.status(400).json({ error: 'At least one valid contact (POC) is required' });
      }
      if (!contacts.some(c => c.isPrimary)) contacts[0].isPrimary = true;
      lead.contacts = contacts;
    }

    if (Array.isArray(body.dynamicFields)) {
      lead.dynamicFields = cleanDynamicFields(body.dynamicFields);
    }

    lead.updatedBy = req.user._id;
    await lead.save();

    // Same shape as GET / so the page can swap the lead in place
    const populated = await Lead.findById(lead._id)
      .populate('leadOwner', 'name email')
      .populate('organizationId', 'companyName')
      .populate('dealId', 'dealName stage');

    res.json({ success: true, data: populated });
  } catch (err) {
    console.error('❌ Lead Update Error:', err.message);
    res.status(400).json({ error: err.message || 'Failed to update lead' });
  }
});

// DELETE /:id
router.delete('/:id', authorize('Admin', 'Sales Manager'), async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;