import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Send, Lock, Globe, Tag, Layers, ChevronDown, ChevronUp, 
  Users, Briefcase, AlertCircle, Clock, FileText, CheckCircle,Info ,
  Building2, Hash, Sparkles, Zap
} from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

// Ticket Category Configuration
const TICKET_CATEGORIES = {
  'Finance': {
    icon: '💰',
    color: 'emerald',
    subcategories: {
      'Reimbursement': [
        'Employee Expense Claim',
        'Client Meeting Expense',
        'Travel Expense',
        'Internet/Mobile Expense',
        'Office Purchase Expense'
      ],
      'Payment Requests': [
        'Vendor Payment',
        'Advance Payment',
        'Contractor Payment'
      ],
      'Invoice Management': [
        'Generate Invoice',
        'Revise Invoice',
        'Client Billing Query'
      ]
    }
  },
  'HR': {
    icon: '👥',
    color: 'pink',
    subcategories: {
      'Employee Documents': [
        'Employment Letter',
        'Salary Certificate',
        'Experience Letter'
      ],
      'Attendance & Leave': [
        'Attendance Correction',
        'Leave Regularization',
        'Leave Approval'
      ],
      'Employee Management': [
        'Onboarding',
        'Exit Process',
        'Promotion Request'
      ]
    }
  },
  'Payroll': {
    icon: '💳',
    color: 'blue',
    subcategories: {
      'Salary': [
        'Salary Query',
        'Salary Correction',
        'Missing Salary'
      ],
      'Incentives': [
        'Bonus',
        'Incentive Calculation',
        'Commission Query'
      ],
      'Tax & Deductions': [
        'TDS Query',
        'PF Query'
      ]
    }
  },
  'Sales': {
    icon: '📊',
    color: 'orange',
    subcategories: {
      'Lead Management': [
        'Lead Assignment',
        'Lead Designation'
      ],
      'Proposal & Pricing': [
        'Proposal Creation',
        'Pricing Approval',
        'Dispute Agreement'
      ],
      'Client Support': [
        'Contact Review',
        'VDA Request',
        'Client Escalation'
      ]
    }
  },
  'Production': {
    icon: '⚙️',
    color: 'red',
    subcategories: {
      'Data Extraction': [
        'Feed Not Working',
        'Feed Missing Data',
        'Feed Shortage Outage',
        'Scripts Issues'
      ],
      'Data Quality': [
        'Duplicate Records',
        'Missing Fields',
        'Incorrect Shipping'
      ],
      'Delivery': [
        'Delivery Delayed',
        'Delivery Failed',
        'API Delivery Issue'
      ],
      'Maintenance': [
        'New Feed Request',
        'Editing Feed Enhancement'
      ]
    }
  },
  'Admin': {
    icon: '🛠️',
    color: 'gray',
    subcategories: {
      'Agency': [
        'Lease Request',
        'Uptime Delay',
        'Asset Return'
      ],
      'Procurement': [
        'Machine Purchase',
        'Software Purchase'
      ],
      'Facilities': [
        'Internet Link',
        'Office Workstation'
      ],
      'IT': [
        'Asset Management',
        'Email Access',
        'Database Access',
        'Server Access'
      ],
      'Technical Support': [
        'System Reset'
      ]
    }
  },
  'IT': {
    icon: '💻',
    color: 'cyan',
    subcategories: {
      'Access Management': [
        'Email Access',
        'Database Access',
        'Server Access'
      ],
      'Technical/Support': [
        'System Reset'
      ],
      'Software Tools': [
        'Hardware Issues'
      ]
    }
  },
  'Development': {
    icon: '🚀',
    color: 'violet',
    subcategories: {
      'New Feature Request': [
        'Requirements Request',
        'Bug Report'
      ]
    }
  }
};

// Client-only categories (only Production for clients)
const CLIENT_CATEGORIES = {
  'Production': TICKET_CATEGORIES['Production']
};

const CreateTicket = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    projectId: '',
    feedId: '',
    isInternal: false,
    ticketType: '',
    category: '',
    subcategory: '',
    subItem: ''
  });
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubcategoryOpen, setIsSubcategoryOpen] = useState(false);
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');
  const currentUserId = localStorage.getItem('userId');

  // Check if user is Client
  const isClient = userRole === 'Client';
  
  // Check if user can see project/feed selection (ONLY Client and Project Manager)
  const canSeeProjectFeed = userRole === 'Client' || userRole === 'Project Manager';

  // Get available categories based on role
  const getAvailableCategories = () => {
    if (isClient) {
      return CLIENT_CATEGORIES;
    }
    return TICKET_CATEGORIES;
  };

  // Auto-set internal for non-client roles
  useEffect(() => {
    if (!isClient) {
      setFormData(prev => ({
        ...prev,
        isInternal: true
      }));
    }
  }, [isClient]);

  // Get available subcategories based on selected category
  const getSubcategories = () => {
    if (!formData.category) return [];
    const categories = getAvailableCategories();
    return Object.keys(categories[formData.category]?.subcategories || {});
  };

  // Get available sub-items based on selected category and subcategory
  const getSubItems = () => {
    if (!formData.category || !formData.subcategory) return [];
    const categories = getAvailableCategories();
    return categories[formData.category]?.subcategories[formData.subcategory] || [];
  };

  // Auto-generate ticket type from category selection
  useEffect(() => {
    if (formData.category && formData.subcategory && formData.subItem) {
      setFormData(prev => ({
        ...prev,
        ticketType: formData.subItem
      }));
    } else if (formData.category && formData.subcategory) {
      setFormData(prev => ({
        ...prev,
        ticketType: formData.subcategory
      }));
    } else if (formData.category) {
      setFormData(prev => ({
        ...prev,
        ticketType: formData.category
      }));
    }
  }, [formData.category, formData.subcategory, formData.subItem]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      let clientProjects = [];
      
      if (userRole === 'Client') {
        // For clients, fetch projects they're assigned to
        const userOrgId = localStorage.getItem('organizationId');
        
        try {
          // Try to get projects from client endpoint
          const res = await axios.get(`${API_BASE_URL}/api/admin/client/projects`, { headers });
          clientProjects = res.data || [];
        } catch (err) {
          console.log('Client projects endpoint failed, trying fallback');
        }
        
        // If no projects from client endpoint, try filtering all projects
        if (clientProjects.length === 0) {
          const allProjectsRes = await axios.get(`${API_BASE_URL}/api/admin/projects`, { headers });
          
          clientProjects = allProjectsRes.data.filter(project => {
            // Check organization-based assignment
            if (project.organizations && Array.isArray(project.organizations)) {
              return project.organizations.some(org => {
                const orgId = typeof org === 'object' ? org._id : org;
                return String(orgId) === String(userOrgId);
              });
            }
            // Check direct client assignment
            if (project.clients && Array.isArray(project.clients)) {
              return project.clients.some(client => {
                const clientId = typeof client === 'object' ? client._id : client;
                return String(clientId) === String(currentUserId);
              });
            }
            return false;
          });
        }
      } else if (userRole === 'Project Manager') {
        // For PM, fetch projects they manage
        const res = await axios.get(`${API_BASE_URL}/api/admin/projects`, { headers });
        clientProjects = res.data.filter(project => 
          project.projectManager?._id === currentUserId || 
          project.projectManager === currentUserId
        );
      } else {
        // For other roles (Admin, Developer, Sales, etc.) - no projects
        clientProjects = [];
      }
      
      setProjects(clientProjects);
      setFilteredProjects(clientProjects);
      
    } catch (error) {
      console.error('Error fetching projects:', error);
      setFilteredProjects([]);
    }
  };

  const fetchFeeds = async (projectId) => {
    if (!projectId) {
      setFeeds([]);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tickets/feeds/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeeds(res.data);
    } catch (error) {
      console.error('Error fetching feeds:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    // Only validate project for Client
    if (isClient && !formData.projectId) {
      toast.error('Please select a project for this ticket');
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        projectId: formData.projectId || null,
        feedId: formData.feedId || null,
        isInternal: formData.isInternal,
        ticketType: formData.ticketType || undefined,
        category: formData.category || undefined,
        subcategory: formData.subcategory || undefined,
        subItem: formData.subItem || undefined
      };
      
      await axios.post(`${API_BASE_URL}/api/tickets`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Ticket created successfully!');
      navigate('/tickets');
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast.error(error.response?.data?.error || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  const getProjectDisplayName = (project) => {
    return project.projectCustomId || project.name;
  };

  // Priority options with colors
  const priorityOptions = [
    { value: 'Low', label: 'Low', color: 'bg-green-100 text-green-700 border-green-200' },
    { value: 'Medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    { value: 'High', label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    { value: 'Urgent', label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-200' }
  ];

  const availableCategories = getAvailableCategories();

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Full width container */}
      <div className="w-full">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/tickets')}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors group mb-4"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Tickets</span>
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                {isClient ? 'Create New Ticket' : 'Create  Ticket'}
              </h1>
              <p className="text-slate-500 mt-1">
                {isClient  
                  ? 'Submit a support request for your project' 
                  : 'Submit an internal ticket for team members only'}
              </p>
            </div>
            {!isClient && (
              <div className="flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full border border-purple-200">
                <Lock size={14} className="text-purple-600" />
                <span className="text-xs font-semibold text-purple-700">Internal Mode</span>
              </div>
            )}
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <form onSubmit={handleSubmit}>
            {/* Form Header */}
            <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <FileText size={20} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Ticket Details</h2>
                  <p className="text-xs text-slate-500">Fill in the information below to create a new ticket</p>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8">
             

              {/* Client Mode Badge - Show for clients */}
              {isClient && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="p-2 bg-blue-200 rounded-lg">
                    <Globe size={16} className="text-blue-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Client Ticket Mode</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      As a Client, you can only create <span className="font-medium">Production</span> related tickets.
                      Your tickets will be sent to the internal team for resolution.
                    </p>
                  </div>
                </div>
              )}

              {/* Two Column Layout for Title and Description */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-slate-800 placeholder:text-slate-400"
                      placeholder="Enter a brief summary..."
                    />
                  </div>
                </div>
                
                {/* Priority */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Priority <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {priorityOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, priority: option.value })}
                        className={`px-3 py-2.5 rounded-xl border-2 font-medium text-xs transition-all ${
                          formData.priority === option.value
                            ? `${option.color} border-current shadow-md`
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Description - Full Width */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-slate-800 placeholder:text-slate-400 resize-none"
                  placeholder="Provide a detailed description of the issue..."
                />
              </div>

              {/* Category Selection - Full Width */}
              <div className="bg-slate-50/80 rounded-xl p-6 border-2 border-slate-200/50">
                <div className="flex items-center gap-2 mb-4">
                  <Layers size={18} className="text-blue-600" />
                  <label className="text-sm font-semibold text-slate-700">
                    Category & Subcategory <span className="text-red-500">*</span>
                    {isClient && (
                      <span className="text-xs text-blue-600 font-normal ml-2">(Production Only)</span>
                    )}
                  </label>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Category Dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      Category
                    </label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => {
                        setFormData({ 
                          ...formData, 
                          category: e.target.value,
                          subcategory: '',
                          subItem: '',
                          ticketType: ''
                        });
                        setIsSubcategoryOpen(true);
                      }}
                      className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-slate-700 text-sm cursor-pointer"
                    >
                      <option value="">Select Category</option>
                      {Object.keys(availableCategories).map(cat => (
                        <option key={cat} value={cat}>
                          {availableCategories[cat]?.icon} {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subcategory Dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      Subcategory
                    </label>
                    <select
                      required
                      value={formData.subcategory}
                      onChange={(e) => {
                        setFormData({ 
                          ...formData, 
                          subcategory: e.target.value,
                          subItem: '',
                          ticketType: ''
                        });
                      }}
                      disabled={!formData.category}
                      className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-slate-700 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Subcategory</option>
                      {getSubcategories().map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sub-Item Dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      Specific Issue
                    </label>
                    <select
                      required
                      value={formData.subItem}
                      onChange={(e) => {
                        setFormData({ 
                          ...formData, 
                          subItem: e.target.value,
                          ticketType: e.target.value
                        });
                      }}
                      disabled={!formData.subcategory}
                      className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-slate-700 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Issue Type</option>
                      {getSubItems().map(item => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Selected Category Display */}
                {formData.category && formData.subcategory && formData.subItem && (
                  <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="font-medium text-slate-600">Selected:</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-slate-700 font-medium">
                        {availableCategories[formData.category]?.icon} {formData.category}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-slate-700 font-medium">
                        {formData.subcategory}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 rounded-lg border border-blue-200 text-blue-700 font-medium">
                        {formData.subItem}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Project and Feed - Only show for Client and Project Manager */}
              {canSeeProjectFeed && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Project Selection */}
                  <div className="bg-slate-50/80 rounded-xl p-5 border-2 border-slate-200/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Briefcase size={18} className="text-blue-600" />
                      <label className="text-sm font-semibold text-slate-700">
                        Project {isClient ? <span className="text-red-500">*</span> : <span className="font-normal text-slate-400">(Optional - for PM)</span>}
                      </label>
                    </div>
                    
                    <select
                      required={isClient}
                      value={formData.projectId}
                      onChange={(e) => {
                        setFormData({ ...formData, projectId: e.target.value, feedId: '' });
                        fetchFeeds(e.target.value);
                      }}
                      className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-slate-700 text-sm cursor-pointer"
                    >
                      <option value="">Select a project {isClient ? '*' : '(optional)'}</option>
                      {filteredProjects.length === 0 && isClient ? (
                        <option value="" disabled>No projects assigned to you</option>
                      ) : (
                        filteredProjects.map(project => (
                          <option key={project._id} value={project._id}>
                            {getProjectDisplayName(project)}
                          </option>
                        ))
                      )}
                    </select>
                    {isClient && filteredProjects.length === 0 && (
                      <p className="text-xs text-amber-600 mt-2">
                        No projects assigned. Please contact your project manager.
                      </p>
                    )}
                    {!isClient && userRole === 'Project Manager' && (
                      <p className="text-xs text-slate-400 mt-2">
                        Optionally associate this internal ticket with a project you manage
                      </p>
                    )}
                  </div>

                  {/* Feed Selection */}
                  <div className="bg-slate-50/80 rounded-xl p-5 border-2 border-slate-200/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Hash size={18} className="text-blue-600" />
                      <label className="text-sm font-semibold text-slate-700">
                        Related Feed <span className="font-normal text-slate-400">(Optional)</span>
                      </label>
                    </div>
                    
                    <select
                      value={formData.feedId}
                      onChange={(e) => setFormData({ ...formData, feedId: e.target.value })}
                      disabled={!formData.projectId}
                      className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-slate-700 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select a feed (optional)</option>
                      {feeds.map(feed => (
                        <option key={feed._id} value={feed._id}>
                          {feed.name}
                        </option>
                      ))}
                    </select>
                    {!formData.projectId && (
                      <p className="text-xs text-amber-600 mt-2">Select a project first to see available feeds</p>
                    )}
                  </div>
                </div>
              )}

            

              {/* Ticket Type Display */}
              {formData.ticketType && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-green-200 rounded-lg">
                      <Tag size={16} className="text-green-700" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-green-700">Ticket Type</p>
                      <p className="text-sm font-semibold text-green-800">{formData.ticketType}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-200/50 hover:shadow-xl hover:shadow-blue-300/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating Ticket...
                    </>
                  ) : (
                    <>
                      {isClient ? <Send size={18} /> : <Lock size={18} />}
                      {isClient ? 'Submit Ticket' : 'Create  Ticket'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateTicket;