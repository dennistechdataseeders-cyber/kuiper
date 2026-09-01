// frontend/src/components/UpdateProfileModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  X,
  User,
  Camera,
  Phone,
  MapPin,
  Calendar as CalendarIcon,
  CheckCircle,
  Loader2,
  AlertCircle,
  Pencil
} from 'lucide-react';
import API_BASE_URL from '../config';

const UpdateProfileModal = ({ isOpen, onClose, userId, onProfileUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    phoneNumber: '',
    dateOfJoining: '',
    dateOfBirth: '',
    contactNumber: '',
    emergencyContact: '',
    address: '',
    profileImage: null,
    profileImagePreview: null
  });

  const fileInputRef = useRef(null);

  // Fetch profile data when modal opens
  useEffect(() => {
    if (isOpen && userId) {
      fetchProfileData();
    }
  }, [isOpen, userId]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Fetch user details
      const userRes = await axios.get(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const user = userRes.data.find(u => u._id === userId);
      
      // Fetch employee profile
      const profileRes = await axios.get(`${API_BASE_URL}/api/employee/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const profile = profileRes.data.data || {};
      
      setProfileData({
        name: profile.name || user?.name || '',
        phoneNumber: profile.phoneNumber || '',
        dateOfJoining: profile.dateOfJoining ? new Date(profile.dateOfJoining).toISOString().split('T')[0] : '',
        dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().split('T')[0] : '',
        contactNumber: profile.contactNumber || '',
        emergencyContact: profile.emergencyContact || '',
        address: profile.address || '',
        profileImage: user?.profileImage || null,
        profileImagePreview: user?.profileImage || null
      });
    } catch (error) {
      console.error('Error fetching profile data:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, GIF, WEBP)');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setProfileData(prev => ({
        ...prev,
        profileImage: file,
        profileImagePreview: e.target.result
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeProfileImage = async () => {
    if (!profileData.profileImagePreview) return;
    if (!window.confirm('Are you sure you want to remove your profile picture?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.delete(`${API_BASE_URL}/api/admin/remove-profile-image`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success) {
        setProfileData(prev => ({
          ...prev,
          profileImage: null,
          profileImagePreview: null
        }));
        toast.success('Profile image removed');
      }
    } catch (error) {
      console.error('Remove error:', error);
      toast.error(error.response?.data?.error || 'Failed to remove profile image');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // 1. Upload profile image if changed
      let uploadedImageUrl = null;
      if (profileData.profileImage && typeof profileData.profileImage !== 'string') {
        const formData = new FormData();
        formData.append('profileImage', profileData.profileImage);
        
        const uploadRes = await axios.post(`${API_BASE_URL}/api/admin/upload-profile-image`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        
        if (uploadRes.data.success) {
          uploadedImageUrl = uploadRes.data.profileImage;
        }
      }
      
      // 2. Update profile fields
      const payload = {
        name: profileData.name,
        phoneNumber: profileData.phoneNumber,
        dateOfJoining: profileData.dateOfJoining || null,
        dateOfBirth: profileData.dateOfBirth || null,
        contactNumber: profileData.contactNumber,
        emergencyContact: profileData.emergencyContact,
        address: profileData.address
      };
      
      await axios.put(`${API_BASE_URL}/api/employee/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Profile updated successfully!');
      
      if (onProfileUpdated) {
        onProfileUpdated();
      }
      
      onClose();
      setTimeout(() => window.location.reload(), 500);
      
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <User size={20} className="text-blue-400" />
              Update Profile
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">Edit your personal information</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="text-blue-500 animate-spin" />
            <span className="ml-3 text-slate-400">Loading profile...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Profile Picture */}
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-blue-500/30 bg-slate-800">
                  {profileData.profileImagePreview ? (
                    <img
                      src={profileData.profileImagePreview}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                      {profileData.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-1.5 bg-blue-600 rounded-full hover:bg-blue-700 transition-all shadow-lg"
                  title="Change profile picture"
                >
                  <Camera size={14} className="text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              {profileData.profileImagePreview && (
                <button
                  onClick={removeProfileImage}
                  className="mt-2 text-xs text-red-400 hover:text-red-300 transition-all"
                >
                  Remove photo
                </button>
              )}
              <p className="text-[10px] text-slate-500 mt-1">Click the camera icon to change</p>
            </div>

            {/* Profile Fields - Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-sm text-white focus:border-blue-500 transition-all"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  <Phone size={12} className="inline mr-1" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={profileData.phoneNumber}
                  onChange={(e) => setProfileData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-sm text-white focus:border-blue-500 transition-all"
                  placeholder="e.g., +91 98765 43210"
                />
              </div>

              {/* Date of Joining */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  <CalendarIcon size={12} className="inline mr-1" />
                  Date of Joining
                </label>
                <input
                  type="date"
                  value={profileData.dateOfJoining}
                  onChange={(e) => setProfileData(prev => ({ ...prev, dateOfJoining: e.target.value }))}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-sm text-white focus:border-blue-500 transition-all"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  <CalendarIcon size={12} className="inline mr-1" />
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={profileData.dateOfBirth}
                  onChange={(e) => setProfileData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-sm text-white focus:border-blue-500 transition-all"
                />
              </div>

              {/* Contact Number */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  <Phone size={12} className="inline mr-1" />
                  Contact Number
                </label>
                <input
                  type="tel"
                  value={profileData.contactNumber}
                  onChange={(e) => setProfileData(prev => ({ ...prev, contactNumber: e.target.value }))}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-sm text-white focus:border-blue-500 transition-all"
                  placeholder="Personal contact number"
                />
                <p className="text-[7px] text-slate-500 mt-0.5">Personal contact number</p>
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  <AlertCircle size={12} className="inline mr-1" />
                  Emergency Contact
                </label>
                <input
                  type="tel"
                  value={profileData.emergencyContact}
                  onChange={(e) => setProfileData(prev => ({ ...prev, emergencyContact: e.target.value }))}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-sm text-white focus:border-blue-500 transition-all"
                  placeholder="e.g., +91 98765 43210 (Name)"
                />
                <p className="text-[7px] text-slate-500 mt-0.5">Name and contact number of emergency contact person</p>
              </div>

              {/* Address - Full width */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  <MapPin size={12} className="inline mr-1" />
                  Address
                </label>
                <textarea
                  rows={2}
                  value={profileData.address}
                  onChange={(e) => setProfileData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-sm text-white focus:border-blue-500 transition-all resize-none"
                  placeholder="Enter your full address"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><Loader2 size={16} className="animate-spin" /> Saving...</>
                ) : (
                  <><CheckCircle size={16} /> Save Changes</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdateProfileModal;