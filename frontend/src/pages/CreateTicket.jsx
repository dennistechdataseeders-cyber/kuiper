// frontend/src/pages/CreateTicket.jsx

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Send, Lock, Globe, Tag, Layers, ChevronDown, ChevronUp, 
  Users, Briefcase, AlertCircle, Clock, FileText, CheckCircle, Info,
  Building2, Hash, Sparkles, Zap, UserCheck, GitFork, Paperclip,
  UploadCloud, File, FileSpreadsheet, FileArchive, FileVideo, 
  FileAudio, FileCode, X, Image, Download, Eye
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
      ],
      'Feasibility': [],
      'KUIPER': [
        'Report Bug',
        'Latency',
        'Request New Feature',
        'Login Issue',
        'Forget Password',
        'Forget Username'
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

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_EXTENSIONS = [
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.rtf', '.odt', '.ods',
  // Archives
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
  // Presentations
  '.ppt', '.pptx', '.odp',
  // Video
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg',
  // Audio
  '.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.wma',
  // Code/Config
  '.json', '.xml', '.yaml', '.yml', '.ini', '.cfg', '.conf',
  '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss', '.sass',
  '.py', '.java', '.cpp', '.c', '.h', '.php', '.rb', '.go', '.rs',
  '.sh', '.bash', '.bat', '.ps1', '.cmd',
  '.exe'
];

const getFileExtension = (filename) => {
  if (!filename) return '';
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? '.' + ext : '';
};

const isImageFile = (filename) => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
  return imageExtensions.includes(getFileExtension(filename));
};

const isAllowedFile = (file) => {
  const ext = getFileExtension(file.name);
  return ALLOWED_EXTENSIONS.includes(ext);
};

const getFileIcon = (file) => {
  const ext = file.name?.split('.').pop()?.toLowerCase() || '';
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return <Image size={16} className="text-blue-500" />;
  }
  if (['pdf'].includes(ext)) return <FileText size={16} className="text-red-500" />;
  if (['doc', 'docx'].includes(ext)) return <FileText size={16} className="text-blue-600" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={16} className="text-green-600" />;
  if (['zip', 'rar', '7z'].includes(ext)) return <FileArchive size={16} className="text-amber-600" />;
  if (['mp4', 'avi', 'mkv'].includes(ext)) return <FileVideo size={16} className="text-indigo-500" />;
  if (['mp3', 'wav', 'aac'].includes(ext)) return <FileAudio size={16} className="text-pink-500" />;
  if (['js', 'py', 'java', 'json', 'xml'].includes(ext)) return <FileCode size={16} className="text-purple-500" />;
  return <File size={16} className="text-slate-400" />;
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
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
    subItem: '',
    assignedTo: ''
  });
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubcategoryOpen, setIsSubcategoryOpen] = useState(false);
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');
  const currentUserId = localStorage.getItem('userId');

  // ============================================
  // FILE UPLOAD STATE
  // ============================================
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Check if user is Client
  const isClient = userRole === 'Client';
  
  // Check if user can see project/feed selection
  const canSeeProjectFeed = userRole === 'Client' || userRole === 'Project Manager' || userRole === 'Team Lead';
  
  // Check if Feasibility is selected (which hides project/feed selection)
  const isFeasibility = formData.category === 'Production' && formData.subcategory === 'Feasibility';
  
  // Get available categories based on role
  const getAvailableCategories = () => {
    if (isClient) {
      return CLIENT_CATEGORIES;
    }
    return TICKET_CATEGORIES;
  };

  // ============================================
  // FILE HANDLERS
  // ============================================

  const validateFile = (file) => {
    if (!isAllowedFile(file)) {
      toast.error(`File type "${file.name}" is not supported.`);
      return false;
    }
    
    const isImage = isImageFile(file.name);
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    
    if (file.size > maxSize) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
      const maxSizeInMB = isImage ? '5MB' : '50MB';
      toast.error(`${file.name} (${sizeInMB}MB) exceeds the ${maxSizeInMB} size limit.`);
      return false;
    }
    
    return true;
  };

  const processFiles = (files) => {
    const validFiles = [];
    const validPreviews = [];

    files.forEach(file => {
      if (validateFile(file)) {
        validFiles.push(file);
        
        let previewUrl = null;
        if (isImageFile(file.name)) {
          previewUrl = URL.createObjectURL(file);
        }
        
        validPreviews.push({
          file: file,
          name: file.name,
          size: file.size,
          type: file.type,
          preview: previewUrl,
          id: Date.now() + Math.random().toString(36).substr(2, 9)
        });
      }
    });

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setFilePreviews(prev => [...prev, ...validPreviews]);
      
      const imageCount = validFiles.filter(f => isImageFile(f.name)).length;
      const docCount = validFiles.filter(f => !isImageFile(f.name)).length;
      
      let message = `${validFiles.length} file(s) added`;
      if (imageCount > 0 && docCount > 0) {
        message = `${imageCount} image(s) and ${docCount} document(s) added`;
      } else if (imageCount > 0) {
        message = `${imageCount} image(s) added`;
      } else {
        message = `${docCount} document(s) added`;
      }
      toast.success(message);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => {
      const removed = prev[index];
      if (removed && removed.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return [];
    
    const uploadedUrls = [];
    setUploadingFiles(true);

    const token = localStorage.getItem('token');

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await axios.post(`${API_BASE_URL}/api/tickets/upload-file`, formData, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        
        if (response.data.success) {
          uploadedUrls.push({
            url: response.data.url,
            filename: response.data.filename,
            originalName: response.data.originalName,
            size: response.data.size,
            type: response.data.type || (isImageFile(file.name) ? 'image' : 'document')
          });
        }
      } catch (error) {
        console.error('File upload failed:', error);
        toast.error(`Failed to upload ${file.name}: ${error.response?.data?.error || 'Unknown error'}`);
      }
    }

    setUploadingFiles(false);
    return uploadedUrls;
  };

  // ============================================
  // EFFECTS
  // ============================================

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
    const subcategory = categories[formData.category]?.subcategories[formData.subcategory];
    if (Array.isArray(subcategory)) {
      return subcategory;
    }
    return subcategory || [];
  };

  // Check if subcategory has sub-items
  const hasSubItems = () => {
    if (!formData.category || !formData.subcategory) return false;
    const categories = getAvailableCategories();
    const subcategory = categories[formData.category]?.subcategories[formData.subcategory];
    return Array.isArray(subcategory) && subcategory.length > 0;
  };

  // Auto-generate ticket type from category selection
  useEffect(() => {
    if (formData.category && formData.subcategory && formData.subItem) {
      setFormData(prev => ({
        ...prev,
        ticketType: formData.subItem
      }));
    } else if (formData.category && formData.subcategory) {
      if (formData.category === 'Production' && formData.subcategory === 'Feasibility') {
        setFormData(prev => ({
          ...prev,
          ticketType: 'Feasibility',
          projectId: null,
          feedId: null
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          ticketType: formData.subcategory
        }));
      }
    } else if (formData.category) {
      setFormData(prev => ({
        ...prev,
        ticketType: formData.category
      }));
    }
  }, [formData.category, formData.subcategory, formData.subItem]);

  // Reset project/feed when Feasibility is selected/unselected
  useEffect(() => {
    if (isFeasibility) {
      setFormData(prev => ({
        ...prev,
        projectId: null,
        feedId: null
      }));
    }
  }, [isFeasibility]);

  // Fetch developers when component mounts or when Feasibility is selected
  useEffect(() => {
    if (isFeasibility) {
      fetchDevelopers();
    }
  }, [isFeasibility]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      let clientProjects = [];
      
      if (userRole === 'Client') {
        try {
          const res = await axios.get(`${API_BASE_URL}/api/admin/client/projects`, { headers });
          clientProjects = res.data || [];
        } catch (err) {
          console.log('Client projects endpoint failed, trying fallback');
        }
        
        if (clientProjects.length === 0) {
          const allProjectsRes = await axios.get(`${API_BASE_URL}/api/admin/projects`, { headers });
          const userOrgId = localStorage.getItem('organizationId');
          clientProjects = allProjectsRes.data.filter(project => {
            if (project.organizations && Array.isArray(project.organizations)) {
              return project.organizations.some(org => {
                const orgId = typeof org === 'object' ? org._id : org;
                return String(orgId) === String(userOrgId);
              });
            }
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
        const res = await axios.get(`${API_BASE_URL}/api/admin/projects`, { headers });
        clientProjects = res.data.filter(project => 
          project.projectManager?._id === currentUserId || 
          project.projectManager === currentUserId
        );
      } else if (userRole === 'Team Lead') {
        const res = await axios.get(`${API_BASE_URL}/api/teamlead/my-projects`, { headers });
        clientProjects = res.data.projects || [];
      } else {
        clientProjects = [];
      }
      
      setProjects(clientProjects);
      setFilteredProjects(clientProjects);
      
    } catch (error) {
      console.error('Error fetching projects:', error);
      setFilteredProjects([]);
    }
  };

  const fetchDevelopers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/admin/users/developers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDevelopers(res.data || []);
    } catch (error) {
      console.error('Error fetching developers:', error);
      setDevelopers([]);
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

  // ============================================
  // SUBMIT HANDLER (UPDATED WITH FILES)
  // ============================================

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (isClient && !formData.projectId && !isFeasibility) {
      toast.error('Please select a project for this ticket');
      return;
    }
    
    if (isFeasibility && !formData.assignedTo) {
      toast.error('Please assign a developer for feasibility assessment');
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // Upload files first if any
      let uploadedFiles = [];
      if (selectedFiles.length > 0) {
        uploadedFiles = await uploadFiles();
      }
      
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
        subItem: formData.subItem || undefined,
        assignedTo: formData.assignedTo || null,
        // Include files in the payload
        files: uploadedFiles
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
                {isClient ? 'Create New Ticket' : 'Create Ticket'}
              </h1>
              <p className="text-slate-500 mt-1">
                {isClient  
                  ? 'Submit a support request for your project' 
                  : 'Submit an internal ticket for team members only'}
              </p>
            </div>
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

              {/* Feasibility Mode Banner */}
              {isFeasibility && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="p-2 bg-purple-200 rounded-lg">
                    <Info size={16} className="text-purple-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-purple-800">Feasibility Request</p>
                    <p className="text-xs text-purple-700 mt-0.5">
                      This ticket is for feasibility assessment. Project and Feed will be set to <span className="font-medium">General</span>.
                      Please assign a developer for assessment.
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
                          ticketType: '',
                          assignedTo: ''
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
                          ticketType: '',
                          assignedTo: ''
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

                  {/* Sub-Item Dropdown - HIDDEN for Feasibility */}
                  {!isFeasibility && hasSubItems() && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">
                        Specific Issue
                      </label>
                      <select
                        required={!isFeasibility}
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
                  )}
                  
                  {/* Feasibility info - no sub-items */}
                  {isFeasibility && (
                    <div className="flex items-center justify-center bg-purple-50 border-2 border-purple-200 rounded-xl p-3">
                      <span className="text-xs font-medium text-purple-700">No specific issue selection needed</span>
                    </div>
                  )}
                </div>

                {/* Selected Category Display */}
                {formData.category && formData.subcategory && (
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
                      {formData.subItem && !isFeasibility && (
                        <>
                          <span className="text-slate-400">→</span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 rounded-lg border border-blue-200 text-blue-700 font-medium">
                            {formData.subItem}
                          </span>
                        </>
                      )}
                      {isFeasibility && (
                        <span className="text-[8px] font-black text-purple-600 bg-purple-100 px-2 py-1 rounded-lg">
                          General Assessment
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Developer Assignment - Only for Feasibility */}
              {isFeasibility && (
                <div className="bg-purple-50/80 rounded-xl p-5 border-2 border-purple-200/50">
                  <div className="flex items-center gap-2 mb-3">
                    <UserCheck size={18} className="text-purple-600" />
                    <label className="text-sm font-semibold text-purple-700">
                      Assign Developer <span className="text-red-500">*</span>
                    </label>
                  </div>
                  
                  <select
                    required
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none text-slate-700 text-sm cursor-pointer"
                  >
                    <option value="">Select a developer for feasibility assessment</option>
                    {developers.length === 0 ? (
                      <option value="" disabled>No developers available</option>
                    ) : (
                      developers.map(dev => (
                        <option key={dev._id} value={dev._id}>
                          {dev.name} {dev.githubUsername ? `(${dev.githubUsername})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                  
                  {developers.length > 0 && formData.assignedTo && (
                    <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200 flex items-center gap-3">
                      {developers.find(d => d._id === formData.assignedTo)?.githubLinked ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <GitFork size={14} />
                          <span className="text-xs font-medium">GitHub linked</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertCircle size={14} />
                          <span className="text-xs font-medium">GitHub not linked</span>
                        </div>
                      )}
                      <span className="text-xs text-slate-400 ml-auto">
                        Developer will be assigned to this feasibility ticket
                      </span>
                    </div>
                  )}
                  
                  <p className="text-[8px] text-purple-500 mt-2">
                    Select a developer who will assess this feasibility request
                  </p>
                </div>
              )}

              {/* Project and Feed - Hidden for Feasibility */}
              {!isFeasibility && canSeeProjectFeed && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Project Selection */}
                  <div className="bg-slate-50/80 rounded-xl p-5 border-2 border-slate-200/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Briefcase size={18} className="text-blue-600" />
                      <label className="text-sm font-semibold text-slate-700">
                        Project {isClient ? <span className="text-red-500">*</span> : <span className="font-normal text-slate-400">(Optional)</span>}
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
                    {!isClient && (userRole === 'Project Manager' || userRole === 'Team Lead') && (
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

              {/* Feasibility notice - Project/Feed set to General */}
              {isFeasibility && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="p-2 bg-purple-200 rounded-lg">
                    <Building2 size={16} className="text-purple-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-purple-800">Project & Feed: General</p>
                    <p className="text-xs text-purple-600">
                      This feasibility ticket will be assigned to the general pool and assessed by the selected developer.
                    </p>
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

              {/* ============================================
                  FILE ATTACHMENTS SECTION (NEW)
                  ============================================ */}
              <div className="bg-slate-50/80 rounded-xl p-5 border-2 border-slate-200/50">
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip size={18} className="text-blue-600" />
                  <label className="text-sm font-semibold text-slate-700">
                    Attachments <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <span className="text-[8px] text-slate-400 ml-auto">
                    Max: 5MB per image, 50MB per file
                  </span>
                </div>
                
                {/* File Preview */}
                {filePreviews.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2 p-3 bg-white rounded-lg border border-slate-200">
                    {filePreviews.map((preview, idx) => (
                      <div key={preview.id || idx} className="relative group">
                        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                            {preview.file.type?.startsWith('image/') || isImageFile(preview.name) ? (
                              <img 
                                src={preview.preview || URL.createObjectURL(preview.file)} 
                                alt={preview.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              getFileIcon(preview.file)
                            )}
                          </div>
                          <div className="min-w-0 max-w-[120px]">
                            <p className="text-[10px] font-semibold text-slate-700 truncate">{preview.name}</p>
                            <p className="text-[8px] text-slate-400">{formatFileSize(preview.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md opacity-0 group-hover:opacity-100"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Drop Zone */}
                <div
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    isDragging 
                      ? 'border-blue-500 bg-blue-50/80' 
                      : 'border-slate-300 bg-white hover:border-blue-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  
                  <div className="flex flex-col items-center gap-2">
                    <UploadCloud size={32} className={isDragging ? 'text-blue-600' : 'text-slate-400'} />
                    <p className="text-sm font-medium text-slate-600">
                      {isDragging ? 'Drop files here...' : 'Drag & drop files here, or click to select'}
                    </p>
                    <p className="text-[8px] text-slate-400">
                      Supports images, documents, archives, code, and media files
                    </p>
                    <p className="text-[7px] text-slate-300">
                      {filePreviews.length} file(s) selected
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={loading || (isFeasibility && !formData.assignedTo)}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-200/50 hover:shadow-xl hover:shadow-blue-300/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {uploadingFiles ? 'Uploading Files...' : 'Creating Ticket...'}
                    </>
                  ) : (
                    <>
                      {isClient ? <Send size={18} /> : <Lock size={18} />}
                      {isClient ? 'Submit Ticket' : 'Create Ticket'}
                      {selectedFiles.length > 0 && ` (${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''})`}
                    </>
                  )}
                </button>
                {isFeasibility && !formData.assignedTo && (
                  <p className="text-xs text-amber-600 mt-2 text-center">
                    Please assign a developer to create this feasibility ticket
                  </p>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateTicket;