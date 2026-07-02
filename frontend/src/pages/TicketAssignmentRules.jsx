// frontend/src/pages/TicketAssignmentRules.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import { 
  Plus, X, Edit, Trash2, Save, 
  User, Mail, Tag, Check, AlertCircle,
  ChevronLeft, ChevronRight, Search
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const TicketAssignmentRules = () => {
  const { isCollapsed } = useSidebar();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    category: '',
    subcategory: '',
    subItem: '',
    assigneeEmail: '',
    assigneeName: '',
    priority: 0,
    isActive: true
  });

  const categories = ['Finance', 'HR', 'Payroll', 'Sales', 'Production', 'Admin', 'IT', 'Development'];
  const subcategories = {
    'Finance': ['Reimbursement', 'Payment Requests', 'Invoice Management'],
    'HR': ['Employee Documents', 'Attendance & Leave', 'Employee Management'],
    'Payroll': ['Salary', 'Incentives', 'Tax & Deductions'],
    'Sales': ['Lead Management', 'Proposal & Pricing', 'Client Support'],
    'Production': ['Data Extraction', 'Data Quality', 'Delivery', 'Maintenance', 'Feasibility', 'KUIPER'],
    'Admin': ['Agency', 'Procurement', 'Facilities', 'IT', 'Technical Support'],
    'IT': ['Access Management', 'Technical/Support', 'Software Tools'],
    'Development': ['New Feature Request']
  };

  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/ticket-rules`, authHeader);
      setRules(res.data.rules || []);
    } catch (err) {
      console.error('Error fetching rules:', err);
      toast.error('Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.category || !formData.assigneeEmail) {
      toast.error('Category and Assignee Email are required');
      return;
    }

    try {
      let response;
      if (editingRule) {
        response = await axios.put(
          `${API_BASE_URL}/api/admin/ticket-rules/${editingRule._id}`,
          formData,
          authHeader
        );
        toast.success('Rule updated successfully');
      } else {
        response = await axios.post(
          `${API_BASE_URL}/api/admin/ticket-rules`,
          formData,
          authHeader
        );
        toast.success('Rule created successfully');
      }
      
      setShowModal(false);
      setEditingRule(null);
      setFormData({
        category: '',
        subcategory: '',
        subItem: '',
        assigneeEmail: '',
        assigneeName: '',
        priority: 0,
        isActive: true
      });
      fetchRules();
    } catch (err) {
      console.error('Error saving rule:', err);
      toast.error(err.response?.data?.error || 'Failed to save rule');
    }
  };

  const handleDelete = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/ticket-rules/${ruleId}`, authHeader);
      toast.success('Rule deleted successfully');
      fetchRules();
    } catch (err) {
      console.error('Error deleting rule:', err);
      toast.error('Failed to delete rule');
    }
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      category: rule.category,
      subcategory: rule.subcategory || '',
      subItem: rule.subItem || '',
      assigneeEmail: rule.assigneeEmail,
      assigneeName: rule.assigneeName || '',
      priority: rule.priority || 0,
      isActive: rule.isActive !== undefined ? rule.isActive : true
    });
    setShowModal(true);
  };

  const filteredRules = rules.filter(rule => {
    const search = searchTerm.toLowerCase();
    return (
      rule.category?.toLowerCase().includes(search) ||
      rule.subcategory?.toLowerCase().includes(search) ||
      rule.assigneeEmail?.toLowerCase().includes(search) ||
      rule.assigneeName?.toLowerCase().includes(search)
    );
  });

  const totalPages = Math.ceil(filteredRules.length / itemsPerPage);
  const currentRules = filteredRules.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Ticket Assignment Rules</h1>
          <p className="text-slate-500 mt-1">Configure automatic ticket assignment based on category</p>
        </div>
        <button
          onClick={() => {
            setEditingRule(null);
            setFormData({
              category: '',
              subcategory: '',
              subItem: '',
              assigneeEmail: '',
              assigneeName: '',
              priority: 0,
              isActive: true
            });
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all"
        >
          <Plus size={20} />
          Add Rule
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search rules by category, email, or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 text-sm"
          />
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Category</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Subcategory</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Sub-Item</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Assignee</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Priority</th>
                <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th>
                <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex justify-center">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  </td>
                </tr>
              ) : currentRules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <Mail size={48} className="text-slate-300 mb-4" />
                      <p className="text-slate-500 font-medium">No rules configured</p>
                      <p className="text-xs text-slate-400 mt-1">Create a rule to auto-assign tickets</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentRules.map((rule) => (
                  <tr key={rule._id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-all">
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-blue-100 text-blue-700 border border-blue-200">
                        {rule.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">
                      {rule.subcategory || <span className="text-slate-400 italic">Any</span>}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">
                      {rule.subItem || <span className="text-slate-400 italic">Any</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                          {rule.assigneeName?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{rule.assigneeName || rule.assigneeEmail}</p>
                          <p className="text-xs text-slate-500">{rule.assigneeEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-600">{rule.priority}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${
                        rule.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {rule.isActive ? <Check size={10} /> : <AlertCircle size={10} />}
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(rule)}
                          className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(rule._id)}
                          className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center items-center gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={14} />
          </button>
          <div className="flex gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
                if (i === 4) pageNum = totalPages;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
                if (i === 0) pageNum = 1;
                if (i === 4) pageNum = totalPages;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-6 h-6 rounded-md text-[10px] font-black transition-all ${
                    currentPage === pageNum
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-800">
                  {editingRule ? 'Edit Assignment Rule' : 'Create Assignment Rule'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Configure automatic ticket assignment based on category
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Category */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      category: e.target.value,
                      subcategory: '',
                      subItem: ''
                    });
                  }}
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-semibold text-sm text-slate-700 focus:border-blue-400 transition-colors cursor-pointer"
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Subcategory (Optional)
                </label>
                <select
                  value={formData.subcategory}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      subcategory: e.target.value,
                      subItem: ''
                    });
                  }}
                  disabled={!formData.category}
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-semibold text-sm text-slate-700 focus:border-blue-400 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <option value="">Any Subcategory</option>
                  {(subcategories[formData.category] || []).map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              {/* Sub-Item */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Sub-Item (Optional - for specific ticket types)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Report Bug, Leave Approval, etc."
                  value={formData.subItem}
                  onChange={(e) => setFormData({ ...formData, subItem: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-medium text-sm text-slate-700 focus:border-blue-400 transition-colors"
                />
                <p className="text-[8px] text-slate-400 mt-1">
                  Specific sub-item for precise matching (e.g., "Report Bug" in Development category)
                </p>
              </div>

              {/* Assignee Email */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Assignee Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="e.g., support@yourcompany.com"
                    value={formData.assigneeEmail}
                    onChange={(e) => setFormData({ ...formData, assigneeEmail: e.target.value })}
                    className="w-full pl-10 pr-4 p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-medium text-sm text-slate-700 focus:border-blue-400 transition-colors"
                  />
                </div>
              </div>

              {/* Assignee Name */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Assignee Name (Optional)
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g., Support Team"
                    value={formData.assigneeName}
                    onChange={(e) => setFormData({ ...formData, assigneeName: e.target.value })}
                    className="w-full pl-10 pr-4 p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-medium text-sm text-slate-700 focus:border-blue-400 transition-colors"
                  />
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Priority (Higher = More Specific Match)
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-semibold text-sm text-slate-700 focus:border-blue-400 transition-colors cursor-pointer"
                >
                  <option value={0}>0 - Lowest</option>
                  <option value={1}>1 - Low</option>
                  <option value={2}>2 - Medium</option>
                  <option value={3}>3 - High</option>
                  <option value={4}>4 - Highest</option>
                </select>
                <p className="text-[8px] text-slate-400 mt-1">
                  When multiple rules match, the highest priority wins.
                </p>
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-slate-700 cursor-pointer">
                  Rule is Active
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Save size={18} />
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketAssignmentRules;