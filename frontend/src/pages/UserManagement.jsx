// frontend/src/pages/UserManagement.jsx
// COMPLETE UPDATED FILE WITH LEAVE BALANCE MANAGEMENT

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  UserPlus, Edit2, Trash2, ShieldCheck, X, Eye, EyeOff, 
  CheckCircle, AlertCircle, GitFork, Building2, User as UserIcon, 
  Search as SearchIcon, Plus, ChevronDown, ChevronUp, ChevronLeft, 
  ChevronRight, Filter, Users, Hash, RefreshCw, Calendar, Phone, 
  MapPin, Clock as ClockIcon, ChevronRight as ChevronRightIcon,
  Minus, Clock, Settings,Loader2
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import toast from 'react-hot-toast';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [linkingGithub, setLinkingGithub] = useState({});
  const [searchOrgTerm, setSearchOrgTerm] = useState('');
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [showNewOrgForm, setShowNewOrgForm] = useState(false);
  const [newOrgData, setNewOrgData] = useState({
    companyName: '',
    website: '',
    address: ''
  });
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Filter State
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal key to force re-render
  const [modalKey, setModalKey] = useState(0);
  
  // Read-only states to prevent autofill
  const [emailReadOnly, setEmailReadOnly] = useState(true);
  const [passwordReadOnly, setPasswordReadOnly] = useState(true);
  
  // Expand/collapse state for employee details
  const [expandedRows, setExpandedRows] = useState({});
  
  // ============================================
  // LEAVE BALANCE MANAGEMENT STATE
  // ============================================
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedUserForLeave, setSelectedUserForLeave] = useState(null);
  const [leaveBalanceData, setLeaveBalanceData] = useState({
    leaveType: 'Paid Leave',
    action: 'deduct',
    amount: 0.5,
    reason: ''
  });
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState({});
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [loadingLeaveHistory, setLoadingLeaveHistory] = useState(false);
  
  const userRole = localStorage.getItem('role');
  const token = localStorage.getItem('token');
  const storedId = localStorage.getItem('userId');
  const { isCollapsed } = useSidebar();
  
  // Default role based on current user's role
  const getDefaultRole = () => {
    if (userRole === 'Sales Manager') return 'Sales';
    if (userRole === 'Project Manager') return 'Client';
    return 'Client';
  };

  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: getDefaultRole(),
    organizationId: '',
    department: 'Other',
    isPrimaryPOC: false,
    employeeCode: '',
    dateOfJoining: '',
    dateOfBirth: '',
    contactNumber: '',
    emergencyContact: '',
    address: '',
    shiftHour: 9,
    shiftMinute: 0,
    shiftAmPm: 'AM'
  });
  
  const [newlyCreatedUser, setNewlyCreatedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const API_BASE = `${API_BASE_URL}/api/admin`;
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // Available roles for filter
  const roleOptions = useMemo(() => {
    const roles = [...new Set(users.map(user => user.role))];
    return ['ALL', ...roles];
  }, [users]);

  // Filter users based on role and search
  const filteredUsers = useMemo(() => {
    let result = [...users];
    
    if (selectedRole !== 'ALL') {
      result = result.filter(user => user.role === selectedRole);
    }
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(user =>
        user.name?.toLowerCase().includes(search) ||
        user.email?.toLowerCase().includes(search) ||
        user.employeeCode?.toLowerCase().includes(search) ||
        user.contactNumber?.toLowerCase().includes(search) ||
        (user.role === 'Client' && user.organizationId?.companyName?.toLowerCase().includes(search))
      );
    }
    
    if (userRole === 'Sales Manager') {
      result = result.filter(user => user.role === 'Sales');
    }
    if (userRole === 'Project Manager') {
      result = result.filter(user => user.role === 'Client' || user.role === 'Team Lead');
    }
    
    return result;
  }, [users, selectedRole, searchTerm, userRole]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const currentUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRole, searchTerm]);

  useEffect(() => {
    fetchUsers();
    fetchOrganizations();
  }, []);

  const toggleExpandRow = (userId) => {
    setExpandedRows(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/users`, authHeader);
      setUsers(res.data);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast.error("Failed to fetch users");
    }
  };

  const fetchOrganizations = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/orgs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrganizations(res.data);
    } catch (err) {
      console.error("Error fetching organizations:", err);
      toast.error("Failed to load organizations");
      setOrganizations([]);
    }
  };

  // ============================================
  // LEAVE BALANCE FUNCTIONS
  // ============================================
  
  const openLeaveBalanceModal = async (user) => {
    setSelectedUserForLeave(user);
    setLeaveBalanceData({
      leaveType: 'Paid Leave',
      action: 'deduct',
      amount: 0.5,
      reason: ''
    });
    setShowLeaveModal(true);
    await fetchLeaveHistory(user._id);
  };

  const fetchLeaveHistory = async (userId) => {
    setLoadingLeaveHistory(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/admin/users/${userId}/leave-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setLeaveBalances(res.data.data.balances);
        setLeaveHistory(res.data.data.history || []);
      }
    } catch (error) {
      console.error('Error fetching leave history:', error);
      toast.error('Failed to load leave history');
    } finally {
      setLoadingLeaveHistory(false);
    }
  };

  const handleLeaveBalanceUpdate = async (e) => {
    e.preventDefault();
    
    if (!leaveBalanceData.leaveType) {
      toast.error('Please select a leave type');
      return;
    }
    
    if (!leaveBalanceData.amount || leaveBalanceData.amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (leaveBalanceData.amount % 0.5 !== 0) {
      toast.error('Amount must be in increments of 0.5 (e.g., 0.5, 1.0, 1.5)');
      return;
    }
    
    if (!leaveBalanceData.reason.trim()) {
      toast.error('Please provide a reason for this adjustment');
      return;
    }
    
    setSubmittingLeave(true);
    
    try {
      const token = localStorage.getItem('token');
      const payload = {
        leaveType: leaveBalanceData.leaveType,
        amount: parseFloat(leaveBalanceData.amount),
        action: leaveBalanceData.action,
        reason: leaveBalanceData.reason.trim()
      };
      
      const res = await axios.patch(
        `${API_BASE_URL}/api/admin/users/${selectedUserForLeave._id}/leave-balance`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data.success) {
        toast.success(`Leave balance updated successfully!`);
        
        setLeaveBalances(res.data.data.allBalances);
        
        const newHistoryEntry = {
          type: leaveBalanceData.action,
          leaveType: leaveBalanceData.leaveType,
          amount: leaveBalanceData.action === 'deduct' ? -parseFloat(leaveBalanceData.amount) : parseFloat(leaveBalanceData.amount),
          previousBalance: res.data.data.previousBalance,
          newBalance: res.data.data.newBalance,
          reason: leaveBalanceData.reason.trim(),
          date: new Date().toISOString()
        };
        setLeaveHistory([newHistoryEntry, ...leaveHistory]);
        
        setLeaveBalanceData({
          leaveType: 'Paid Leave',
          action: 'deduct',
          amount: 0.5,
          reason: ''
        });
        
        fetchUsers();
      }
    } catch (error) {
      console.error('Error updating leave balance:', error);
      toast.error(error.response?.data?.error || 'Failed to update leave balance');
    } finally {
      setSubmittingLeave(false);
    }
  };

  const closeLeaveModal = () => {
    setShowLeaveModal(false);
    setSelectedUserForLeave(null);
    setLeaveHistory([]);
    setLeaveBalances({});
    setLeaveBalanceData({
      leaveType: 'Paid Leave',
      action: 'deduct',
      amount: 0.5,
      reason: ''
    });
  };

  const handleEditClick = (user) => {
    setIsEditing(true);
    setCurrentUserId(user._id);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'Client',
      organizationId: user.organizationId?._id || user.organizationId || '',
      department: user.department || 'Other',
      isPrimaryPOC: user.isPrimaryPOC || false,
      employeeCode: user.employeeCode || '',
      dateOfJoining: user.dateOfJoining ? new Date(user.dateOfJoining).toISOString().split('T')[0] : '',
      dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
      contactNumber: user.contactNumber || '',
      emergencyContact: user.emergencyContact || '',
      address: user.address || '',
      shiftHour: user.shiftHour || 9,
      shiftMinute: user.shiftMinute || 0,
      shiftAmPm: user.shiftAmPm || 'AM'
    });
    setEmailReadOnly(true);
    setPasswordReadOnly(true);
    setShowNewOrgForm(false);
    setSearchOrgTerm('');
    setNewlyCreatedUser(null);
    setModalKey(prev => prev + 1);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to remove this user?")) {
      try {
        await axios.delete(`${API_BASE}/users/${id}`, authHeader);
        toast.success("User deleted successfully");
        fetchUsers();
      } catch (err) {
        toast.error("Delete failed: " + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleLinkGitHub = async (userId) => {
    setLinkingGithub(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await axios.post(
        `${API_BASE}/users/${userId}/link-github`, 
        {},
        authHeader
      );
      
      if (res.data.success) {
        toast.success(`✅ GitHub account ${res.data.githubUsername} linked successfully!`);
        fetchUsers();
      } else {
        toast.error(res.data.error || 'Failed to link GitHub account');
        
        if (res.data.debug?.tip) {
          toast.custom((t) => (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-md shadow-lg">
              <div className="flex items-start gap-3">
                <div className="text-amber-500 text-xl">💡</div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">GitHub Linking Tip</p>
                  <p className="text-xs text-amber-700 mt-1">{res.data.debug.tip}</p>
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="mt-2 text-xs font-medium text-amber-600 hover:text-amber-800"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ), { duration: 8000 });
        }
      }
    } catch (err) {
      console.error('GitHub linking error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to link GitHub account';
      toast.error(errorMessage);
      if (err.response?.data?.debug) {
        console.log('🔍 Debug info:', err.response.data.debug);
      }
    } finally {
      setLinkingGithub(prev => ({ ...prev, [userId]: false }));
    }
  };

  const createNewOrganization = async () => {
    if (!newOrgData.companyName.trim()) {
      toast.error("Organization name is required");
      return null;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/orgs`, {
        companyName: newOrgData.companyName,
        website: newOrgData.website,
        address: newOrgData.address,
        pointsOfContact: []
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Organization "${newOrgData.companyName}" created successfully`);
      await fetchOrganizations();
      return response.data;
    } catch (err) {
      console.error("Error creating organization:", err);
      toast.error(err.response?.data?.error || "Failed to create organization");
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setNewlyCreatedUser(null);
    
    try {
      let finalOrgId = formData.organizationId;
      
      if (showNewOrgForm && newOrgData.companyName.trim()) {
        const newOrg = await createNewOrganization();
        if (newOrg) {
          finalOrgId = newOrg._id;
        } else {
          setSubmitting(false);
          return;
        }
      }
      
      if (isEditing) {
        const updatePayload = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          organizationId: finalOrgId,
          department: formData.department,
          isPrimaryPOC: formData.isPrimaryPOC,
          employeeCode: formData.employeeCode || null,
          dateOfJoining: formData.dateOfJoining || null,
          dateOfBirth: formData.dateOfBirth || null,
          contactNumber: formData.contactNumber || '',
          emergencyContact: formData.emergencyContact || '',
          address: formData.address || '',
          shiftHour: parseInt(formData.shiftHour) || 9,
          shiftMinute: parseInt(formData.shiftMinute) || 0,
          shiftAmPm: formData.shiftAmPm || 'AM'
        };
        
        if (formData.password && formData.password.trim()) {
          updatePayload.password = formData.password;
        }
        
        await axios.put(`${API_BASE}/users/${currentUserId}`, updatePayload, authHeader);
        toast.success("User updated successfully");
        closeModal();
        fetchUsers();
      } else {
        if (!formData.name || !formData.email || !formData.role) {
          toast.error("Please fill in all required fields");
          setSubmitting(false);
          return;
        }
        
        if (formData.role === 'Client' && !finalOrgId && !showNewOrgForm) {
          toast.error("Please select or create an organization for this POC");
          setSubmitting(false);
          return;
        }
        
        const defaultPassword = formData.password || Math.random().toString(36).slice(-8);
        
        const createPayload = {
          name: formData.name,
          email: formData.email,
          password: defaultPassword,
          role: formData.role,
          organizationId: finalOrgId || null,
          department: formData.department,
          isPrimaryPOC: formData.isPrimaryPOC,
          employeeCode: formData.employeeCode || null,
          dateOfJoining: formData.dateOfJoining || null,
          dateOfBirth: formData.dateOfBirth || null,
          contactNumber: formData.contactNumber || '',
          emergencyContact: formData.emergencyContact || '',
          address: formData.address || '',
          shiftHour: parseInt(formData.shiftHour) || 9,
          shiftMinute: parseInt(formData.shiftMinute) || 0,
          shiftAmPm: formData.shiftAmPm || 'AM'
        };
        
        console.log("Creating user with payload:", createPayload);
        
        const response = await axios.post(`${API_BASE}/users`, createPayload, authHeader);
        
        if (response.data) {
          setNewlyCreatedUser(response.data);
          if (response.data.githubLinked && response.data.githubUsername) {
            toast.success(`Account created! GitHub account linked: ${response.data.githubUsername}`);
          } else if (formData.role === 'Developer') {
            toast.success('Account created! You can link a GitHub account from the user list.');
          } else if (formData.role === 'Client') {
            toast.success(`POC account created successfully for ${formData.name}!`);
          } else {
            toast.success("Account created successfully!");
          }
        }
        
        closeModal();
        fetchUsers();
      }
    } catch (err) {
      console.error("Submit error:", err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Operation failed";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setIsEditing(false);
    setCurrentUserId(null);
    setShowPassword(false);
    setNewlyCreatedUser(null);
    setShowNewOrgForm(false);
    setSearchOrgTerm('');
    setEmailReadOnly(true);
    setPasswordReadOnly(true);
    setNewOrgData({
      companyName: '',
      website: '',
      address: ''
    });
    setFormData({ 
      name: '', 
      email: '', 
      password: '', 
      role: getDefaultRole(),
      organizationId: '',
      department: 'Other',
      isPrimaryPOC: false,
      employeeCode: '',
      dateOfJoining: '',
      dateOfBirth: '',
      contactNumber: '',
      emergencyContact: '',
      address: '',
      shiftHour: 9,
      shiftMinute: 0,
      shiftAmPm: 'AM'
    });
  };

  const openCreateModal = () => {
    setFormData({ 
      name: '', 
      email: '', 
      password: '', 
      role: getDefaultRole(),
      organizationId: '',
      department: 'Other',
      isPrimaryPOC: false,
      employeeCode: '',
      dateOfJoining: '',
      dateOfBirth: '',
      contactNumber: '',
      emergencyContact: '',
      address: '',
      shiftHour: 9,
      shiftMinute: 0,
      shiftAmPm: 'AM'
    });
    setEmailReadOnly(true);
    setPasswordReadOnly(true);
    setModalKey(prev => prev + 1);
    setIsEditing(false);
    setCurrentUserId(null);
    setShowNewOrgForm(false);
    setSearchOrgTerm('');
    setNewOrgData({
      companyName: '',
      website: '',
      address: ''
    });
    setNewlyCreatedUser(null);
    setShowModal(true);
  };

  const filteredOrganizations = organizations.filter(org =>
    org.companyName?.toLowerCase().includes(searchOrgTerm.toLowerCase())
  );

  const getRoleDisplayName = (role) => {
    if (role === 'Client') return 'POC';
    if (role === 'Team Lead') return 'Team Lead';
    if (role === 'HR') return 'HR';
    if (role === 'Finance') return 'Finance';
    return role;
  };

  const getRoleColor = (role) => {
    switch(role) {
      case 'Admin': return 'bg-purple-100 text-purple-700';
      case 'Developer': return 'bg-blue-100 text-blue-700';
      case 'Sales': return 'bg-emerald-100 text-emerald-700';
      case 'Sales Manager': return 'bg-orange-100 text-orange-700';
      case 'Project Manager': return 'bg-cyan-100 text-cyan-700';
      case 'Client': return 'bg-slate-100 text-slate-700';
      case 'Team Lead': return 'bg-indigo-100 text-indigo-700';
      case 'HR': return 'bg-pink-100 text-pink-700';
      case 'Finance': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getDepartmentColor = (dept) => {
    switch(dept) {
      case 'CEO': return 'bg-purple-100 text-purple-700';
      case 'CTO': return 'bg-blue-100 text-blue-700';
      case 'Sales': return 'bg-emerald-100 text-emerald-700';
      case 'Marketing': return 'bg-pink-100 text-pink-700';
      case 'Support': return 'bg-amber-100 text-amber-700';
      case 'Developer': return 'bg-blue-500 text-white';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const resetFilters = () => {
    setSelectedRole('ALL');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const getAvailableRoles = () => {
    if (userRole === 'Sales Manager') {
      return ['Sales'];
    }
    if (userRole === 'Project Manager') {
      return ['Client', 'Team Lead'];
    }
    return ['Client', 'Developer', 'Sales', 'Project Manager', 'Sales Manager', 'Team Lead', 'Admin', 'HR', 'Finance'];
  };

  const canEditEmployeeProfile = (role) => {
    return !['Super Admin', 'Admin', 'Client'].includes(role);
  };

  const getShiftDisplay = (hour, minute, ampm) => {
    if (!hour && !minute && !ampm) return null;
    const h = String(hour || 9).padStart(2, '0');
    const m = String(minute || 0).padStart(2, '0');
    return `${h}:${m} ${ampm || 'AM'}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const hasEmployeeDetails = (user) => {
    return user.dateOfJoining || user.dateOfBirth || user.contactNumber || 
           user.emergencyContact || user.address || user.shiftHour;
  };

  return (
    <div
      className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            {userRole === 'Sales Manager' ? 'Team Management' : 'User & POC Directory'}
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            {userRole === 'Sales Manager' 
              ? 'Manage your sales representatives.' 
              : userRole === 'Project Manager'
              ? 'Manage points of contact and team leads for client organizations.'
              : 'Manage system-wide access levels and points of contact.'}
          </p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
        >
          <UserPlus size={20} /> Add New {userRole === 'Sales Manager' ? 'Sales Rep' : 'User'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Total Users</p>
              <p className="text-2xl font-black text-white">{filteredUsers.length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Users size={18} className="text-white" />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">HR Team</p>
              <p className="text-2xl font-black text-white">{users.filter(u => u.role === 'HR').length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Users size={18} className="text-white" />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Finance Team</p>
              <p className="text-2xl font-black text-white">{users.filter(u => u.role === 'Finance').length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Users size={18} className="text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Team Leads</p>
              <p className="text-2xl font-black text-white">{users.filter(u => u.role === 'Team Lead').length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Users size={18} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, employee code, contact, or organization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400 transition-colors"
            />
          </div>
          
          <div className="relative min-w-[180px]">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 outline-none text-sm font-medium text-slate-700 focus:border-blue-400 transition-colors cursor-pointer appearance-none"
            >
              {roleOptions.map(role => (
                <option key={role} value={role}>
                  {role === 'ALL' ? 'All Roles' : role === 'Client' ? 'POC' : role}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          
          <div className="relative min-w-[130px]">
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-sm font-medium text-slate-700 focus:border-blue-400 transition-colors cursor-pointer"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
          
          {(selectedRole !== 'ALL' || searchTerm) && (
            <button
              onClick={resetFilters}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <X size={14} />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Table Section with Expandable Rows */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-8">
                  {/* Expand/Collapse all - optional */}
                </th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Identity</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Email</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Employee Code</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">GitHub</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Role / Organization</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentUsers.length > 0 ? currentUsers.map((user) => {
                const isPOC = user.role === 'Client';
                const isTeamLead = user.role === 'Team Lead';
                const isDeveloper = user.role === 'Developer';
                const isLinking = linkingGithub[user._id] || false;
                const canEditProfile = canEditEmployeeProfile(user.role);
                const shiftDisplay = getShiftDisplay(user.shiftHour, user.shiftMinute, user.shiftAmPm);
                const isExpanded = expandedRows[user._id] || false;
                const hasDetails = hasEmployeeDetails(user);
                const showExpandButton = canEditProfile && hasDetails;

                return (
                  <>
                    {/* Main Row */}
                    <tr key={user._id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="p-5">
                        {showExpandButton && (
                          <button
                            onClick={() => toggleExpandRow(user._id)}
                            className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-blue-600"
                          >
                            {isExpanded ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronRightIcon size={16} />
                            )}
                          </button>
                        )}
                      </td>
                      <td className="p-5">
                        <div>
                          <p className="font-bold text-slate-800">{user.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {isPOC && user.organizationId && (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                <Building2 size={8} />
                                {typeof user.organizationId === 'object' ? user.organizationId.companyName : 'Organization'}
                              </span>
                            )}
                            {user.isPrimaryPOC && isPOC && (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                <CheckCircle size={8} />
                                Primary POC
                              </span>
                            )}
                            {isTeamLead && (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                <Users size={8} />
                                Team Lead
                              </span>
                            )}
                            {canEditProfile && shiftDisplay && (
                              <span className="inline-flex items-center gap-1 text-[7px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                <ClockIcon size={8} />
                                {shiftDisplay}
                              </span>
                            )}
                          </div>
                          {canEditProfile && user.contactNumber && (
                            <p className="text-[8px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <Phone size={8} />
                              {user.contactNumber}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-5 text-slate-500 font-medium text-sm">{user.email}</td>
                      <td className="p-5">
                        {user.employeeCode ? (
                          <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-black font-mono">
                            <Hash size={12} />
                            {user.employeeCode}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Not set</span>
                        )}
                      </td>
                      <td className="p-5">
                        {isDeveloper ? (
                          <div className="flex items-center gap-1.5">
                            {user.githubLinked && user.githubUsername ? (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                <CheckCircle size={8} />
                                {user.githubUsername}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleLinkGitHub(user._id)}
                                disabled={isLinking}
                                className="inline-flex items-center gap-1 text-[8px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full hover:bg-orange-100 transition-all disabled:opacity-50"
                                title="Verify and link GitHub account"
                              >
                                {isLinking ? (
                                  <RefreshCw size={8} className="animate-spin" />
                                ) : (
                                  <GitFork size={8} />
                                )}
                                {isLinking ? 'Verifying...' : 'Verify GitHub'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[8px] text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="p-5">
                        <div>
                          <span className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${getRoleColor(user.role)}`}>
                            {getRoleDisplayName(user.role)}
                          </span>
                          {isPOC && user.organizationId && (
                            <p className="text-[9px] text-slate-900 mt-1">
                              Client : {typeof user.organizationId === 'object' ? user.organizationId.companyName : 'Organization'}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          {isDeveloper && user.githubLinked && user.githubUsername && (
                            <div className="p-2 text-green-600 rounded-lg" title={`GitHub: ${user.githubUsername}`}>
                              <CheckCircle size={16}/>
                            </div>
                          )}
                          {/* ============================================
                              LEAVE BALANCE MANAGEMENT BUTTON
                              ============================================ */}
                          {(userRole === 'Admin' || userRole === 'Super Admin' || userRole === 'HR') && (
                            <button 
                              onClick={() => openLeaveBalanceModal(user)} 
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all shadow-sm"
                              title="Manage Leave Balance"
                            >
                              <Calendar size={16} />
                            </button>
                          )}
                          <button onClick={() => handleEditClick(user)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all shadow-sm">
                            <Edit2 size={16}/>
                          </button>
                          <button onClick={() => handleDelete(user._id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all shadow-sm">
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Employee Details Row */}
                    {isExpanded && canEditProfile && hasDetails && (
                      <tr className="bg-blue-50/20">
                        <td colSpan="7" className="p-4">
                          <div className="bg-white rounded-xl border border-blue-100 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 bg-blue-100 rounded-lg">
                                <UserIcon size={14} className="text-blue-600" />
                              </div>
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Employee Profile Details</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {/* Date of Joining */}
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">
                                  <Calendar size={10} className="inline mr-1" />
                                  Date of Joining
                                </label>
                                <p className="text-sm font-bold text-slate-700">
                                  {user.dateOfJoining ? formatDate(user.dateOfJoining) : 'N/A'}
                                </p>
                              </div>
                              
                              {/* Date of Birth */}
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">
                                  <Calendar size={10} className="inline mr-1" />
                                  Date of Birth
                                </label>
                                <p className="text-sm font-bold text-slate-700">
                                  {user.dateOfBirth ? formatDate(user.dateOfBirth) : 'N/A'}
                                </p>
                              </div>
                              
                              {/* Shift Timing */}
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">
                                  <ClockIcon size={10} className="inline mr-1" />
                                  Shift Timing
                                </label>
                                <p className="text-sm font-bold text-slate-700">
                                  {shiftDisplay || 'Not set'}
                                </p>
                              </div>
                              
                              {/* Contact Number */}
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">
                                  <Phone size={10} className="inline mr-1" />
                                  Contact Number
                                </label>
                                <p className="text-sm font-bold text-slate-700">
                                  {user.contactNumber || 'N/A'}
                                </p>
                              </div>
                              
                              {/* Emergency Contact */}
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">
                                  <AlertCircle size={10} className="inline mr-1" />
                                  Emergency Contact
                                </label>
                                <p className="text-sm font-bold text-slate-700">
                                  {user.emergencyContact || 'N/A'}
                                </p>
                              </div>
                              
                              {/* Address */}
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 md:col-span-2 lg:col-span-1">
                                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">
                                  <MapPin size={10} className="inline mr-1" />
                                  Address
                                </label>
                                <p className="text-sm font-bold text-slate-700 break-words">
                                  {user.address || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              }) : (
                <tr>
                  <td colSpan="7" className="p-10 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <Users size={28} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-500">No users found</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-[10px] font-black text-slate-400">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} users
          </p>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
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
                  if (i === 0) pageNum = 1;
                  else if (i === 4) pageNum = totalPages;
                  else pageNum = currentPage - 2 + i;
                }
                
                if (pageNum === 1 && i > 0 && currentPage > 3 && totalPages > 5) {
                  return <span key="ellipsis1" className="w-6 h-6 flex items-center justify-center text-slate-400 text-xs">...</span>;
                }
                
                if (pageNum === totalPages && i < 4 && currentPage < totalPages - 2 && totalPages > 5) {
                  return <span key="ellipsis2" className="w-6 h-6 flex items-center justify-center text-slate-400 text-xs">...</span>;
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
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Modal - Add/Edit User Form */}
      {showModal && (
        <div 
          key={modalKey}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex justify-center items-center z-[100] p-4"
        >
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 relative max-h-[90vh] overflow-y-auto">
            <button onClick={closeModal} className="absolute top-6 right-6 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-xl">
                <ShieldCheck className="text-blue-600" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800">
                  {isEditing ? 'Update Profile' : 'Create New Account'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isEditing ? 'Modify user details and permissions' : 'Add a new user to the system'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name Field */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1 block mb-1">
                  {formData.role === 'Client' ? 'POC Name *' : 'Full Name *'}
                </label>
                <input 
                  type="text" 
                  required 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-bold text-slate-700 transition-all"
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder={formData.role === 'Client' ? "John Doe" : "Full Name"}
                />
              </div>
              
              {/* Email Field */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1 block mb-1">Email Address *</label>
                <input 
                  type="email" 
                  required 
                  autoComplete="off"
                  readOnly={emailReadOnly}
                  onFocus={() => setEmailReadOnly(false)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-bold text-slate-700 transition-all"
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="john.doe@example.com"
                />
              </div>
              
              {/* Employee Code Field */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1 block mb-1">
                  Employee Code {!isEditing && '(Optional - auto-generated if blank)'}
                </label>
                <div className="relative">
                  <Hash size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    autoComplete="off"
                    className="w-full p-4 pl-11 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-bold text-slate-700 transition-all font-mono"
                    value={formData.employeeCode} 
                    onChange={(e) => setFormData({...formData, employeeCode: e.target.value.toUpperCase()})}
                    placeholder={isEditing ? "e.g., EMP000001" : "Leave blank for auto-generation"}
                  />
                </div>
                {!isEditing && (
                  <p className="text-[8px] text-slate-400 mt-1">
                    If left blank, an employee code will be auto-generated (e.g., EMP000001).
                  </p>
                )}
                {isEditing && (
                  <p className="text-[8px] text-amber-500 mt-1">
                    ⚠️ Changing this code may affect attendance sync and integrations.
                  </p>
                )}
              </div>
              
              {/* Password Field */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1 block mb-1">
                  {isEditing ? 'New Password (Optional)' : 'Temporary Password *'}
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required={!isEditing}
                    autoComplete="off"
                    readOnly={passwordReadOnly}
                    onFocus={() => setPasswordReadOnly(false)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-bold text-slate-700 pr-12 transition-all"
                    value={formData.password} 
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {!isEditing && (
                  <p className="text-[8px] text-slate-400 mt-1">
                    A temporary password will be generated if left blank.
                  </p>
                )}
              </div>

              {/* Role Selection */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1 block mb-1">User Type *</label>
                <select 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 appearance-none cursor-pointer transition-all"
                  value={formData.role} 
                  disabled={userRole === 'Sales Manager'}
                  onChange={(e) => {
                    setFormData({
                      ...formData, 
                      role: e.target.value,
                      organizationId: e.target.value === 'Client' ? formData.organizationId : '',
                      department: e.target.value === 'Client' ? formData.department : 'Other',
                      isPrimaryPOC: e.target.value === 'Client' ? formData.isPrimaryPOC : false
                    });
                    setShowNewOrgForm(false);
                    setSearchOrgTerm('');
                  }}
                >
                  {getAvailableRoles().map(role => (
                    <option key={role} value={role}>
                      {role === 'Client' ? 'Point of Contact (POC)' : role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Organization Selection for POC Role */}
              {formData.role === 'Client' && !isEditing && (
                <div className="space-y-3">
                  {!showNewOrgForm ? (
                    <>
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-1 flex items-center gap-2">
                        <Building2 size={12} />
                        Select Organization *
                      </label>
                      
                      <div className="relative">
                        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search or select organization..."
                          value={searchOrgTerm}
                          onChange={(e) => {
                            setSearchOrgTerm(e.target.value);
                            setIsOrgDropdownOpen(true);
                          }}
                          onFocus={() => setIsOrgDropdownOpen(true)}
                          className="w-full h-12 rounded-xl border border-slate-200 pl-9 pr-8 font-medium text-sm outline-none focus:border-blue-500 bg-slate-50"
                        />
                        <button
                          type="button"
                          onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        >
                          {isOrgDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>

                      {isOrgDropdownOpen && (
                        <div className="border border-slate-200 rounded-xl bg-white shadow-lg max-h-48 overflow-y-auto z-50">
                          {filteredOrganizations.length === 0 ? (
                            <div className="p-4 text-center text-slate-400 text-xs">No organizations found</div>
                          ) : (
                            filteredOrganizations.map(org => (
                              <div
                                key={org._id}
                                onClick={() => {
                                  setFormData({...formData, organizationId: org._id});
                                  setSearchOrgTerm(org.companyName);
                                  setIsOrgDropdownOpen(false);
                                }}
                                className="flex items-center justify-between p-3 cursor-pointer transition-all hover:bg-slate-50"
                              >
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{org.companyName}</p>
                                  <p className="text-[9px] text-slate-400">{org.website || 'No website'}</p>
                                </div>
                                {formData.organizationId === org._id && (
                                  <CheckCircle size={14} className="text-blue-600" />
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setShowNewOrgForm(true);
                          setIsOrgDropdownOpen(false);
                        }}
                        className="w-full mt-2 py-2.5 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 text-[10px] font-black uppercase tracking-wider hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus size={14} />
                        Create New Organization
                      </button>
                    </>
                  ) : (
                    <div className="space-y-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase text-blue-600 ml-1">New Organization Details</label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewOrgForm(false);
                            setNewOrgData({ companyName: '', website: '', address: '' });
                          }}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Organization Name *"
                        required
                        className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none font-bold text-sm"
                        value={newOrgData.companyName}
                        onChange={(e) => setNewOrgData({...newOrgData, companyName: e.target.value})}
                      />
                      <input
                        type="text"
                        placeholder="Website (optional)"
                        className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none text-sm"
                        value={newOrgData.website}
                        onChange={(e) => setNewOrgData({...newOrgData, website: e.target.value})}
                      />
                      <input
                        type="text"
                        placeholder="Address (optional)"
                        className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none text-sm"
                        value={newOrgData.address}
                        onChange={(e) => setNewOrgData({...newOrgData, address: e.target.value})}
                      />
                    </div>
                  )}

                  {/* Department Selection */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1 block mb-1">Department</label>
                    <select
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 cursor-pointer"
                      value={formData.department}
                      onChange={(e) => setFormData({...formData, department: e.target.value})}
                    >
                      <option value="CEO">CEO</option>
                      <option value="CTO">CTO</option>
                      <option value="Sales">Sales</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Support">Support</option>
                      <option value="Developer">Developer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Primary POC Checkbox */}
                  <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer border border-slate-200">
                    <input
                      type="checkbox"
                      checked={formData.isPrimaryPOC}
                      onChange={(e) => setFormData({...formData, isPrimaryPOC: e.target.checked})}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[10px] font-black uppercase text-slate-600">Mark as Primary Point of Contact</span>
                  </label>
                </div>
              )}

              {/* Show selected organization when editing POC */}
              {isEditing && formData.role === 'Client' && formData.organizationId && (
                <div className="bg-slate-100 rounded-xl p-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-1 block mb-2">Organization</label>
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-purple-600" />
                    <span className="text-sm font-bold text-slate-700">
                      {typeof formData.organizationId === 'object' 
                        ? formData.organizationId.companyName 
                        : organizations.find(o => o._id === formData.organizationId)?.companyName || 'Organization'}
                    </span>
                  </div>
                  {formData.department && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-full ${getDepartmentColor(formData.department)}`}>
                        {formData.department}
                      </span>
                      {formData.isPrimaryPOC && (
                        <span className="inline-flex items-center gap-1 text-[8px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          <CheckCircle size={8} />
                          Primary POC
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Employee Profile Fields */}
              {formData.role !== 'Client' && formData.role !== 'Admin' && formData.role !== 'Super Admin' && (
                <div className="border-t border-slate-200 pt-4 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                      <UserIcon size={14} className="text-blue-600" />
                    </div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Employee Profile Details</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Date of Joining */}
                    <div>
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-1 block mb-1">
                        <Calendar size={10} className="inline mr-1" />
                        Date of Joining
                      </label>
                      <input 
                        type="date" 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-bold text-slate-700 transition-all text-sm"
                        value={formData.dateOfJoining} 
                        onChange={(e) => setFormData({...formData, dateOfJoining: e.target.value})}
                      />
                    </div>
                    
                    {/* Date of Birth */}
                    <div>
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-1 block mb-1">
                        <Calendar size={10} className="inline mr-1" />
                        Date of Birth
                      </label>
                      <input 
                        type="date" 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-bold text-slate-700 transition-all text-sm"
                        value={formData.dateOfBirth} 
                        onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                      />
                    </div>
                    
                    {/* Shift Timing */}
                    <div className="md:col-span-2">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-1 block mb-1">
                        <ClockIcon size={10} className="inline mr-1" />
                        Shift Timing
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <select
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 transition-all text-sm cursor-pointer"
                            value={formData.shiftHour}
                            onChange={(e) => setFormData({...formData, shiftHour: parseInt(e.target.value)})}
                          >
                            {[...Array(12)].map((_, i) => (
                              <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>
                            ))}
                          </select>
                          <p className="text-[6px] text-slate-400 text-center mt-0.5">Hour</p>
                        </div>

                        <div className="flex-1">
                          <select
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 transition-all text-sm cursor-pointer"
                            value={formData.shiftMinute}
                            onChange={(e) => setFormData({...formData, shiftMinute: parseInt(e.target.value)})}
                          >
                            {[...Array(60)].map((_, i) => (
                              <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                            ))}
                          </select>
                          <p className="text-[6px] text-slate-400 text-center mt-0.5">Minute</p>
                        </div>

                        <div className="flex-1">
                          <select
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 transition-all text-sm cursor-pointer"
                            value={formData.shiftAmPm}
                            onChange={(e) => setFormData({...formData, shiftAmPm: e.target.value})}
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                          <p className="text-[6px] text-slate-400 text-center mt-0.5">AM/PM</p>
                        </div>
                      </div>
                      <p className="text-[7px] text-slate-400 mt-1">Select the start time of your shift</p>
                    </div>
                  </div>
                  
                  {/* Contact Number */}
                  <div className="mt-3">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-1 block mb-1">
                      <Phone size={10} className="inline mr-1" />
                      Contact Number
                    </label>
                    <input 
                      type="tel" 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-bold text-slate-700 transition-all text-sm"
                      placeholder="e.g., +91 98765 43210"
                      value={formData.contactNumber} 
                      onChange={(e) => setFormData({...formData, contactNumber: e.target.value})}
                    />
                  </div>
                  
                  {/* Emergency Contact */}
                  <div className="mt-3">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-1 block mb-1">
                      <AlertCircle size={10} className="inline mr-1" />
                      Emergency Contact
                    </label>
                    <input 
                      type="tel" 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-bold text-slate-700 transition-all text-sm"
                      placeholder="e.g., +91 98765 43210 (Name)"
                      value={formData.emergencyContact} 
                      onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
                    />
                    <p className="text-[7px] text-slate-400 mt-1">Name and contact number of emergency contact person</p>
                  </div>
                  
                  {/* Address */}
                  <div className="mt-3">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-1 block mb-1">
                      <MapPin size={10} className="inline mr-1" />
                      Address
                    </label>
                    <textarea 
                      rows={2}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-medium text-slate-700 transition-all text-sm resize-none"
                      placeholder="Enter full address..."
                      value={formData.address} 
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {/* GitHub Info for Developer Role */}
              {!isEditing && formData.role === 'Developer' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <GitFork size={14} className="text-blue-600" />
                    <p className="text-[9px] font-black text-blue-700 uppercase tracking-wider">GitHub Auto-Linking</p>
                  </div>
                  <p className="text-[8px] text-blue-600">
                    We'll automatically search for a GitHub account with the email <strong>{formData.email || '[your email]'}</strong> and link it if found.
                  </p>
                </div>
              )}

              {/* Info for Team Lead Role */}
              {!isEditing && formData.role === 'Team Lead' && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={14} className="text-indigo-600" />
                    <p className="text-[9px] font-black text-indigo-700 uppercase tracking-wider">Team Lead Account</p>
                  </div>
                  <p className="text-[8px] text-indigo-600">
                    Team Leads can manage projects, assign developers to feeds, and view project tickets.
                  </p>
                </div>
              )}

              {/* Info for POC */}
              {!isEditing && formData.role === 'Client' && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 size={14} className="text-purple-600" />
                    <p className="text-[9px] font-black text-purple-700 uppercase tracking-wider">Point of Contact Account</p>
                  </div>
                  <p className="text-[8px] text-purple-600">
                    This POC will be associated with the selected organization. 
                    Multiple POCs can be added to the same organization.
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={submitting}
                className={`w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl transition-all font-black uppercase text-xs tracking-[0.2em] shadow-lg shadow-blue-200 mt-4 ${
                  submitting ? 'opacity-50 cursor-not-allowed' : 'hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl active:scale-98'
                }`}
              >
                {submitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </div>
                ) : (
                  isEditing ? 'Save Changes' : 'Create Account'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================
          LEAVE BALANCE MANAGEMENT MODAL
          ============================================ */}
      {showLeaveModal && selectedUserForLeave && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex justify-center items-center z-[200] p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Calendar size={20} className="text-blue-600" />
                  Manage Leave Balance
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedUserForLeave.name} • {selectedUserForLeave.email}
                </p>
              </div>
              <button 
                onClick={closeLeaveModal} 
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Current Balances */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <Clock size={14} />
                Current Balances
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(leaveBalances).map(([type, balance]) => (
                  <div key={type} className="bg-white rounded-lg p-2 text-center border border-slate-100">
                    <p className="text-[7px] font-black text-slate-400 uppercase">{type}</p>
                    <p className="text-lg font-black text-slate-800">{balance}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Update Form */}
            <form onSubmit={handleLeaveBalanceUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Leave Type */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                    Leave Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={leaveBalanceData.leaveType}
                    onChange={(e) => setLeaveBalanceData({ ...leaveBalanceData, leaveType: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-200 outline-none font-semibold text-sm text-slate-700 focus:border-blue-400 transition-colors"
                  >
                    {Object.keys(leaveBalances).map(type => (
                      <option key={type} value={type}>
                        {type} ({leaveBalances[type] || 0} days)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                    Action <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={leaveBalanceData.action}
                    onChange={(e) => setLeaveBalanceData({ ...leaveBalanceData, action: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-200 outline-none font-semibold text-sm text-slate-700 focus:border-blue-400 transition-colors"
                  >
                    <option value="add">➕ Add</option>
                    <option value="deduct">➖ Deduct</option>
                    <option value="set">📌 Set</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Amount */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                    Amount (days) <span className="text-red-500">*</span>
                    <span className="font-normal text-slate-400 ml-1">(0.5 increments)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      required
                      value={leaveBalanceData.amount}
                      onChange={(e) => setLeaveBalanceData({ ...leaveBalanceData, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-200 outline-none font-bold text-sm text-slate-700 focus:border-blue-400 transition-colors"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setLeaveBalanceData({ ...leaveBalanceData, amount: Math.max(0, (leaveBalanceData.amount || 0) - 0.5) })}
                        className="p-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaveBalanceData({ ...leaveBalanceData, amount: (leaveBalanceData.amount || 0) + 0.5 })}
                        className="p-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[7px] text-slate-400 mt-1">Half-day leave = 0.5 days</p>
                </div>

                {/* Reason */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Half-day leave adjustment"
                    value={leaveBalanceData.reason}
                    onChange={(e) => setLeaveBalanceData({ ...leaveBalanceData, reason: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-200 outline-none font-medium text-sm text-slate-700 focus:border-blue-400 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingLeave}
                className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  submittingLeave
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200'
                }`}
              >
                {submittingLeave ? (
                  <><Loader2 size={16} className="animate-spin" /> Processing...</>
                ) : (
                  <><CheckCircle size={16} /> Update Leave Balance</>
                )}
              </button>
            </form>

            {/* Leave History */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Clock size={14} />
                  Recent History
                </h3>
                <span className="text-[8px] text-slate-400">{leaveHistory.length} entries</span>
              </div>
              
              {loadingLeaveHistory ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={20} className="text-blue-500 animate-spin" />
                </div>
              ) : leaveHistory.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No leave balance history</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {leaveHistory.slice(0, 10).map((entry, idx) => {
                    const isDeduct = entry.type === 'deducted' || (typeof entry.amount === 'number' && entry.amount < 0);
                    const amountDisplay = typeof entry.amount === 'number' 
                      ? (entry.amount > 0 ? `+${entry.amount}` : entry.amount) 
                      : `${entry.type === 'deducted' ? '-' : '+'}${entry.amount || 0}`;
                    
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isDeduct ? 'bg-red-500' : 'bg-green-500'}`} />
                          <span className="font-bold text-slate-700 min-w-[80px]">{entry.leaveType}</span>
                          <span className={`font-black ${isDeduct ? 'text-red-600' : 'text-green-600'}`}>
                            {amountDisplay}
                          </span>
                          <span className="text-slate-500 truncate max-w-[120px]">{entry.reason || '—'}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 flex-shrink-0 ml-2">
                          {entry.date ? new Date(entry.date).toLocaleDateString() : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={closeLeaveModal}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  fetchUsers();
                  toast.success('Leave balances refreshed');
                }}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={14} />
                Refresh Balances
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;