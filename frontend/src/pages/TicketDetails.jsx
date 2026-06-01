import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Calendar, MessageSquare, Send, Users, 
  CheckCircle, XCircle, Clock, Image, X, 
  Loader2, Eye, Download, UploadCloud
} from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import io from 'socket.io-client';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import notificationManager from '../utils/notifications';

const TicketDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [developers, setDevelopers] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const { isCollapsed } = useSidebar();
  const socketRef = useRef();
  const commentsEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const userRole = localStorage.getItem('role');
  const currentUserId = localStorage.getItem('userId');
  const currentUserName = localStorage.getItem('userName');

  const statusFlow = ['Open', 'In Progress', 'Resolved', 'Closed'];
  const currentStatusIndex = ticket ? statusFlow.indexOf(ticket.status) : -1;

  const showCommentNotification = (ticketData, commentAuthor, imageCount = 0) => {
    if (commentAuthor === currentUserName || commentAuthor === currentUserId) return;
    
    const isCreator = ticketData.createdBy?._id === currentUserId || ticketData.createdBy === currentUserId;
    const isAssignee = ticketData.assignedTo?._id === currentUserId || ticketData.assignedTo === currentUserId;
    
    if (isCreator || isAssignee) {
      const imageText = imageCount > 0 ? ` 📷 +${imageCount} image(s)` : '';
      notificationManager.show({
        title: '💬 New Comment on Ticket',
        body: `${commentAuthor} commented${imageText}: "${ticketData.title.substring(0, 50)}"`,
        icon: '/images/login_img.png',
        tag: `comment-${ticketData._id}`,
        data: { ticketId: ticketData._id, type: 'ticket' },
        onClick: () => {
          window.focus();
          navigate(`/tickets/${ticketData._id}`);
        }
      });
    }
  };

  useEffect(() => {
    fetchTicketDetails();
    fetchDevelopers();
    
    notificationManager.initAudio();
    
    socketRef.current = io(API_BASE_URL);
    socketRef.current.emit('join-ticket-room', id);
    socketRef.current.emit('join-user-room', currentUserId);
    
    socketRef.current.on('ticket_updated', (updatedTicket) => {
      if (updatedTicket._id === id) {
        const oldStatus = ticket?.status;
        setTicket(updatedTicket);
        toast(`Ticket status updated to ${updatedTicket.status}`, {
          icon: '🔄',
          duration: 3000
        });
        
        if (oldStatus && oldStatus !== updatedTicket.status) {
          if (updatedTicket.createdBy?._id === currentUserId || updatedTicket.assignedTo?._id === currentUserId) {
            notificationManager.notifyStatusUpdate(updatedTicket, oldStatus, updatedTicket.status, () => {
              navigate(`/tickets/${updatedTicket._id}`);
            });
          }
        }
      }
    });
    
    socketRef.current.on('ticket_commented', (updatedTicket) => {
      if (updatedTicket._id === id) {
        const comments = updatedTicket.comments || [];
        const lastComment = comments[comments.length - 1];
        
        if (lastComment) {
          const commentUserId = typeof lastComment.userId === 'object' ? lastComment.userId._id : lastComment.userId;
          const commentUserName = lastComment.userName || lastComment.userId?.name || 'Someone';
          
          setTicket(updatedTicket);
          
          if (commentUserId !== currentUserId) {
            const imageCount = lastComment.images?.length || 0;
            toast(`${commentUserName} commented${imageCount > 0 ? ` 📷 +${imageCount} image(s)` : ''}: ${lastComment.text?.substring(0, 50) || ''}`, {
              icon: '💬',
              duration: 4000
            });
            
            showCommentNotification(updatedTicket, commentUserName, imageCount);
          }
        }
      }
    });
    
    socketRef.current.on('ticket_assigned', (assignedTicket) => {
      if (assignedTicket._id === id) {
        setTicket(assignedTicket);
        if (assignedTicket.assignedTo?._id === currentUserId) {
          toast.success(`Ticket assigned to you: ${assignedTicket.title}`);
          notificationManager.notifyTicketAssigned(assignedTicket, () => {
            navigate(`/tickets/${assignedTicket._id}`);
          });
        }
      }
    });
    
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [id]);

  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ticket?.comments]);

  const fetchTicketDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTicket(res.data);
    } catch (error) {
      console.error('Error fetching ticket:', error);
      toast.error('Failed to load ticket details');
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevelopers = async () => {
    if (userRole !== 'Project Manager' && userRole !== 'Admin') return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tickets/developers/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDevelopers(res.data);
    } catch (error) {
      console.error('Error fetching developers:', error);
    }
  };

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(`${API_BASE_URL}/api/tickets/${id}/status`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTicket(res.data);
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const closeTicket = async () => {
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(`${API_BASE_URL}/api/tickets/${id}/status`, 
        { status: 'Closed' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTicket(res.data);
      toast.success('Ticket closed successfully');
    } catch (error) {
      console.error('Error closing ticket:', error);
      toast.error('Failed to close ticket');
    } finally {
      setUpdating(false);
    }
  };

  const assignDeveloper = async (developerId) => {
    if (!developerId) return;
    
    setAssigning(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(`${API_BASE_URL}/api/tickets/${id}/assign`,
        { assignedTo: developerId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTicket(res.data);
      toast.success('Developer assigned successfully');
    } catch (error) {
      console.error('Error assigning developer:', error);
      toast.error('Failed to assign developer');
    } finally {
      setAssigning(false);
    }
  };

  const validateAndProcessFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      toast.error('Please select or drop a valid image file');
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    validateAndProcessFile(file);
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
    const file = e.dataTransfer.files[0];
    validateAndProcessFile(file);
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/tickets/upload-image`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data.url;
    } catch (error) {
      console.error('Image upload failed:', error);
      throw new Error(error.response?.data?.error || 'Failed to upload image');
    }
  };

  const addComment = async (e) => {
    if (e) e.preventDefault();
    if (!newComment.trim() && !selectedImage) {
      toast.error('Please enter a comment or select an image');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      let imageUrl = null;
      
      if (selectedImage) {
        setUploadingImage(true);
        imageUrl = await uploadImage(selectedImage);
        setUploadingImage(false);
      }
      
      const payload = {
        text: newComment.trim() || '📷 Image attached',
        images: imageUrl ? [imageUrl] : []
      };
      
      const res = await axios.post(`${API_BASE_URL}/api/tickets/${id}/comments`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setTicket(res.data);
      setNewComment('');
      removeSelectedImage();
      toast.success('Comment added');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error(error.response?.data?.error || 'Failed to add comment');
      setUploadingImage(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Open': return 'bg-blue-100 text-blue-700';
      case 'In Progress': return 'bg-yellow-100 text-yellow-700';
      case 'Resolved': return 'bg-green-100 text-green-700';
      case 'Closed': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'Urgent': return 'bg-red-100 text-red-700';
      case 'High': return 'bg-orange-100 text-orange-700';
      case 'Medium': return 'bg-yellow-100 text-yellow-700';
      case 'Low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const isTicketCreator = ticket && ticket.createdBy && (ticket.createdBy._id === currentUserId || ticket.createdBy === currentUserId);

  const formatCommentTime = (date) => {
    if (!date) return 'Unknown';
    
    try {
      const commentDate = new Date(date);
      if (isNaN(commentDate.getTime())) return 'Invalid date';
      
      const now = new Date();
      const diffMs = now - commentDate;
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffSeconds < 5) return 'Just now';
      if (diffMins < 1) return diffSeconds + ' seconds ago';
      if (diffMins === 1) return '1 minute ago';
      if (diffMins < 60) return diffMins + ' minutes ago';
      if (diffHours === 1) return '1 hour ago';
      if (diffHours < 24) return diffHours + ' hours ago';
      if (diffDays === 1) return 'Yesterday';
      return diffDays + ' days ago';
    } catch (error) {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-gray-50 flex items-center justify-center ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading ticket...</p>
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className={`min-h-screen bg-gray-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/tickets')}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium text-sm"
        >
          <ArrowLeft size={18} />
          Back to Tickets
        </button>
        
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="font-mono text-sm font-medium text-gray-500">{ticket.ticketNumber}</span>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md ${getStatusColor(ticket.status)}`}>
                {ticket.status}
              </span>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md ${getPriorityColor(ticket.priority)}`}>
                {ticket.priority}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{ticket.title}</h1>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {userRole === 'Client' && isTicketCreator && ticket.status !== 'Closed' && (
              <button onClick={closeTicket} disabled={updating} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 shadow-sm">
                <XCircle size={16} /> Close Ticket
              </button>
            )}
            {(userRole === 'Project Manager' || userRole === 'Admin' || userRole === 'Developer') && ticket.status !== 'Closed' && (
              <div className="flex gap-2">
                {ticket.status !== 'In Progress' && (
                  <button onClick={() => updateStatus('In Progress')} disabled={updating} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm">
                    Start Progress
                  </button>
                )}
                {ticket.status !== 'Resolved' && (
                  <button onClick={() => updateStatus('Resolved')} disabled={updating} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm">
                    Mark Resolved
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Progress Map */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <CheckCircle size={16} className="text-blue-600" />
          Ticket Progress
        </h3>
        <div className="flex items-center justify-between">
          {statusFlow.map((status, index) => {
            const isCompleted = index <= currentStatusIndex;
            const isCurrent = status === ticket.status;
            
            return (
              <div key={status} className="flex-1 relative">
                <div className="flex flex-col items-center">
                  {index < statusFlow.length - 1 && (
                    <div className={`absolute top-4 left-1/2 w-full h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} 
                         style={{ width: 'calc(100% - 40px)', left: 'calc(50% + 20px)' }} />
                  )}
                  <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                    ${isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}
                    ${isCurrent ? 'ring-4 ring-blue-100 ring-offset-2 border border-blue-500' : ''}`}>
                    {isCompleted ? <CheckCircle size={16} /> : index + 1}
                  </div>
                  <p className={`mt-2 text-xs font-semibold ${isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                    {status}
                  </p>
                  {isCurrent && <span className="text-[9px] text-blue-600 font-bold mt-0.5 uppercase tracking-wide">Current</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">{ticket.description}</p>
          </div>
          
          {/* Chat Container Window */}
          <div 
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag and Drop Hover Overlay Backdrop */}
            {isDragging && (
              <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[2px] border-2 border-dashed border-blue-500 z-50 flex flex-col items-center justify-center transition-all pointer-events-none">
                <div className="bg-white p-4 rounded-full shadow-lg flex items-center justify-center animate-bounce mb-2">
                  <UploadCloud size={32} className="text-blue-600" />
                </div>
                <p className="text-blue-700 font-bold text-lg">Drop your screenshot here to attach</p>
                <p className="text-blue-600/80 text-xs">Supports PNG, JPG, JPEG (Max 5MB)</p>
              </div>
            )}

            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare size={20} className="text-gray-500" />
                Conversation ({ticket.comments?.length || 0})
              </h2>
              <p className="text-xs text-gray-500 mt-1">Discuss this ticket with the team or drag images over this window to upload</p>
            </div>
            
            <div className="flex-1 max-h-[400px] overflow-y-auto p-6 space-y-4 bg-gray-50/50">
              {ticket.comments && ticket.comments.length > 0 ? (
                <>
                  {ticket.comments.map((comment, idx) => {
                    const isCurrentUser = comment.userId?._id === currentUserId || comment.userId === currentUserId;
                    const commentUser = comment.userName || comment.userId?.name || 'Unknown User';
                    const userInitial = commentUser.charAt(0).toUpperCase();
                    const commentTime = formatCommentTime(comment.createdAt);
                    const hasImages = comment.images && comment.images.length > 0;
                    
                    return (
                      <div key={idx} className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm ${
                          isCurrentUser ? 'bg-blue-600' : 'bg-gray-400'
                        }`}>
                          {userInitial}
                        </div>
                        
                        <div className={`flex-1 max-w-[70%] ${isCurrentUser ? 'items-end' : ''}`}>
                          <div className={`rounded-lg p-3 shadow-sm ${
                            isCurrentUser ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'
                          }`}>
                            <div className={`text-xs font-bold mb-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
                              {commentUser}
                            </div>
                            {comment.text && (
                              <p className={`text-sm leading-relaxed ${isCurrentUser ? 'text-white' : 'text-gray-700'}`}>
                                {comment.text}
                              </p>
                            )}
                            {hasImages && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {comment.images.map((img, imgIdx) => (
                                  <div key={imgIdx} className="relative group">
                                    <img
                                      src={img}
                                      alt={`Attachment ${imgIdx + 1}`}
                                      className="max-w-[200px] max-h-[150px] rounded-lg cursor-pointer border border-gray-100 shadow-sm hover:opacity-90 transition-opacity"
                                      onClick={() => setShowImageViewer(img)}
                                    />
                                    <button
                                      onClick={() => setShowImageViewer(img)}
                                      className="absolute top-1 right-1 p-1 bg-black/60 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Eye size={12} className="text-white" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className={`flex items-center gap-1 mt-1 text-[10px] text-gray-400 ${isCurrentUser ? 'justify-end' : ''}`}>
                            <Clock size={10} />
                            <span>{commentTime}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={commentsEndRef} />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare size={48} className="text-gray-300 mb-2" />
                  <p className="text-gray-500 font-semibold text-sm">No comments yet</p>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto">Start the conversation by typing a message below or dropping a file.</p>
                </div>
              )}
            </div>
            
            {/* Form Box + Aligned Interactive Row */}
            <div className="border-t border-gray-200 bg-white p-4">
              {imagePreview && (
                <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-200 relative inline-block shadow-sm">
                  <img src={imagePreview} alt="Preview" className="max-w-[100px] max-h-[80px] rounded object-cover" />
                  <button
                    type="button"
                    onClick={removeSelectedImage}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              
              {/* Perfectly Aligned Form Row Container */}
              <div className="flex items-center gap-2 w-full bg-gray-50 border border-gray-300 rounded-lg p-1 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                {/* 1. Dynamic Resizing Textarea Component */}
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write your message..."
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-gray-700 outline-none resize-none self-center min-h-[38px] max-h-[120px]"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (newComment.trim() || selectedImage) addComment();
                    }
                  }}
                />
                
                {/* 2. Attachment Icon Trigger Component */}
                <div className="flex items-center self-center h-full px-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    disabled={uploadingImage}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200/70 rounded-md transition-colors flex items-center justify-center disabled:opacity-50"
                    title="Attach image"
                  >
                    <Image size={18} />
                  </button>
                </div>
                
                {/* 3. Action Submittal Button Component */}
                <button
                  type="button"
                  onClick={() => addComment()}
                  disabled={(!newComment.trim() && !selectedImage) || uploadingImage}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-md transition-all flex items-center gap-1.5 font-medium text-sm shadow-sm h-[36px] self-center disabled:shadow-none"
                >
                  {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                  <span>Send</span>
                </button>
              </div>
              
              <div className="flex justify-between text-[11px] text-gray-400 mt-2 px-1">
                <span>Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for a new line</span>
                <span>Drag & Drop images or <button type="button" onClick={() => fileInputRef.current.click()} className="text-blue-500 hover:underline">browse files</button> (max 5MB)</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Info Sidebar Segment */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm uppercase tracking-wider">Ticket Metadata</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Created By</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <User size={15} className="text-gray-400" />
                  <span className="text-sm text-gray-800 font-medium">{ticket.createdBy?.name}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Created At</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Calendar size={15} className="text-gray-400" />
                  <span className="text-sm text-gray-800 font-medium">{new Date(ticket.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Project Scope</p>
                <p className="text-sm text-gray-800 font-medium mt-1.5 bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-200">{ticket.projectId?.name}</p>
              </div>
              {ticket.feedId && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Related Feed</p>
                  <p className="text-sm text-gray-800 font-medium mt-1.5">{ticket.feedId?.name}</p>
                </div>
              )}
              {ticket.resolvedAt && (
                <div>
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Resolved At</p>
                  <p className="text-sm text-gray-800 font-medium mt-1">{new Date(ticket.resolvedAt).toLocaleString()}</p>
                </div>
              )}
              {ticket.closedAt && (
                <div>
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Closed At</p>
                  <p className="text-sm text-gray-800 font-medium mt-1">{new Date(ticket.closedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Conditional Assignment Dashboard Element */}
          {(userRole === 'Project Manager' || userRole === 'Admin' || userRole === 'Developer') && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Users size={16} className="text-gray-500" /> Operational Assignment
              </h3>
              {ticket.assignedTo ? (
                <div className="mb-4 p-3 bg-green-50/70 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-700 font-semibold mb-1">Assigned Developer:</p>
                  <p className="font-semibold text-gray-900 text-sm">{ticket.assignedTo.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{ticket.assignedTo.email}</p>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg font-medium">
                  This work ticket is currently unassigned.
                </div>
              )}
              {(userRole === 'Project Manager' || userRole === 'Admin') && (
                <select 
                  onChange={(e) => assignDeveloper(e.target.value)} 
                  disabled={assigning} 
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm cursor-pointer" 
                  defaultValue=""
                >
                  <option value="">Reassign developer...</option>
                  {developers.map(dev => (
                    <option key={dev._id} value={dev._id}>{dev.name} ({dev.email})</option>
                  ))}
                </select>
              )}
              {userRole === 'Developer' && ticket.assignedTo?._id === currentUserId && (
                <div className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1.5">
                  <CheckCircle size={14} /> You are actively managing this task item.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full Screen Image Viewer Modal Overlay Component */}
      {showImageViewer && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4" onClick={() => setShowImageViewer(null)}>
          <div className="relative max-w-4xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <img src={showImageViewer} alt="Full size view" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            
            {/* Modal Actions */}
            <div className="absolute -top-12 right-0 flex items-center gap-3">
              <a 
                href={showImageViewer} 
                download 
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1.5 text-white text-xs font-medium backdrop-blur-sm"
              >
                <Download size={15} /> Download Image
              </a>
              <button 
                type="button"
                onClick={() => setShowImageViewer(null)} 
                className="p-2 bg-white/10 hover:bg-white/25 rounded-lg transition-colors backdrop-blur-sm"
              >
                <X size={18} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetails;