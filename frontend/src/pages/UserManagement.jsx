import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Edit2, Trash2, ShieldCheck, X, Eye, EyeOff, CheckCircle, AlertCircle, GitFork } from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import toast from 'react-hot-toast';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [linkingGithub, setLinkingGithub] = useState(false);
  const userRole = localStorage.getItem('role');
  const token = localStorage.getItem('token');
  const storedId = localStorage.getItem('userId');
  const { isCollapsed } = useSidebar();
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: userRole === 'Sales Manager' ? 'Sales' : 'Client' 
  });
  const [newlyCreatedUser, setNewlyCreatedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const API_BASE = `${API_BASE_URL}/api/admin`;
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const filteredUsers = users.filter(user => {
    if (userRole === 'Sales Manager') return user.role === 'Sales';
    if (userRole === 'Project Manager') return user.role === 'Client';
    return true; 
  });

  useEffect(() => {
    fetchUsers();
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

  const handleEditClick = (user) => {
    setIsEditing(true);
    setCurrentUserId(user._id);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role
    });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setNewlyCreatedUser(null);
    
    try {
      if (isEditing) {
        // For editing, only send fields that should be updated
        const updatePayload = {
          name: formData.name,
          email: formData.email,
          role: formData.role
        };
        
        // Only include password if it was provided
        if (formData.password && formData.password.trim()) {
          updatePayload.password = formData.password;
        }
        
        await axios.put(`${API_BASE}/users/${currentUserId}`, updatePayload, authHeader);
        toast.success("User updated successfully");
        closeModal();
        fetchUsers();
      } else {
        // For creating new user
        if (!formData.name || !formData.email || !formData.role) {
          toast.error("Please fill in all required fields");
          setSubmitting(false);
          return;
        }
        
        // Generate a default password if not provided
        const defaultPassword = formData.password || Math.random().toString(36).slice(-8);
        
        const createPayload = {
          name: formData.name,
          email: formData.email,
          password: defaultPassword,
          role: formData.role
        };
        
        const response = await axios.post(`${API_BASE}/users`, createPayload, authHeader);
        
        if (response.data) {
          setNewlyCreatedUser(response.data);
          if (response.data.githubLinked && response.data.githubUsername) {
            toast.success(`Account created! GitHub account linked: ${response.data.githubUsername}`);
          } else if (formData.role === 'Developer') {
            toast.success('Account created! You can link a GitHub account from the user list.');
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
    setFormData({ 
      name: '', 
      email: '', 
      password: '', 
      role: userRole === 'Sales Manager' ? 'Sales' : 'Client' 
    });
  };

  return (
    <div
      className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}
    >
      {/* Header and Add Button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            {userRole === 'Sales Manager' ? 'Team Management' : 'User Directory'}
          </h1>
          <p className="text-slate-500 font-medium">
            {userRole === 'Sales Manager' ? 'Manage your sales representatives.' : 'Manage system-wide access levels.'}
          </p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
        >
          <UserPlus size={20} /> Add New {userRole === 'Sales Manager' ? 'Sales Rep' : 'User'}
        </button>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Identity</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Email</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Role</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                <tr key={user._id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="p-5">
                    <div>
                      <p className="font-bold text-slate-700">{user.name}</p>
                      {user.role === 'Developer' && (
                        <div className="flex items-center gap-2 mt-1">
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
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-5 text-slate-500 font-medium">{user.email}</td>
                  <td className="p-5">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${
                      user.role === 'Admin' ? 'bg-purple-100 text-purple-600' : 
                      user.role === 'Developer' ? 'bg-blue-100 text-blue-600' : 
                      user.role === 'Sales' ? 'bg-emerald-100 text-emerald-600' : 
                      user.role === 'Sales Manager' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {user.role}
                    </span>
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
              )) : (
                <tr>
                  <td colSpan="4" className="p-10 text-center text-slate-400 font-medium">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex justify-center items-center z-70 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 relative max-h-[90vh] overflow-y-auto">
            <button onClick={closeModal} className="absolute top-6 right-6 p-2 text-slate-400 hover:bg-slate-100 rounded-full">
              <X size={20} />
            </button>
            
            <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
              <ShieldCheck className="text-blue-600" /> {isEditing ? 'Update Profile' : 'New Account'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Full Name *</label>
                <input 
                  type="text" 
                  required 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Email Address *</label>
                <input 
                  type="email" 
                  required 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              
              {/* Password Field */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  {isEditing ? 'New Password (Optional - leave blank to keep current)' : 'Temporary Password *'}
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required={!isEditing}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 pr-12"
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

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">System Role *</label>
                <select 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 appearance-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                  value={formData.role} 
                  disabled={userRole === 'Sales Manager'}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                >
                  {userRole === 'Sales Manager' ? (
                    <option value="Sales">Sales</option>
                  ) : (
                    <>
                      <option value="Client">POC</option>
                      <option value="Developer">Developer</option>
                      <option value="Sales">Sales</option>
                      <option value="Project Manager">Project Manager</option>
                      <option value="Sales Manager">Sales Manager</option>
                      <option value="Admin">Admin</option>
                    </>
                  )}
                </select>
              </div>

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

              <button 
                type="submit" 
                disabled={submitting}
                className={`w-full py-5 bg-blue-600 text-white rounded-2xl transition-all font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-100 mt-4 ${submitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
              >
                {submitting ? 'Processing...' : isEditing ? 'Save Changes' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;