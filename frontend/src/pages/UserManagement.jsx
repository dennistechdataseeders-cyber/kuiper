import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { UserPlus, Edit2, Trash2, ShieldCheck, X, Eye, EyeOff, CheckCircle, AlertCircle, GitFork, Building2, User as UserIcon, Search as SearchIcon, Plus, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Filter, Users } from 'lucide-react';
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
  const [linkingGithub, setLinkingGithub] = useState(false);
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
    isPrimaryPOC: false
  });
  
  const [newlyCreatedUser, setNewlyCreatedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const API_BASE = `${API_BASE_URL}/api/admin`;
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // Available roles for filter - ADD Team Lead
  const roleOptions = useMemo(() => {
    const roles = [...new Set(users.map(user => user.role))];
    return ['ALL', ...roles];
  }, [users]);

  // Filter users based on role and search
  const filteredUsers = useMemo(() => {
    let result = [...users];
    
    // Filter by selected role
    if (selectedRole !== 'ALL') {
      result = result.filter(user => user.role === selectedRole);
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(user =>
        user.name?.toLowerCase().includes(search) ||
        user.email?.toLowerCase().includes(search) ||
        (user.role === 'Client' && user.organizationId?.companyName?.toLowerCase().includes(search))
      );
    }
    
    // Additional role-based filtering
    if (userRole === 'Sales Manager') {
      result = result.filter(user => user.role === 'Sales');
    }
    if (userRole === 'Project Manager') {
      // PM can see Clients and Team Leads
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

  const handleEditClick = (user) => {
    setIsEditing(true);
    setCurrentUserId(user._id);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '', // Always empty for edit
      role: user.role || 'Client',
      organizationId: user.organizationId?._id || user.organizationId || '',
      department: user.department || 'Other',
      isPrimaryPOC: user.isPrimaryPOC || false
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

  // Link GitHub account for existing user
  const handleLinkGitHub = async (user) => {
    setLinkingGithub(true);
    try {
      const res = await axios.post(
        `${API_BASE}/users/${user._id}/link-github`, 
        {},
        authHeader
      );
      
      if (res.data.success) {
        toast.success(`GitHub account ${res.data.githubUsername} linked successfully!`);
        fetchUsers();
      } else {
        toast.error(res.data.error || 'Failed to link GitHub account');
      }
    } catch (err) {
      console.error('GitHub linking error:', err);
      toast.error(err.response?.data?.error || 'Failed to link GitHub account');
    } finally {
      setLinkingGithub(false);
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
      
      // If creating new organization
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
          isPrimaryPOC: formData.isPrimaryPOC
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
          isPrimaryPOC: formData.isPrimaryPOC
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
    // Reset form data to default values
    setFormData({ 
      name: '', 
      email: '', 
      password: '', 
      role: getDefaultRole(),
      organizationId: '',
      department: 'Other',
      isPrimaryPOC: false
    });
  };

  // Reset form for new user creation
  const openCreateModal = () => {
    setFormData({ 
      name: '', 
      email: '', 
      password: '', 
      role: getDefaultRole(),
      organizationId: '',
      department: 'Other',
      isPrimaryPOC: false
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

  // Filter organizations based on search term
  const filteredOrganizations = organizations.filter(org =>
    org.companyName?.toLowerCase().includes(searchOrgTerm.toLowerCase())
  );

  // Helper to get role display name
  const getRoleDisplayName = (role) => {
    if (role === 'Client') return 'POC';
    if (role === 'Team Lead') return 'Team Lead';
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

  // Available roles for creation dropdown - ADD Team Lead
  const getAvailableRoles = () => {
    if (userRole === 'Sales Manager') {
      return ['Sales'];
    }
    if (userRole === 'Project Manager') {
      return ['Client', 'Team Lead']; // PM can create Client and Team Lead
    }
    // Admin can create all roles
    return ['Client', 'Developer', 'Sales', 'Project Manager', 'Sales Manager', 'Team Lead', 'Admin'];
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

      {/* Stats Cards - ADD Team Lead count */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
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
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Total POCs</p>
              <p className="text-2xl font-black text-white">{users.filter(u => u.role === 'Client').length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Building2 size={18} className="text-white" />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Developers</p>
              <p className="text-2xl font-black text-white">{users.filter(u => u.role === 'Developer').length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <GitFork size={18} className="text-white" />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-white/70 uppercase tracking-wider">Sales Team</p>
              <p className="text-2xl font-black text-white">{users.filter(u => u.role === 'Sales' || u.role === 'Sales Manager').length}</p>
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
          {/* Search Input */}
          <div className="relative flex-1">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or organization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 outline-none text-sm focus:border-blue-400 transition-colors"
            />
          </div>
          
          {/* Role Filter Dropdown */}
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
          
          {/* Items Per Page */}
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
          
          {/* Reset Filters Button */}
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

      {/* Table Section */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Identity</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Email</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Role / Organization</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentUsers.length > 0 ? currentUsers.map((user) => {
                const isPOC = user.role === 'Client';
                const isTeamLead = user.role === 'Team Lead';
                return (
                  <tr key={user._id} className="hover:bg-blue-50/30 transition-colors group">
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
                          {user.role === 'Developer' && (
                            <>
                              {user.githubLinked && user.githubUsername ? (
                                <span className="text-[8px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <CheckCircle size={8} />
                                  GitHub: {user.githubUsername}
                                </span>
                              ) : (
                                <span className="text-[8px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <AlertCircle size={8} />
                                  GitHub: Not Linked
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-5 text-slate-500 font-medium text-sm">{user.email}</td>
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
                        {user.role === 'Developer' && !user.githubLinked && (
                          <button 
                            onClick={() => handleLinkGitHub(user)} 
                            disabled={linkingGithub}
                            className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all shadow-sm disabled:opacity-50"
                            title="Link GitHub Account"
                          >
                            <GitFork size={16}/>
                          </button>
                        )}
                        {user.role === 'Developer' && user.githubLinked && user.githubUsername && (
                          <div className="p-2 text-green-600 rounded-lg" title={`GitHub: ${user.githubUsername}`}>
                            <CheckCircle size={16}/>
                          </div>
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
                );
              }) : (
                <tr>
                  <td colSpan="4" className="p-10 text-center">
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

              {/* Role Selection - UPDATED with Team Lead */}
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

              {/* Success message for newly created developer */}
              {!isEditing && newlyCreatedUser && newlyCreatedUser.role === 'Developer' && (
                <div className={`rounded-xl p-3 ${newlyCreatedUser.githubLinked ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <div className="flex items-center gap-2">
                    {newlyCreatedUser.githubLinked ? (
                      <>
                        <CheckCircle size={14} className="text-green-600" />
                        <p className="text-[9px] font-black text-green-700">
                          ✅ GitHub account linked: {newlyCreatedUser.githubUsername}
                        </p>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={14} className="text-yellow-600" />
                        <p className="text-[9px] font-black text-yellow-700">
                          ⚠️ No GitHub account found. You can link it manually from the user list.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Success message for newly created POC */}
              {!isEditing && newlyCreatedUser && newlyCreatedUser.role === 'Client' && (
                <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-600" />
                    <p className="text-[9px] font-black text-emerald-700">
                      ✅ POC account created successfully for {newlyCreatedUser.name}!
                    </p>
                  </div>
                  {newlyCreatedUser.organizationId && (
                    <p className="text-[8px] text-emerald-600 mt-1">
                      Associated with: {typeof newlyCreatedUser.organizationId === 'object' 
                        ? newlyCreatedUser.organizationId.companyName 
                        : 'Organization'}
                    </p>
                  )}
                </div>
              )}

              {/* Success message for newly created Team Lead */}
              {!isEditing && newlyCreatedUser && newlyCreatedUser.role === 'Team Lead' && (
                <div className="rounded-xl p-3 bg-indigo-50 border border-indigo-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-indigo-600" />
                    <p className="text-[9px] font-black text-indigo-700">
                      ✅ Team Lead account created successfully for {newlyCreatedUser.name}!
                    </p>
                  </div>
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
    </div>
  );
};

export default UserManagement;