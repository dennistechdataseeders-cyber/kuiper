import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Megaphone,
  MessageSquare,
  Send,
  X,
  User,
  Clock,
  Trash2,
  Loader2,
  Plus,
  Calendar,
  Award,
  Camera,
  ThumbsUp,
  ThumbsUp as ThumbsUpFilled,
  Users,
  Shield,
  Expand,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const Announcements = () => {
  const { isCollapsed } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Infinite scroll state
  const PAGE_LIMIT = 10;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submittingComment, setSubmittingComment] = useState({});
  const [deleting, setDeleting] = useState(null);
  const [expandedComments, setExpandedComments] = useState({});
  const [hoveredLike, setHoveredLike] = useState(null);
  
  // Image Modal State
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageAlt, setImageAlt] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image: null,
    imagePreview: null
  });
  
  // Comment state
  const [commentTexts, setCommentTexts] = useState({});
  
  const fileInputRef = useRef(null);
  const userRole = localStorage.getItem('role');
  const userId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName');

  // Check if user is Admin
  const isAdmin = ['Admin', 'Super Admin'].includes(userRole);

  // Check if user can create announcements
  const canCreateAnnouncements = ['Super Admin', 'Admin', 'HR', 'Project Manager', 'Sales Manager'].includes(userRole);

  // Check if user is HR (for display purposes)
  const isHR = userRole === 'HR';

  // Auto-open create modal from sidebar navigation
  useEffect(() => {
    if (location.state?.openCreateModal) {
      setShowCreateModal(true);
      // Clear the state to prevent reopening on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Fetch announcements (page 1 replaces the list; later pages append for infinite scroll)
  const fetchAnnouncements = async (pageNum = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/announcements`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: pageNum, limit: PAGE_LIMIT }
      });

      if (res.data.success) {
        setAnnouncements(prev =>
          append ? [...prev, ...res.data.announcements] : res.data.announcements
        );
        setPage(pageNum);
        const totalPages = res.data.pagination?.pages ?? pageNum;
        setHasMore(pageNum < totalPages);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements(1, false);
  }, []);

  // Infinite scroll: observe a sentinel just past the last card and load
  // the next page in once it enters the viewport.
  useEffect(() => {
    if (!hasMore || loading) return undefined;
    const sentinel = loadMoreRef.current;
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchAnnouncements(page + 1, true);
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [page, hasMore, loadingMore, loading]);

  // ============================================
  // IMAGE MODAL HANDLERS
  // ============================================
  const openImageModal = (imageUrl, altText) => {
    setSelectedImage(imageUrl);
    setImageAlt(altText || 'Announcement image');
    setImageModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeImageModal = () => {
    setImageModalOpen(false);
    setSelectedImage(null);
    setImageAlt('');
    document.body.style.overflow = 'unset';
  };

  // Handle keyboard escape for modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && imageModalOpen) {
        closeImageModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [imageModalOpen]);

  // ============================================
  // CREATE ANNOUNCEMENT
  // ============================================
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreating(true);
    try {
      const token = localStorage.getItem('token');
      let imageUrl = null;

      if (formData.image) {
        const imageFormData = new FormData();
        imageFormData.append('image', formData.image);
        
        const uploadRes = await axios.post(
          `${API_BASE_URL}/api/announcements/upload-image`,
          imageFormData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
        
        if (uploadRes.data.success) {
          imageUrl = uploadRes.data.url;
        }
      }

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        image: imageUrl
      };

      const res = await axios.post(
        `${API_BASE_URL}/api/announcements`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        toast.success('Announcement created successfully!');
        setShowCreateModal(false);
        setFormData({
          title: '',
          description: '',
          image: null,
          imagePreview: null
        });
        fetchAnnouncements(1, false);
      }
    } catch (error) {
      console.error('Error creating announcement:', error);
      toast.error(error.response?.data?.error || 'Failed to create announcement');
    } finally {
      setCreating(false);
    }
  };

  // ============================================
  // LIKE / UNLIKE - UPDATED
  // ============================================
  const handleLike = async (announcementId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_BASE_URL}/api/announcements/${announcementId}/like`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        setAnnouncements(prev =>
          prev.map(a => {
            if (a._id === announcementId) {
              return { 
                ...a, 
                likes: res.data.likes,
                likeCount: res.data.likeCount 
              };
            }
            return a;
          })
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to like announcement');
    }
  };

  // ============================================
  // GET LIKED USERS WITH REAL NAMES
  // ============================================
  const getLikedUsers = (announcement) => {
    if (!announcement.likes || announcement.likes.length === 0) return [];
    
    const likedUsers = [];
    
    announcement.likes.forEach(user => {
      if (typeof user === 'object' && user !== null) {
        likedUsers.push({
          name: user.name || 'Team Member',
          _id: user._id || user,
          isCurrentUser: user._id === userId || user === userId
        });
      } else {
        if (user === userId) {
          likedUsers.push({ name: userName || 'You', _id: user, isCurrentUser: true });
        } else {
          likedUsers.push({ name: 'Team Member', _id: user, isCurrentUser: false });
        }
      }
    });
    
    return likedUsers;
  };

  // ============================================
  // ADD COMMENT
  // ============================================
  const handleAddComment = async (announcementId) => {
    const text = commentTexts[announcementId] || '';
    if (!text.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    setSubmittingComment(prev => ({ ...prev, [announcementId]: true }));

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_BASE_URL}/api/announcements/${announcementId}/comments`,
        { text: text.trim() },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        setAnnouncements(prev =>
          prev.map(a => {
            if (a._id === announcementId) {
              return {
                ...a,
                comments: [...(a.comments || []), res.data.comment],
                commentCount: res.data.commentCount
              };
            }
            return a;
          })
        );
        setCommentTexts(prev => ({ ...prev, [announcementId]: '' }));
        toast.success('Comment added');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error(error.response?.data?.error || 'Failed to add comment');
    } finally {
      setSubmittingComment(prev => ({ ...prev, [announcementId]: false }));
    }
  };

  // ============================================
  // DELETE COMMENT
  // ============================================
  const handleDeleteComment = async (announcementId, commentId) => {
    const announcement = announcements.find(a => a._id === announcementId);
    
    if (announcement?.isAutomated && !isAdmin) {
      toast.error('Comments on automated posts can only be deleted by Admins');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await axios.delete(
        `${API_BASE_URL}/api/announcements/${announcementId}/comments/${commentId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        setAnnouncements(prev =>
          prev.map(a => {
            if (a._id === announcementId) {
              return {
                ...a,
                comments: (a.comments || []).filter(c => c._id !== commentId),
                commentCount: res.data.commentCount
              };
            }
            return a;
          })
        );
        toast.success('Comment deleted');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  // ============================================
  // DELETE ANNOUNCEMENT
  // ============================================
  const handleDeleteAnnouncement = async (announcementId) => {
    const announcement = announcements.find(a => a._id === announcementId);
    
    if (announcement?.isAutomated && !isAdmin) {
      toast.error('Automated posts can only be deleted by Admins');
      return;
    }

    const confirmMessage = announcement?.isAutomated 
      ? 'Are you sure you want to delete this automated post? This action cannot be undone.'
      : 'Are you sure you want to delete this announcement?';
      
    if (!window.confirm(confirmMessage)) return;

    setDeleting(announcementId);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.delete(
        `${API_BASE_URL}/api/announcements/${announcementId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        setAnnouncements(prev => prev.filter(a => a._id !== announcementId));
        toast.success('Announcement deleted');
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement');
    } finally {
      setDeleting(null);
    }
  };

  // ============================================
  // FILE HANDLING
  // ============================================
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData(prev => ({
        ...prev,
        image: file,
        imagePreview: e.target.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setFormData(prev => ({
      ...prev,
      image: null,
      imagePreview: null
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ============================================
  // TOGGLE COMMENTS
  // ============================================
  const toggleComments = (announcementId) => {
    setExpandedComments(prev => ({
      ...prev,
      [announcementId]: !prev[announcementId]
    }));
  };

  // ============================================
  // FORMAT TIME
  // ============================================
  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  // ============================================
  // CHECK IF USER CAN DELETE ANNOUNCEMENT
  // ============================================
  const canDeleteAnnouncement = (announcement) => {
    if (announcement.isAutomated) {
      return isAdmin;
    }
    const isOwner = announcement.createdBy?._id === userId || announcement.createdBy === userId;
    return isAdmin || isOwner;
  };

  // ============================================
  // CHECK IF USER CAN DELETE COMMENT
  // ============================================
  const canDeleteComment = (comment, announcement) => {
    if (announcement?.isAutomated) {
      return isAdmin;
    }
    const isOwner = comment.userId?._id === userId || comment.userId === userId;
    return isAdmin || isOwner;
  };

  // ============================================
  // GET USER AVATAR
  // ============================================
  const getUserAvatar = (user) => {
    if (!user) return null;
    
    if (user.profileImage) {
      if (user.profileImage.startsWith('http://') || user.profileImage.startsWith('https://')) {
        return user.profileImage;
      }
      return `${API_BASE_URL}${user.profileImage.startsWith('/') ? user.profileImage : '/' + user.profileImage}`;
    }
    return null;
  };

  // ============================================
  // RENDER
  // ============================================
  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <Loader2 size={48} className="text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading announcements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
                <Megaphone size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Announcements
                </h1>
                <p className="text-slate-500 mt-1">Stay updated with team news and celebrations</p>
              </div>
            </div>
          </div>
          {canCreateAnnouncements && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200"
            >
              <Plus size={18} />
              Create Post
            </button>
          )}
        </div>
      </div>

      {/* Announcements Feed */}
      <div className="max-w-3xl mx-auto space-y-6">
        {announcements.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Megaphone size={32} className="text-slate-300" />
            </div>
            <p className="text-lg font-bold text-slate-500">No announcements yet</p>
            <p className="text-sm text-slate-400 mt-1">Be the first to share something with the team!</p>
          </div>
        ) : (
          announcements.map((announcement) => {
            const isLiked = announcement.likes?.some(l => l._id === userId || l === userId) || false;
            const likeCount = announcement.likes?.length || 0;
            const commentCount = announcement.comments?.length || 0;
            const isExpanded = expandedComments[announcement._id] || false;
            const isAutomated = announcement.isAutomated;
            const isBirthday = announcement.automatedType === 'birthday';
            const isWorkAnniversary = announcement.automatedType === 'work_anniversary';
            const creator = announcement.createdBy || {};
            
            let creatorName = announcement.createdByName || creator.name || 'Unknown';
            let creatorRole = announcement.createdByRole || creator.role || '';
            
            if (isAutomated) {
              creatorName = 'HR';
              creatorRole = 'HR';
            }
            
            const creatorAvatar = announcement.createdByAvatar || creator.profileImage || null;
            const isLikedHovered = hoveredLike === announcement._id;
            
            const likeUsers = getLikedUsers(announcement);
            const showTooltip = isLikedHovered && likeUsers && likeUsers.length > 0;

            let avatarUrl = null;
            if (creatorAvatar) {
              avatarUrl = creatorAvatar.startsWith('http://') || creatorAvatar.startsWith('https://') 
                ? creatorAvatar 
                : `${API_BASE_URL}${creatorAvatar.startsWith('/') ? creatorAvatar : '/' + creatorAvatar}`;
            }

            const canDelete = canDeleteAnnouncement(announcement);

            return (
              <div
                key={announcement._id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                  isAutomated 
                    ? isBirthday 
                      ? 'border-pink-200 bg-gradient-to-br from-pink-50/50 to-white' 
                      : 'border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white'
                    : 'border-slate-200'
                }`}
              >
                {/* Automated Badge */}
                {isAutomated && (
                  <div className={`px-4 py-1.5 text-xs font-bold flex items-center gap-2 ${
                    isBirthday 
                      ? 'bg-pink-100 text-pink-700' 
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {isBirthday ? (
                      <>
                        <Calendar size={14} />
                        🎉 Birthday Celebration
                      </>
                    ) : (
                      <>
                        <Award size={14} />
                        🎊 Work Anniversary
                      </>
                    )}
                  </div>
                )}

                {/* Post Header */}
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-500 flex-shrink-0">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={creatorName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.className = 'w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0';
                              e.target.parentElement.textContent = creatorName?.charAt(0)?.toUpperCase() || '?';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                            {creatorName?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">
                          {creatorName}
                          {isHR && !isAutomated && (
                            <span className="ml-2 text-[8px] font-bold uppercase tracking-wider text-pink-500 bg-pink-50 px-2 py-0.5 rounded-full">
                              HR
                            </span>
                          )}
                         
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{creatorRole || 'Team Member'}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {formatTime(announcement.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {canDelete && (
                      <button
                        onClick={() => handleDeleteAnnouncement(announcement._id)}
                        disabled={deleting === announcement._id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                        title={isAutomated ? 'Delete automated post' : 'Delete announcement'}
                      >
                        {deleting === announcement._id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Title */}
                  <h2 className="text-xl font-bold text-slate-800 mt-3 mb-2">
                    {announcement.title}
                  </h2>

                  {/* Description */}
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {announcement.description}
                  </p>

                  {/* Image - Clickable to open modal */}
                  {announcement.image && (
                    <div 
                      className="mt-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer hover:opacity-95 transition-opacity group relative"
                      onClick={() => openImageModal(announcement.image, announcement.title)}
                    >
                      <img
                        src={announcement.image}
                        alt={announcement.title}
                        className="w-full max-h-[500px] object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      {/* Expand icon overlay */}
                      <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                        <Expand size={14} />
                        <span className="text-[10px] font-medium">Expand</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Engagement Bar */}
                <div className="px-6 py-3 border-t border-slate-100 flex items-center gap-6">
                  <div 
                    className="relative"
                    onMouseEnter={() => setHoveredLike(announcement._id)}
                    onMouseLeave={() => setHoveredLike(null)}
                  >
                    <button
                      onClick={() => handleLike(announcement._id)}
                      className={`flex items-center gap-2 text-sm font-medium transition-all ${
                        isLiked ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'
                      }`}
                    >
                      {isLiked ? (
                        <ThumbsUpFilled size={18} className="fill-blue-600" />
                      ) : (
                        <ThumbsUp size={18} />
                      )}
                      <span>{likeCount}</span>
                    </button>

                    {showTooltip && (
                      <div className="absolute bottom-full left-0 mb-2 bg-slate-900 text-white rounded-xl shadow-2xl p-3 min-w-[180px] max-w-[280px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700">
                          <Users size={14} className="text-blue-400" />
                          <span className="text-xs font-bold">Liked by</span>
                          <span className="text-xs text-slate-400">({likeCount})</span>
                        </div>
                        <div className="max-h-[120px] overflow-y-auto space-y-1.5">
                          {likeUsers && likeUsers.length > 0 ? (
                            likeUsers.map((user, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
                                  {user.name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <span className="text-slate-200 font-medium">
                                  {user.name || 'Team Member'}
                                  {user._id === userId && (
                                    <span className="ml-1 text-[8px] text-blue-400">(You)</span>
                                  )}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-400">No users found</div>
                          )}
                        </div>
                        <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-slate-900 rotate-45"></div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => toggleComments(announcement._id)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-all"
                  >
                    <MessageSquare size={18} />
                    <span>{commentCount}</span>
                  </button>
                </div>

                {/* Comments Section */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-3 border-t border-slate-100">
                    <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                      {announcement.comments && announcement.comments.length > 0 ? (
                        announcement.comments.map((comment) => {
                          const commentUser = comment.userId || {};
                          const commentName = comment.userName || commentUser.name || 'Unknown';
                          const commentAvatar = comment.userAvatar || commentUser.profileImage || null;
                          const canDelete = canDeleteComment(comment, announcement);
                          
                          let commentAvatarUrl = null;
                          if (commentAvatar) {
                            commentAvatarUrl = commentAvatar.startsWith('http://') || commentAvatar.startsWith('https://') 
                              ? commentAvatar 
                              : `${API_BASE_URL}${commentAvatar.startsWith('/') ? commentAvatar : '/' + commentAvatar}`;
                          }
                          
                          return (
                            <div key={comment._id} className="flex gap-3">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-500 flex-shrink-0">
                                {commentAvatarUrl ? (
                                  <img
                                    src={commentAvatarUrl}
                                    alt={commentName}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.parentElement.className = 'w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0';
                                      e.target.parentElement.textContent = commentName?.charAt(0)?.toUpperCase() || '?';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                                    {commentName?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-slate-800">{commentName}</span>
                                  <span className="text-[10px] text-slate-400">{formatTime(comment.createdAt)}</span>
                                  {canDelete && (
                                    <button
                                      onClick={() => handleDeleteComment(announcement._id, comment._id)}
                                      className="text-slate-400 hover:text-red-600 transition-colors"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600 break-words">{comment.text}</p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-400 text-center py-2">No comments yet</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Write a comment..."
                        value={commentTexts[announcement._id] || ''}
                        onChange={(e) => setCommentTexts(prev => ({
                          ...prev,
                          [announcement._id]: e.target.value
                        }))}
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment(announcement._id);
                          }
                        }}
                      />
                      <button
                        onClick={() => handleAddComment(announcement._id)}
                        disabled={submittingComment[announcement._id] || !commentTexts[announcement._id]?.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {submittingComment[announcement._id] ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Send size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Infinite scroll sentinel + loading / end-of-list states */}
        {announcements.length > 0 && (
          <div ref={loadMoreRef} className="py-6 flex items-center justify-center">
            {loadingMore ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm font-medium">Loading more...</span>
              </div>
            ) : !hasMore ? (
              <p className="text-sm font-medium text-slate-300">You're all caught up</p>
            ) : null}
          </div>
        )}
      </div>

      {/* ============================================
          IMAGE MODAL - Full screen image viewer
          ============================================ */}
      {imageModalOpen && selectedImage && (
        <div 
          className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={closeImageModal}
        >
          {/* Close button */}
          <button
            onClick={closeImageModal}
            className="absolute top-4 right-4 text-white/60 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all z-10"
            aria-label="Close image"
          >
            <X size={28} />
          </button>

          {/* Download button */}
          <a
            href={selectedImage}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 right-16 text-white/60 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all z-10"
            onClick={(e) => e.stopPropagation()}
            aria-label="Download image"
          >
            <Download size={24} />
          </a>

          {/* Image container */}
          <div 
            className="relative max-w-[90vw] max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage}
              alt={imageAlt || 'Announcement image'}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onError={(e) => {
                e.target.alt = 'Image failed to load';
                e.target.className = 'max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl bg-slate-800 p-8';
              }}
            />
          </div>

          {/* Image info */}
          {imageAlt && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg max-w-[80%] text-center">
              {imageAlt}
            </div>
          )}

          {/* Click to close hint */}
          <div className="absolute bottom-20 text-white/20 text-xs font-medium animate-pulse">
            Click outside to close
          </div>
        </div>
      )}

      {/* Create Announcement Modal */}
      {showCreateModal && canCreateAnnouncements && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-black text-slate-800">Create Announcement</h2>
                <p className="text-sm text-slate-500 mt-0.5">Share news with the team</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="p-6 space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter announcement title..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-sm font-medium focus:border-blue-400 transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Write your announcement..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-sm font-medium resize-none focus:border-blue-400 transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Image (Optional)
                </label>
                
                {formData.imagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img
                      src={formData.imagePreview}
                      alt="Preview"
                      className="w-full max-h-[300px] object-contain"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition-all cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Camera size={32} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600">Click to upload an image</p>
                    <p className="text-xs text-slate-400">JPG, PNG, GIF, WEBP • Max 10MB</p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <><Loader2 size={18} className="animate-spin" /> Creating...</>
                ) : (
                  <><Megaphone size={18} /> Publish Announcement</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Announcements;