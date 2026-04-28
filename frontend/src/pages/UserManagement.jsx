import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Edit2, Trash2, ShieldCheck, X } from 'lucide-react';
import API_BASE_URL from '../config';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  
  const userRole = localStorage.getItem('role');
  const token = localStorage.getItem('token');
  const storedId = localStorage.getItem('userId');

  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: userRole === 'Sales Manager' ? 'Sales' : 'Client' 
  });

  const API_BASE = `${API_BASE_URL}/api/admin`;
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // --- FILTER LOGIC ---
  // Admin: Sees everyone
  // Project Manager: Sees Clients
  // Sales Manager: Sees Sales Reps
  const filteredUsers = users.filter(user => {
    if (userRole === 'Sales Manager') return user.role === 'Sales';
    if (userRole === 'Project Manager') return user.role === 'Client';
    return true; 
  });

  useEffect(() => {
    if (!storedId) {
      console.warn("ADMIN ID MISSING: Activity logging will fail. Please re-login.");
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/users`, authHeader);
      setUsers(res.data);
    } catch (err) {
      console.error("Error fetching users:", err);
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
        fetchUsers();
      } catch (err) {
        alert("Delete failed");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_BASE}/users/${currentUserId}`, formData, authHeader);
      } else {
        const payload = {
          ...formData,
          password: String(formData.password || "123456"),
          adminId: storedId,       
          performerId: storedId    
        };
        await axios.post(`${API_BASE}/users`, payload, authHeader);
      }
      
      closeModal();
      fetchUsers();
    } catch (err) {
      console.error("Submission Error Details:", err.response?.data);
      alert("Error: " + (err.response?.data?.error || "Check backend console"));
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setIsEditing(false);
    setCurrentUserId(null);
    setFormData({ 
        name: '', 
        email: '', 
        password: '', 
        role: userRole === 'Sales Manager' ? 'Sales' : 'Client' 
    });
  };

  return (
    <div className="ml-20 lg:ml-64 p-4 lg:p-8 bg-blue-100 min-h-screen transition-all">
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
                    <p className="font-bold text-slate-700">{user.name}</p>
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
                    <div className="flex justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
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
                  <td colSpan="4" className="p-10 text-center text-slate-400 font-medium">No users found in this category.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 relative">
            <button onClick={closeModal} className="absolute top-6 right-6 p-2 text-slate-400 hover:bg-slate-100 rounded-full">
              <X size={20} />
            </button>
            
            <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
              <ShieldCheck className="text-blue-600" /> {isEditing ? 'Update Profile' : 'New Account'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Full Name</label>
                <input 
                  type="text" required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                  value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Email Address</label>
                <input 
                  type="email" required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                  value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              
              {!isEditing && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Temporary Password</label>
                  <input 
                    type="password" required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                    value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">System Role</label>
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
                      <option value="Client">Client</option>
                      <option value="Developer">Developer</option>
                      <option value="Sales">Sales</option>
                      <option value="Project Manager">Project Manager</option>
                      <option value="Sales Manager">Sales Manager</option>
                      <option value="Admin">Admin</option>
                    </>
                  )}
                </select>
              </div>

              <button 
                type="submit" 
                className="w-full py-5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-100 mt-4"
              >
                {isEditing ? 'Save Changes' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;