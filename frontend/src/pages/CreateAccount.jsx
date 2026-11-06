// frontend/src/pages/CreateAccount.jsx
import React, { useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, X, Save, Loader2, Building2, UserPlus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import CustomFieldsSection, { useCustomFields, validateCustomFields, buildCustomFieldsPayload } from '../components/CustomFieldsSection';

const LOGGED_IN_USER_ID = localStorage.getItem('userId') || '';

export default function CreateAccount() {
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [saving, setSaving] = useState(false);

  // Fields created in Customize Modules → Accounts / Contacts
  const accountFields = useCustomFields('Accounts');
  const contactFields = useCustomFields('Contacts');
  const [accountCustom, setAccountCustom] = useState({});

  const [account, setAccount] = useState({
    companyName: '',
    website: '',
    industry: '',
    noOfEmployees: '',
    countryRegion: '',
    streetAddress: '',
    city: '',
    stateProvince: '',
    zipPostalCode: ''
  });

  const [contacts, setContacts] = useState([
    { firstName: '', lastName: '', email: '', phone: '', title: '', isPrimary: true, custom: {} }
  ]);

  const handleAccountChange = (e) => setAccount({ ...account, [e.target.name]: e.target.value });

  const handleContactChange = (index, field, value) => {
    const updated = [...contacts];
    updated[index][field] = value;
    setContacts(updated);
  };

  const handleContactCustom = (index, key, value) =>
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, custom: { ...(c.custom || {}), [key]: value } } : c))
    );

  const addContact = () => {
    setContacts([...contacts, { firstName: '', lastName: '', email: '', phone: '', title: '', isPrimary: false, custom: {} }]);
  };

  const removeContact = (index) => {
    if (contacts.length === 1) return toast.error('At least one contact is required');
    const updated = contacts.filter((_, i) => i !== index);
    if (!updated.some(c => c.isPrimary)) updated[0].isPrimary = true;
    setContacts(updated);
  };

  const handleSave = async () => {
    if (!account.companyName.trim()) return toast.error('Company Name is required');
    if (!contacts[0].firstName.trim() || !contacts[0].lastName.trim()) {
      return toast.error('First and Last name are required for the primary contact');
    }

    const accErr = validateCustomFields(accountFields, accountCustom);
    if (accErr) return toast.error(accErr);
    for (const c of contacts.filter(c => c.firstName.trim() || c.lastName.trim())) {
      const conErr = validateCustomFields(contactFields, c.custom);
      if (conErr) return toast.error(conErr);
    }

    setSaving(true);
    const toastId = toast.loading('Creating Account and Contacts...');

    try {
      const payload = {
        companyName: account.companyName.trim(),
        website: account.website || undefined,
        customFields: buildCustomFieldsPayload(accountFields, accountCustom),
        address: [account.streetAddress, account.city, account.stateProvince, account.zipPostalCode, account.countryRegion]
          .map(v => (v || '').trim()).filter(Boolean).join(', '),
        pointsOfContact: contacts
          .filter(c => c.firstName.trim() || c.lastName.trim())
          .map(c => ({
            pocName: [c.firstName, c.lastName].map(v => v.trim()).filter(Boolean).join(' '),
            pocEmail: c.email,
            pocPhone: c.phone,
            title: c.title,
            isPrimary: c.isPrimary,
            customFields: buildCustomFieldsPayload(contactFields, c.custom)
          }))
      };

      // Accounts live in /api/orgs (the same store the Leads form writes to)
      const res = await axios.post(`${API_BASE_URL}/api/orgs`, payload, authHeader);

      if (res.status === 201 || res.data?._id) {
        toast.success('Account & Contacts created successfully', { id: toastId });
        navigate('/sales/accounts');
      } else {
        toast.error('Unexpected response', { id: toastId });
      }
    } catch (err) {
      console.error('SERVER REJECTION REASON:', err.response?.data);
      toast.error(err.response?.data?.error || 'Save failed', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      <div className={`fixed top-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300 ${isCollapsed ? 'left-20' : 'left-64'}`}>
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/sales/accounts')} className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Create Account</h1>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Add a new company and its Points of Contact.</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-200 transition">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Account'}
          </button>
        </div>
      </div>

      <div className="px-6 pt-[88px] pb-12 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
            <Building2 className="text-blue-600" size={20} />
            <h2 className="text-lg font-black text-slate-800">Account Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Company Name *</label>
              <input name="companyName" value={account.companyName} onChange={handleAccountChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 outline-none" placeholder="e.g. Acme Corp" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Website</label>
              <input name="website" value={account.website} onChange={handleAccountChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 outline-none" placeholder="https://acme.com" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Industry</label>
              <select name="industry" value={account.industry} onChange={handleAccountChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 outline-none">
                <option value="">Select Industry</option>
                <option value="ECOM">E-Commerce</option>
                <option value="IT">IT / Software</option>
                <option value="FOOD">Food & Beverage</option>
                <option value="FNC">Finance</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">No. of Employees</label>
              <input type="number" name="noOfEmployees" value={account.noOfEmployees} onChange={handleAccountChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 outline-none" placeholder="e.g. 50" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">City</label>
              <input name="city" value={account.city} onChange={handleAccountChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Country</label>
              <input name="countryRegion" value={account.countryRegion} onChange={handleAccountChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 outline-none" />
            </div>
          </div>

          <div className="mt-6">
            <CustomFieldsSection
              fields={accountFields}
              values={accountCustom}
              onChange={(k, v) => setAccountCustom((prev) => ({ ...prev, [k]: v }))}
              disabled={saving}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <UserPlus className="text-blue-600" size={20} />
              <h2 className="text-lg font-black text-slate-800">Points of Contact</h2>
            </div>
            <button onClick={addContact} className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">
              <Plus size={14} /> Add POC
            </button>
          </div>

          <div className="space-y-6">
            {contacts.map((contact, index) => (
              <div key={index} className="relative bg-slate-50 p-4 rounded-xl border border-slate-200">
                {contacts.length > 1 && (
                  <button onClick={() => removeContact(index)} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500">
                    <X size={16} />
                  </button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">First Name *</label>
                    <input value={contact.firstName} onChange={(e) => handleContactChange(index, 'firstName', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 outline-none bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Last Name *</label>
                    <input value={contact.lastName} onChange={(e) => handleContactChange(index, 'lastName', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 outline-none bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Email</label>
                    <input type="email" value={contact.email} onChange={(e) => handleContactChange(index, 'email', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 outline-none bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Phone</label>
                    <input value={contact.phone} onChange={(e) => handleContactChange(index, 'phone', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 outline-none bg-white" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-600 block mb-1">Job Title</label>
                    <input value={contact.title} onChange={(e) => handleContactChange(index, 'title', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 outline-none bg-white" placeholder="e.g. CEO, Manager" />
                  </div>
                </div>
                <div className="mt-4">
                  <CustomFieldsSection
                    fields={contactFields}
                    values={contact.custom}
                    onChange={(k, v) => handleContactCustom(index, k, v)}
                    disabled={saving}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
