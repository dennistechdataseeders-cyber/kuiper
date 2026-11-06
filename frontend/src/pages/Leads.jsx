// frontend/src/pages/Leads.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Plus, X, Trash2, Save, Lock, Loader2, Search,
  ChevronDown, ArrowLeft, Users, Mail, Phone, Building2,
  StickyNote, ListTodo, Video
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import LeadDetail, { ActivityModal } from '../components/LeadDetail';
import EditableSelect from '../components/EditableSelect';
import LeadFilterBar, { matchesFilters } from '../components/LeadFilterBar';

// ============================================
// COUNTRY OPTIONS
// ============================================
const COUNTRY_OPTIONS = [
  'Afghanistan', 'Aland Islands', 'Albania', 'Algeria', 'American Samoa', 'Andorra', 'Angola',
  'Anguilla', 'Antarctica', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Aruba', 'Australia',
  'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium',
  'Belize', 'Benin', 'Bermuda', 'Bhutan', 'Bolivia', 'Bonaire, Sint Eustatius and Saba',
  'Bosnia and Herzegovina', 'Botswana', 'Bouvet Island', 'Brazil', 'British Indian Ocean Territory',
  'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Cape Verde',
  'Cayman Islands', 'Central African Republic', 'Chad', 'Chile', 'China', 'Christmas Island',
  'Cocos (Keeling) Islands', 'Colombia', 'Comoros', 'Cook Islands', 'Costa Rica',
  "Cote D'Ivoire (Ivory Coast)", 'Croatia', 'Cuba', 'Curaçao', 'Cyprus', 'Czech Republic',
  'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini',
  'Ethiopia', 'Falkland Islands', 'Faroe Islands', 'Fiji Islands', 'Finland', 'France',
  'French Guiana', 'French Southern Territories', 'Gabon', 'Gambia', 'Georgia', 'Germany',
  'Ghana', 'Gibraltar', 'Greece', 'Greenland', 'Grenada', 'Guadeloupe', 'Guam', 'Guatemala',
  'Guernsey and Alderney', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti',
  'Heard Island and McDonald Islands', 'Honduras', 'Hong Kong S.A.R.', 'Hungary', 'Iceland',
  'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Isle of Man', 'Israel', 'Italy', 'Jamaica',
  'Japan', 'Jersey', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan',
  'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania',
  'Luxembourg', 'Macau S.A.R.', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta',
  'Marshall Islands', 'Martinique', 'Mauritania', 'Mauritius', 'Mayotte', 'Mexico', 'Micronesia',
  'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Montserrat', 'Morocco', 'Mozambique', 'Myanmar',
  'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Caledonia', 'New Zealand', 'Nicaragua', 'Niger',
  'Nigeria', 'Niue', 'Norfolk Island', 'North Korea', 'North Macedonia', 'Northern Mariana Islands',
  'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay',
  'Peru', 'Philippines', 'Pitcairn Island', 'Poland', 'Portugal', 'Puerto Rico', 'Qatar',
  'Republic of the Congo', 'Reunion', 'Romania', 'Russia', 'Rwanda',
  'Saint Helena, Ascension and Tristan da Cunha', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Pierre and Miquelon', 'Saint Vincent and The Grenadines', 'Saint-Barthelemy',
  'Saint-Martin (French part)', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia',
  'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Sint Maarten (Dutch part)',
  'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Georgia',
  'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname',
  'Svalbard and Jan Mayen Islands', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan',
  'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tokelau', 'Tonga', 'Trinidad and Tobago',
  'Tunisia', 'Turkmenistan', 'Turks and Caicos Islands', 'Tuvalu', 'Türkiye', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu',
  'Vatican City State (Holy See)', 'Venezuela', 'Vietnam', 'Virgin Islands (British)',
  'Wallis and Futuna Islands', 'Western Sahara', 'Yemen', 'Zambia', 'Zimbabwe'
];

const LOGGED_IN_USER_NAME = localStorage.getItem('userName') || '';
const LOGGED_IN_USER_ID   = localStorage.getItem('userId')   || '';

// ============================================
// FALLBACK FIELD LAYOUT (UPDATED per request)
// ============================================
const FALLBACK_FIELDS = [
  // Section: Lead Information
  { fieldKey: 'leadOwner',         label: 'Lead Owner',       type: 'text',   section: 'Lead Information', order: 1,  isDefault: true, required: true },
  { fieldKey: 'firstName',         label: 'First Name',       type: 'text',   section: 'Lead Information', order: 2,  isDefault: true },
  { fieldKey: 'title',             label: 'Title',            type: 'text',   section: 'Lead Information', order: 3,  isDefault: true },
  { fieldKey: 'phone',             label: 'Phone',            type: 'phone',  section: 'Lead Information', order: 4,  isDefault: true },
  { fieldKey: 'mobile',            label: 'Mobile',           type: 'phone',  section: 'Lead Information', order: 5,  isDefault: true },
  {
    fieldKey: 'leadSource',
    label: 'Lead Source',
    type: 'select',
    section: 'Lead Information',
    order: 6,
    isDefault: true,
    options: [
      '-None-','Advertisement','Cold Call','Employee Referral','External Referral','Online Store',
      'Email','Public Relations','Sales Email Alias','Seminar Partner','Internal Seminar',
      'Trade Show','Web Download','Web Research','Chat','X (Twitter)','Facebook','LinkedIn'
    ]
  },
  {
    fieldKey: 'industry',
    label: 'Industry',
    type: 'select',
    section: 'Lead Information',
    order: 7,
    isDefault: true,
    options: [
      '-None-','Market Research','Travel Industry','Food Industry','E commerce','Business Consulting',
      'Fashion Industry','Jewellery / E-commerce','Electronics','Furtniure','Beauty & Cosmetics',
      'Service Provider','Other Retail Product','B2B Marketing','Pharmaceutical Intelligence',
      'Entertainment Providers','Other','Beauty and Cosmetics'
    ]
  },
  { fieldKey: 'company',           label: 'Company',          type: 'text',   section: 'Lead Information', order: 8,  isDefault: true, required: true },
  { fieldKey: 'lastName',          label: 'Last Name',        type: 'text',   section: 'Lead Information', order: 9,  isDefault: true, required: true },
  { fieldKey: 'email',             label: 'Email',            type: 'email',  section: 'Lead Information', order: 10, isDefault: true },
  { fieldKey: 'fax',               label: 'Fax',              type: 'phone',  section: 'Lead Information', order: 11, isDefault: true },
  { fieldKey: 'website',           label: 'Website',          type: 'text',   section: 'Lead Information', order: 12, isDefault: true },
  { fieldKey: 'linkedin',          label: 'LinkedIn',         type: 'text',   section: 'Lead Information', order: 13, isDefault: true },
  {
    fieldKey: 'leadStatus',
    label: 'Lead Status',
    type: 'select',
    section: 'Lead Information',
    order: 14,
    isDefault: true,
    options: [
      'Attempted to Contact','Contact in Future','Contacted','Junk Lead','Lost Lead',
      'Not Contacted','Pre-Qualified','Not Qualified'
    ]
  },
  { fieldKey: 'noOfEmployees',     label: 'No. of Employees', type: 'number', section: 'Lead Information', order: 15, isDefault: true },
  {
    fieldKey: 'rating',
    label: 'Rating',
    type: 'select',
    section: 'Lead Information',
    order: 16,
    isDefault: true,
    options: ['-None-','Acquired','Active','Market Failed','Project Cancelled','Shut Down']
  },
  {
    fieldKey: 'currency',
    label: 'Currency',
    type: 'select',
    section: 'Lead Information',
    order: 17,
    isDefault: true,
    options: ['INR','USD']
  },
  {
    fieldKey: 'custom_emailSent',
    label: 'Email Sent',
    type: 'select',
    section: 'Lead Information',
    order: 18,
    isDefault: true,
    options: ['Yes', 'No']
  },
  {
    fieldKey: 'custom_linkedinRequestSent',
    label: 'LinkedIn Request Sent',
    type: 'select',
    section: 'Lead Information',
    order: 19,
    isDefault: true,
    options: ['Yes', 'No']
  },
  {
    fieldKey: 'custom_linkedinRequestAccept',
    label: 'LinkedIn Request Accept',
    type: 'select',
    section: 'Lead Information',
    order: 20,
    isDefault: true,
    options: ['Yes', 'No']
  },
  {
    fieldKey: 'custom_introMessageSent',
    label: 'Introductory Message Sent',
    type: 'select',
    section: 'Lead Information',
    order: 21,
    isDefault: true,
    options: [
      'Introductory Message Sent', 'Follow up 1 Sent', 'Follow up 2 Sent', 'Follow up 3 Sent',
      'Follow up 4 Sent', 'Follow up 5 Sent', 'Follow up 6 Sent'
    ]
  },
  {
    fieldKey: 'custom_response',
    label: 'Response',
    type: 'select',
    section: 'Lead Information',
    order: 22,
    isDefault: true,
    options: [
      'No Response', 'Interested', 'Not Interested', 'Contact In Future',
      'Asked for Details', 'Asked for Meeting', 'Wrong Contact'
    ]
  },
  {
    fieldKey: 'custom_responseChannel',
    label: 'Response Channel',
    type: 'select',
    section: 'Lead Information',
    order: 23,
    isDefault: true,
    options: ['Email', 'LinkedIn']
  },
  // Section: Address Information
  { fieldKey: 'address.countryRegion', label: 'Country / Region', type: 'select', section: 'Address Information', order: 24, isDefault: true, options: COUNTRY_OPTIONS },
  { fieldKey: 'address.flatHouse',       label: 'Flat / House No. / Building / Apartment Name', type: 'text', section: 'Address Information', order: 25, isDefault: true },
  { fieldKey: 'address.streetAddress',   label: 'Street Address',         type: 'text', section: 'Address Information', order: 26, isDefault: true },
  { fieldKey: 'address.city',            label: 'City',                   type: 'text', section: 'Address Information', order: 27, isDefault: true },
  { fieldKey: 'address.stateProvince',   label: 'State / Province',       type: 'text', section: 'Address Information', order: 28, isDefault: true },
  { fieldKey: 'address.zipPostalCode',   label: 'Zip / Postal Code',      type: 'text', section: 'Address Information', order: 29, isDefault: true },
  { fieldKey: 'address.latitude',        label: 'Latitude',               type: 'text', section: 'Address Information', order: 30, isDefault: true },
  { fieldKey: 'address.longitude',       label: 'Longitude',              type: 'text', section: 'Address Information', order: 31, isDefault: true },
  // Section: Description Information
  { fieldKey: 'description',       label: 'Description',      type: 'textarea', section: 'Description Information', order: 32, isDefault: true },
];

// ============================================
// CUSTOMIZE MODULES → LEADS FORM MAPPING
// ============================================
const TYPE_MAP = {
  'Single Line': 'text', 'Multi-Line': 'textarea', 'Email': 'email', 'Phone': 'phone',
  'Pick List': 'select', 'Date': 'date', 'Date/Time': 'date', 'Number': 'number',
  'Decimal': 'number', 'Currency': 'number', 'Percent': 'number', 'Long Integer': 'number',
  'Checkbox': 'checkbox', 'URL': 'text'
};

const mapModuleField = (f) => ({
  fieldKey: f.fieldKey,
  label: f.label,
  type: TYPE_MAP[f.type] || 'text',
  section: 'Lead Information', // Default to Lead Info for module fields
  placeholder: f.placeholder || '',
  options: (f.options || []).map(o => ({ value: o.label, locked: false })),
  required: !!f.isRequired,
  order: 1000 + (f.order || 0),
  isDefault: false,
  _source: 'module',
  _moduleFieldId: f._id
});

const buildEmptyForm = () => ({
  leadOwner: LOGGED_IN_USER_NAME,
  firstName: '',
  title: '',
  phone: '',
  mobile: '',
  leadSource: '',
  industry: '',
  company: '',
  lastName: '',
  email: '',
  fax: '',
  website: '',
  linkedin: '',
  leadStatus: '',
  noOfEmployees: '',
  rating: '',
  currency: '',
  address: {
    countryRegion: '',
    flatHouse: '',
    streetAddress: '',
    city: '',
    stateProvince: '',
    zipPostalCode: '',
    latitude: '',
    longitude: ''
  },
  description: '',
  dynamicFields: {
    custom_emailSent: '',
    custom_linkedinRequestSent: '',
    custom_linkedinRequestAccept: '',
    custom_introMessageSent: '',
    custom_response: '',
    custom_responseChannel: ''
  }
});

const ALPHABETS = ['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

export default function Leads() {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [view, setView] = useState('list');
  const [selectedLead, setSelectedLead] = useState(null);

  const [quickMenu, setQuickMenu] = useState(null);
  const [quickModal, setQuickModal] = useState(null);

  const [leads, setLeads] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [alphabetFilter, setAlphabetFilter] = useState('All');
  const [showAlphabetDropdown, setShowAlphabetDropdown] = useState(false);

  // ✅ Filter bar state
  const [filterSchema, setFilterSchema] = useState([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [filters, setFilters] = useState([]);

  const [fieldSchema, setFieldSchema] = useState(FALLBACK_FIELDS);
  const [form, setForm] = useState(buildEmptyForm);
  const [saving, setSaving] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState({
    label: '', type: 'text', section: 'Lead Information', required: false, placeholder: '', optionsInput: ''
  });

  // ============================================
  // FETCH LEADS
  // ============================================
  const fetchLeads = async () => {
    try {
      setListLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/leads`, authHeader);
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      console.log('📊 Loaded leads:', list.length);
      setLeads(list);
    } catch (err) {
      console.error('Fetch leads failed:', err);
      toast.error('Failed to load leads');
    } finally {
      setListLoading(false);
    }
  };

  // ============================================
  // FETCH FIELD SCHEMA
  // ============================================
  const fetchFieldSchema = async () => {
    try {
      const [res, modRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/leads/fields`, authHeader),
        axios.get(`${API_BASE_URL}/api/module-fields/Leads`, authHeader)
          .catch(() => ({ data: { data: [] } }))
      ]);
      if (!res.data.success || !Array.isArray(res.data.data)) return;

      const backendFields = res.data.data;
      const backendKeys = new Set(backendFields.map(f => f.fieldKey));
      const missingDefaults = FALLBACK_FIELDS.filter(f => !backendKeys.has(f.fieldKey));
      const moduleFields = (modRes.data?.data || []).map(mapModuleField);

      const merged = [...backendFields, ...missingDefaults, ...moduleFields].sort(
        (a, b) => (a.order || 0) - (b.order || 0)
      );
      setFieldSchema(merged);
    } catch (err) {
      console.error('Field schema fetch failed:', err.message);
    }
  };

  // ============================================
  // ✅ FETCH FILTER SCHEMA
  // ============================================
  const fetchFilterSchema = async () => {
    try {
      setFiltersLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/leads/filters`, authHeader);
      if (res.data.success && Array.isArray(res.data.data)) {
        setFilterSchema(res.data.data);
      }
    } catch (err) {
      console.error('Filter schema fetch failed:', err.message);
    } finally {
      setFiltersLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchFieldSchema();
    fetchFilterSchema();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!quickMenu) return;
    const close = () => setQuickMenu(null);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [quickMenu]);

  // ============================================
  // LIST HELPERS
  // ============================================
  const getPrimaryContact = (lead) => {
    if (!lead.contacts || lead.contacts.length === 0) return null;
    return lead.contacts.find(c => c.isPrimary) || lead.contacts[0];
  };

  const getLeadName = (lead) => {
    const p = getPrimaryContact(lead);
    if (!p) return lead.companyName || '—';
    return `${p.firstName || ''} ${p.lastName || ''}`.trim() || lead.companyName || '—';
  };

  const filteredLeads = useMemo(() => {
    let result = [...leads];

    if (alphabetFilter !== 'All') {
      result = result.filter(lead => {
        const name = getLeadName(lead);
        return name.charAt(0).toUpperCase() === alphabetFilter;
      });
    }

    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      result = result.filter(lead => {
        const primary = getPrimaryContact(lead);
        return (
          getLeadName(lead).toLowerCase().includes(s) ||
          lead.companyName?.toLowerCase().includes(s) ||
          primary?.email?.toLowerCase().includes(s) ||
          primary?.phone?.toLowerCase().includes(s) ||
          primary?.mobile?.toLowerCase().includes(s)
        );
      });
    }

    if (filters && filters.length > 0) {
      result = result.filter(lead => matchesFilters(lead, filters, getPrimaryContact));
    }

    return result.sort((a, b) => getLeadName(a).localeCompare(getLeadName(b)));
  }, [leads, alphabetFilter, searchTerm, filters]);

  // ============================================
  // FORM HELPERS
  // ============================================
  const getValue = (fieldKey) => {
    if (fieldKey.includes('.')) {
      const [k, sub] = fieldKey.split('.');
      return form[k]?.[sub] ?? '';
    }
    if (['leadOwner','firstName','title','phone','mobile','leadSource','industry',
         'company','lastName','email','fax','website','linkedin','leadStatus','noOfEmployees',
         'rating','currency','description'].includes(fieldKey)) {
      return form[fieldKey] ?? '';
    }
    return form.dynamicFields?.[fieldKey] ?? '';
  };

  const setValue = (fieldKey, value) => {
    if (fieldKey.includes('.')) {
      const [k, sub] = fieldKey.split('.');
      setForm(prev => ({ ...prev, [k]: { ...prev[k], [sub]: value } }));
      return;
    }
    if (['leadOwner','firstName','title','phone','mobile','leadSource','industry',
         'company','lastName','email','fax','website','linkedin','leadStatus','noOfEmployees',
         'rating','currency','description'].includes(fieldKey)) {
      setForm(prev => ({ ...prev, [fieldKey]: value }));
      return;
    }
    setForm(prev => ({ ...prev, dynamicFields: { ...prev.dynamicFields, [fieldKey]: value } }));
  };

  const grouped = useMemo(() => {
    const result = { 'Lead Information': [], 'Address Information': [], 'Description Information': [], 'Custom': [] };
    fieldSchema.forEach(f => {
      const sec = result[f.section] ? f.section : 'Custom';
      result[sec].push(f);
    });
    return result;
  }, [fieldSchema]);

  // ============================================
  // SAVE LEAD
  // ============================================
  const handleSave = async () => {
    if (saving) return;
    if (!form.company.trim()) return toast.error('Company is required');
    if (!form.lastName.trim()) return toast.error('Last Name is required');

    const derivedPocName =
      [form.firstName?.trim(), form.lastName?.trim()].filter(Boolean).join(' ') ||
      form.company.trim();

    setSaving(true);
    const toastId = toast.loading('Saving lead...');

    try {
      const cleanForm = { ...form };
      if (cleanForm.noOfEmployees === '') cleanForm.noOfEmployees = null;
      else cleanForm.noOfEmployees = Number(cleanForm.noOfEmployees);

      if (!cleanForm.leadSource) delete cleanForm.leadSource;
      if (!cleanForm.industry) delete cleanForm.industry;
      if (!cleanForm.leadStatus) delete cleanForm.leadStatus;
      if (!cleanForm.rating) delete cleanForm.rating;
      if (!cleanForm.currency) delete cleanForm.currency;

      const payload = {
        ...cleanForm,
        leadOwner: LOGGED_IN_USER_NAME,
        leadOwnerId: LOGGED_IN_USER_ID || null,
        pocName: derivedPocName,
        pocEmail: cleanForm.email || '',
        pocPhone: cleanForm.phone || cleanForm.mobile || '',
        dynamicFields: Object.entries(form.dynamicFields)
          .map(([key, value]) => {
            const def = fieldSchema.find(f => f.fieldKey === key);
            if (!def) return null;
            let processedValue = value;
            if (def.type === 'number' && value !== '') processedValue = Number(value);
            return {
              fieldKey: key,
              label: def.label,
              type: def.type,
              section: def.section,
              value: processedValue,
              options: def.options || [],
              required: def.required || false
            };
          })
          .filter(Boolean)
      };

      console.log('📤 POST /api/leads payload:', payload);
      const res = await axios.post(`${API_BASE_URL}/api/leads`, payload, authHeader);

      const saved =
        res.status === 201 &&
        res.data &&
        (res.data.success === true || !!res.data.data?._id);

      if (!saved) {
        const serverErr = res.data?.error || res.data?.message || 'Unknown server response';
        toast.error(`Save failed: ${serverErr}`, { id: toastId });
        console.error('❌ Save failed (non-201 or missing data):', res.status, res.data);
        return;
      }

      const created = res.data.data;
      const num = created?.leadNumber ? ` #${created.leadNumber}` : '';

      toast.success(`Lead${num} saved — Account & Contact created`, { id: toastId });

      setForm(buildEmptyForm());
      await fetchLeads();
      fetchFilterSchema();
      setView('list');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const serverMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Save failed';

      console.error('❌ SERVER REJECTION REASON:', err.response?.data || err.message);
      toast.error(`Save failed: ${serverMsg}`, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // FIELD MANAGEMENT
  // ============================================
  const handleAddField = async (e) => {
    e.preventDefault();
    if (!newField.label.trim()) return toast.error('Field label is required');

    const options =
      newField.type === 'select'
        ? (newField.optionsInput || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .map(v => ({ value: v, locked: false }))
        : [];

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/leads/fields`,
        {
          label: newField.label,
          type: newField.type,
          section: newField.section,
          required: newField.required,
          placeholder: newField.placeholder,
          options
        },
        authHeader
      );

      if (res.data.success) {
        toast.success(`Field "${newField.label}" added`);
        setShowAddField(false);
        setNewField({ label: '', type: 'text', section: 'Lead Information', required: false, placeholder: '', optionsInput: '' });
        fetchFieldSchema();
        fetchFilterSchema();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add field');
    }
  };

  const handleRemoveField = async (fieldKey) => {
    if (!window.confirm('Remove this field from the form layout?')) return;
    try {
      const def = fieldSchema.find(f => f.fieldKey === fieldKey);
      const url = def?._source === 'module'
        ? `${API_BASE_URL}/api/module-fields/${def._moduleFieldId}`
        : `${API_BASE_URL}/api/leads/fields/${fieldKey}`;
      const res = await axios.delete(url, authHeader);
      if (res.data.success) {
        toast.success('Field removed');
        fetchFieldSchema();
        fetchFilterSchema();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove field');
    }
  };

  // ============================================
  // RENDER FIELD
  // ============================================
  const renderField = (field) => {
    const commonProps = {
      value: getValue(field.fieldKey),
      onChange: (e) => setValue(field.fieldKey, e.target.value),
      disabled: saving,
      className:
        'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-100 disabled:cursor-not-allowed'
    };

    if (field.fieldKey === 'leadOwner') {
      return (
        <div className="relative">
          <input
            type="text"
            value={LOGGED_IN_USER_NAME}
            readOnly
            title="Automatically set to the logged-in sales rep"
            className="w-full px-3 py-2 pr-9 rounded-lg border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600 cursor-not-allowed outline-none"
          />
          <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      );
    }

    if (field.type === 'textarea') {
      return <textarea rows={4} {...commonProps} />;
    }

    if (field.type === 'checkbox') {
      return (
        <label className="flex items-center gap-2 py-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!getValue(field.fieldKey)}
            onChange={(e) => setValue(field.fieldKey, e.target.checked)}
            disabled={saving}
          />
          <span className="text-sm text-slate-600">{field.placeholder || 'Yes'}</span>
        </label>
      );
    }

    if (field.type === 'select' && field._source === 'module') {
      return (
        <select {...commonProps}>
          <option value="">-None-</option>
          {(field.options || []).map(o => {
            const v = typeof o === 'string' ? o : o.value;
            return <option key={v} value={v}>{v}</option>;
          })}
        </select>
      );
    }

    if (field.type === 'select') {
      return (
        <EditableSelect
          fieldKey={field.fieldKey}
          value={getValue(field.fieldKey)}
          onChange={(v) => setValue(field.fieldKey, v)}
          options={field.options || []}
          onOptionsChanged={(newOptions) => {
            setFieldSchema((prev) =>
              prev.map((f) =>
                f.fieldKey === field.fieldKey ? { ...f, options: newOptions } : f
              )
            );
            fetchFilterSchema();
          }}
          disabled={saving}
        />
      );
    }

    return (
      <input
        type={
          field.type === 'email' ? 'email' :
          field.type === 'number' ? 'number' :
          field.type === 'date' ? 'date' : 'text'
        }
        {...commonProps}
      />
    );
  };

  // ============================================
  // DETAIL VIEW
  // ============================================
  if (view === 'detail' && selectedLead) {
    return (
      <LeadDetail
        lead={selectedLead}
        onBack={() => { setView('list'); setSelectedLead(null); }}
        onUpdated={(updated) => {
          setSelectedLead(updated);
          setLeads((prev) => prev.map((l) => (l._id === updated._id ? updated : l)));
          fetchFilterSchema();
        }}
      />
    );
  }

  // ============================================
  // LIST VIEW
  // ============================================
  if (view === 'list') {
    return (
      <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">All Leads</h1>
            <p className="text-sm text-slate-500">Track and follow up with your leads</p>
          </div>
          <button
            onClick={() => setView('form')}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
          >
            <Plus size={16} />
            Create Lead
          </button>
        </div>

        <div>
          <div className="flex flex-col gap-3 mb-5">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setShowAlphabetDropdown(v => !v)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  <span className="text-xs uppercase tracking-wider text-slate-400">Lead Name</span>
                  <span className="w-8 h-8 rounded-md bg-blue-50 text-blue-700 font-black flex items-center justify-center">
                    {alphabetFilter === 'All' ? 'A–Z' : alphabetFilter}
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showAlphabetDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showAlphabetDropdown && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-2 w-64">
                    <div className="grid grid-cols-7 gap-1">
                      {ALPHABETS.map(letter => (
                        <button
                          key={letter}
                          onClick={() => {
                            setAlphabetFilter(letter);
                            setShowAlphabetDropdown(false);
                          }}
                          className={`h-8 rounded-md text-xs font-black transition-all ${
                            alphabetFilter === letter
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          } ${letter === 'All' ? 'col-span-7 bg-slate-50' : ''}`}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative flex-1 md:max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, company, email or phone..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500 shadow-sm"
                />
              </div>

              <div className="md:ml-auto text-xs font-bold text-slate-400">
                {filteredLeads.length} of {leads.length} leads
              </div>
            </div>

            <LeadFilterBar
              filterSchema={filterSchema}
              filters={filters}
              onChange={setFilters}
              loading={filtersLoading}
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 w-[120px]">Quick Actions</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Lead Name</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Company</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Email</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Phone</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Lead Source</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Lead Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listLoading ? (
                    <tr>
                      <td colSpan="7" className="py-16">
                        <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                          <Loader2 size={28} className="animate-spin text-blue-600" />
                          <span className="text-sm font-semibold">Loading leads...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Users size={36} className="text-slate-300" />
                          <p className="text-sm font-bold text-slate-500">No leads found</p>
                          <button
                            onClick={() => {
                              setAlphabetFilter('All');
                              setSearchTerm('');
                              setFilters([]);
                            }}
                            className="text-xs font-bold text-blue-600 hover:underline"
                          >
                            Clear all filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map(lead => {
                      const primary = getPrimaryContact(lead);
                      return (
                        <tr
                          key={lead._id}
                          onClick={() => { setSelectedLead(lead); setView('detail'); window.scrollTo({ top: 0 }); }}
                          className="hover:bg-blue-50/40 transition group cursor-pointer"
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setQuickModal({ lead, type: 'note' })}
                                title="Add note"
                                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 flex items-center justify-center hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition"
                              >
                                <StickyNote size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  const r = e.currentTarget.getBoundingClientRect();
                                  setQuickMenu(prev =>
                                    prev?.lead._id === lead._id ? null : { lead, top: r.bottom + 4, left: r.left }
                                  );
                                }}
                                title="Add activity"
                                className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-slate-500 flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition"
                              >
                                <ListTodo size={14} />
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-xs font-black shrink-0">
                                {getLeadName(lead).charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition">
                                {getLeadName(lead)}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                              <Building2 size={13} className="text-slate-400" />
                              {lead.companyName || '—'}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Mail size={13} className="text-slate-400" />
                              {primary?.email || '—'}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Phone size={13} className="text-slate-400" />
                              {primary?.phone || primary?.mobile || '—'}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                              {lead.leadSource || 'Web Research'}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-sm font-semibold text-slate-700">
                              {lead.leadOwner?.name || 'Unassigned'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {showAlphabetDropdown && (
          <div className="fixed inset-0 z-40" onClick={() => setShowAlphabetDropdown(false)} />
        )}

        {quickMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setQuickMenu(null)} />
            <div
              className="fixed z-50 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5"
              style={{ top: quickMenu.top, left: quickMenu.left }}
            >
              {[
                { type: 'task',    label: 'Add activity', icon: ListTodo },
                { type: 'meeting', label: 'Add meeting',  icon: Video },
                { type: 'call',    label: 'Add call',     icon: Phone },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => { setQuickModal({ lead: quickMenu.lead, type }); setQuickMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition text-left"
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
          </>
        )}

        {quickModal && (
          <ActivityModal
            type={quickModal.type}
            leadId={quickModal.lead._id}
            authHeader={authHeader}
            onClose={() => setQuickModal(null)}
            onSaved={() => setQuickModal(null)}
          />
        )}
      </div>
    );
  }

  // ============================================
  // FORM VIEW
  // ============================================
  return (
    <div className={`min-h-screen bg-white transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      <div
        className={`fixed top-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300 ${
          isCollapsed ? 'left-20' : 'left-64'
        }`}
      >
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setView('list'); setForm(buildEmptyForm()); }}
              disabled={saving}
              className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition disabled:opacity-50"
              title="Back to leads"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-900">Create Lead</h1>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Fill in the details below</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowAddField(true)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} /> Add Field
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-200 transition-all"
            >
              {saving ? (
                <><Loader2 size={14} className="animate-spin" /> Saving...</>
              ) : (
                <><Save size={14} /> Save</>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 pt-[88px] pb-12">
        <div className="mb-8">
          <h2 className="text-base font-bold text-slate-800 mb-4">Lead Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {grouped['Lead Information'].map(field => (
              <FieldRow key={field.fieldKey} field={field} onRemove={handleRemoveField}>
                {renderField(field)}
              </FieldRow>
            ))}
          </div>
        </div>

        {grouped['Address Information'].length > 0 && (
          <div className="mb-8">
            <h2 className="text-base font-bold text-slate-800 mb-4">Address Information</h2>
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {grouped['Address Information'].map(field => (
                  <FieldRow key={field.fieldKey} field={field} onRemove={handleRemoveField}>
                    {renderField(field)}
                  </FieldRow>
                ))}
              </div>
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => setForm(prev => ({
                    ...prev,
                    address: {
                      countryRegion:'', flatHouse:'', streetAddress:'', city:'',
                      stateProvince:'', zipPostalCode:'', latitude:'', longitude:''
                    }
                  }))}
                  disabled={saving}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}

        {grouped['Description Information'].length > 0 && (
          <div className="mb-8">
            <h2 className="text-base font-bold text-slate-800 mb-4">Description Information</h2>
            <div className="grid grid-cols-1 gap-y-3">
              {grouped['Description Information'].map(field => (
                <FieldRow key={field.fieldKey} field={field} onRemove={handleRemoveField}>
                  {renderField(field)}
                </FieldRow>
              ))}
            </div>
          </div>
        )}
      </div>

      {saving && (
        <div className="fixed inset-0 z-[100] bg-slate-900/20 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 px-8 py-6 flex flex-col items-center gap-3 pointer-events-auto">
            <Loader2 size={36} className="text-blue-600 animate-spin" />
            <p className="text-sm font-black text-slate-800">Saving lead...</p>
            <p className="text-[10px] font-semibold text-slate-400">Please wait, this won't take long</p>
          </div>
        </div>
      )}

      {showAddField && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Add New Field</h3>
              <button
                onClick={() => setShowAddField(false)}
                disabled={saving}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddField} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Field Label *</label>
                <input
                  required
                  value={newField.label}
                  onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  placeholder="e.g. Referral Code"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Type</label>
                  <select
                    value={newField.type}
                    onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  >
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="textarea">Textarea</option>
                    <option value="select">Dropdown</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Section</label>
                  <select
                    value={newField.section}
                    onChange={(e) => setNewField({ ...newField, section: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  >
                    <option value="Lead Information">Lead Information</option>
                    <option value="Address Information">Address Information</option>
                    <option value="Description Information">Description Information</option>
                  </select>
                </div>
              </div>

              {newField.type === 'select' && (
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Options (comma-separated)
                  </label>
                  <input
                    value={newField.optionsInput || ''}
                    onChange={(e) => setNewField({ ...newField, optionsInput: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    placeholder="Option A, Option B, Option C"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    You can add, rename, or remove these later from the dropdown itself.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={newField.required}
                  onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                />
                <label htmlFor="required" className="text-sm text-slate-700">Required</label>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-700"
              >
                Add Field
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ field, onRemove, children }) {
  return (
    <div className="flex items-start gap-2 group">
      <div className="w-40 shrink-0 pt-2 text-right">
        <span className="text-xs font-semibold text-slate-500">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </span>
      </div>
      <div className="flex-1 relative">
        <div className={field.required ? 'ring-1 ring-red-300 rounded-lg' : ''}>
          {children}
        </div>
        {!field.isDefault && (
          <button
            onClick={() => onRemove(field.fieldKey)}
            className="absolute -right-7 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove field"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}