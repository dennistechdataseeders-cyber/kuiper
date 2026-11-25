// frontend/src/pages/CustomizeModules.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Settings, Plus, Trash2, X, ChevronRight, Loader2, 
  Layout, Users, Building2, Handshake, CheckSquare, 
  Video, PhoneCall, Briefcase, Type, List, Calendar,
  Hash, DollarSign, Percent, Check, Upload
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

// All available field types mapped to icons for the UI
const FIELD_TYPES = [
  { type: 'Single Line', icon: Type },
  { type: 'Multi-Line', icon: List },
  { type: 'Email', icon: Layout },
  { type: 'Phone', icon: PhoneCall },
  { type: 'Pick List', icon: List },
  { type: 'Multi-Select', icon: List },
  { type: 'Date', icon: Calendar },
  { type: 'Date/Time', icon: Calendar },
  { type: 'Number', icon: Hash },
  { type: 'Auto-Number', icon: Hash },
  { type: 'Currency', icon: DollarSign },
  { type: 'Decimal', icon: Hash },
  { type: 'Percent', icon: Percent },
  { type: 'Long Integer', icon: Hash },
  { type: 'Checkbox', icon: CheckSquare },
  { type: 'URL', icon: Layout },
  { type: 'Lookup', icon: ChevronRight },
  { type: 'Multi User', icon: Users },
  { type: 'Formula', icon: Hash },
  { type: 'User', icon: Users },
  { type: 'File Upload', icon: Upload },
  { type: 'Image Upload', icon: Upload },
  { type: 'Address', icon: Building2 },
];

// Field types whose choices are defined by the admin (need an options list)
const OPTION_TYPES = ['Pick List', 'Multi-Select'];

const MODULES = [
  { name: 'Leads', icon: Layout },
  { name: 'Contacts', icon: Users },
  { name: 'Accounts', icon: Building2 },
  { name: 'Deals', icon: Handshake },
  { name: 'Tasks', icon: CheckSquare },
  { name: 'Meetings', icon: Video },
  { name: 'Calls', icon: PhoneCall },
  { name: 'Projects', icon: Briefcase },
];

export default function CustomizeModules() {
  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [activeModule, setActiveModule] = useState(null);
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  
  // Drawer State
  const [showDrawer, setShowDrawer] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New Field Form State
  const [formData, setFormData] = useState({
    label: '',
    type: 'Single Line',
    isRequired: false,
    options: [], // For Pick List
    newOption: '',
    lookupModule: ''
  });

  // Fetch fields when module changes
  useEffect(() => {
    if (activeModule) {
      fetchFields(activeModule.name);
    }
  }, [activeModule]);

  const fetchFields = async (moduleName) => {
    setLoadingFields(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/module-fields/${moduleName}`, authHeader);
      setFields(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load fields');
    } finally {
      setLoadingFields(false);
    }
  };

  const handleModuleClick = (mod) => {
    setActiveModule(mod);
    setShowDrawer(true);
    setShowAddForm(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      label: '',
      type: 'Single Line',
      isRequired: false,
      options: [],
      newOption: '',
      lookupModule: ''
    });
  };

  const handleAddOption = () => {
    if (!formData.newOption.trim()) return;
    const newOption = {
      label: formData.newOption.trim(),
      value: formData.newOption.trim().toLowerCase().replace(/\s+/g, '_')
    };
    // Prevent duplicates
    if (formData.options.some(o => o.value === newOption.value)) {
      return toast.error('Option already exists');
    }
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, newOption],
      newOption: ''
    }));
  };

  const handleRemoveOption = (index) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

 const handleSaveField = async (e) => {
  e.preventDefault();
  if (!formData.label.trim()) return toast.error('Field label is required');

  // Include an option that was typed but not yet added with "Add"
  let options = [...formData.options];
  const pending = formData.newOption.trim();
  if (pending) {
    const value = pending.toLowerCase().replace(/\s+/g, '_');
    if (!options.some(o => o.value === value)) {
      options.push({ label: pending, value });
    }
  }

  const needsOptions = OPTION_TYPES.includes(formData.type);
  if (!needsOptions) options = []; // never send stale options for other types

  if (needsOptions && options.length === 0) {
    return toast.error(`Add at least one option for a ${formData.type}`);
  }

  setIsSubmitting(true);
  try {
    await axios.post(
      `${API_BASE_URL}/api/module-fields/${activeModule.name}`,
      { ...formData, options },
      authHeader
    );
    toast.success('Field created successfully');
    setShowAddForm(false);
    resetForm();
    fetchFields(activeModule.name);
  } catch (err) {
    toast.error(err.response?.data?.error || 'Failed to create field');
  } finally {
    setIsSubmitting(false);
  }
}; 

  const handleDeleteField = async (id) => {
    if (!window.confirm('Delete this field? Data associated with it will be lost.')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/module-fields/${id}`, authHeader);
      toast.success('Field deleted');
      fetchFields(activeModule.name);
    } catch (err) {
      toast.error('Failed to delete field');
    }
  };

  return (
    <div className="page bg-[#f4f6fa]">
      
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="p-3 bg-blue-600 rounded-xl text-white">
          <Settings size={24} />
        </div>
        <div>
          <h1 className="page-title">Customization</h1>
          <p className="text-sm text-slate-500">Modules and Fields</p>
        </div>
      </div>

      {/* MODULE GRID */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.name}
              onClick={() => handleModuleClick(mod)}
              className="card cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group flex flex-col items-center justify-center min-h-40 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shrink-0">
                <Icon size={24} />
              </div>
              <h3 className="section-title">{mod.name}</h3>
              <p className="text-xs text-slate-400 mt-1">Manage Fields</p>
            </div>
          );
        })}
      </div>

      {/* DRAWER OVERLAY */}
      {showDrawer && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowDrawer(false)}
          />

          {/* Drawer Content */}
          <div className="dark-panel relative w-full max-w-md bg-[#0f172a] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-700/50 flex justify-between items-center gap-3">
              <div>
                <h2 className="section-title text-white">{activeModule?.name}</h2>
                <p className="text-xs text-slate-400 mt-1">Manage custom fields</p>
              </div>
              <button 
                onClick={() => setShowDrawer(false)}
                className="btn-icon bg-slate-800 text-slate-400 hover:text-white rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              
              {/* Existing Fields List */}
              {loadingFields ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
              ) : fields.length === 0 && !showAddForm ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  No custom fields yet.
                </div>
              ) : (
                fields.map((field) => {
                  const TypeIcon = FIELD_TYPES.find(f => f.type === field.type)?.icon || Type;
                  return (
                    <div key={field._id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center shrink-0">
                          <TypeIcon size={14} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {field.label} {field.isRequired && <span className="text-red-400">*</span>}
                          </p>
                          <p className="text-xs text-slate-400 uppercase tracking-wide">{field.type}</p>
                          {OPTION_TYPES.includes(field.type) && (field.options || []).length > 0 && (
                            <p className="text-xs text-slate-500 mt-0.5 normal-case">{field.options.map(o => o.label).join(', ')}</p>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteField(field._id)}
                        className="btn-icon text-slate-500 hover:text-red-400 hover:bg-red-400/10 md:opacity-0 md:group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
              )}

              {/* ADD NEW FIELD FORM */}
              {showAddForm ? (
                <div className="bg-slate-800 rounded-xl p-4 border border-blue-500/30 mt-4 animate-in fade-in">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="section-title text-white">New Field</h3>
                    <button onClick={() => setShowAddForm(false)} className="btn-icon text-slate-400 hover:text-white">
                      <X size={16} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveField} className="space-y-4">
                    {/* Label */}
                    <div>
                      <label className="label block mb-1.5">Field Label *</label>
                      <input 
                        type="text" 
                        required
                        value={formData.label}
                        onChange={(e) => setFormData({...formData, label: e.target.value})}
                        className="input"
                        placeholder="e.g. Referral Source"
                      />
                    </div>

                    {/* Type Selector (Grid mimicking your screenshot) */}
                    <div>
                      <label className="label block mb-1.5">Field Type</label>
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {FIELD_TYPES.map((ft) => {
                          const Icon = ft.icon;
                          const isSelected = formData.type === ft.type;
                          return (
                            <button
                              key={ft.type}
                              type="button"
                              onClick={() => setFormData({...formData, type: ft.type})}
                              className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium border transition-all ${
                                isSelected 
                                  ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                              }`}
                            >
                              <Icon size={12} />
                              {ft.type}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pick List Specific Options */}
                    {OPTION_TYPES.includes(formData.type) && (
                      <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                        <label className="label block mb-1.5">{formData.type === 'Multi-Select' ? 'Choices' : 'Dropdown Options'}</label>
                        
                        {/* Existing Options */}
                        <div className="space-y-1 mb-2">
                          {formData.options.map((opt, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-800 px-2 py-1.5 rounded text-xs text-white">
                              <span>{opt.label}</span>
                              <button type="button" onClick={() => handleRemoveOption(idx)} className="btn-icon text-red-400 hover:text-red-300">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Add Option Input */}
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={formData.newOption}
                            onChange={(e) => setFormData({...formData, newOption: e.target.value})}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                            className="input flex-1 min-w-0"
                            placeholder="Add option..."
                          />
                          <button 
                            type="button"
                            onClick={handleAddOption}
                            className="btn btn-md bg-blue-600 text-white hover:bg-blue-500"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Required Checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={formData.isRequired}
                        onChange={(e) => setFormData({...formData, isRequired: e.target.checked})}
                        className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
                      />
                      <span className="text-xs text-slate-300">Make this field required</span>
                    </label>

                    {/* Submit Button */}
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="btn btn-md w-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Save Field
                    </button>
                  </form>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full py-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-blue-400 hover:border-blue-500/50 hover:bg-slate-800/50 flex flex-col items-center justify-center gap-2 transition-all mt-6"
                >
                  <Plus size={24} />
                  <span className="text-sm font-bold">ADD NEW FIELD</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}