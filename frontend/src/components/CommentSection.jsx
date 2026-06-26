// frontend/src/components/CommentSection.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Trash2, User, Clock, Loader2, X } from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const CommentSection = ({ 
  type, // 'project' or 'feed'
  entityId, 
  userRole, 
  userId,
  currentUserName,
  canComment = true,
  refreshTrigger = 0
}) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const commentsEndRef = useRef(null);
  
  const token = localStorage.getItem('token');
  
  // Determine the API endpoint based on type
  const getEndpoint = () => {
    if (type === 'project') {
      return `${API_BASE_URL}/api/comments/projects/${entityId}/comments`;
    }
    return `${API_BASE_URL}/api/comments/feeds/${entityId}/comments`;
  };
  
  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(getEndpoint(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(res.data.comments || []);
    } catch (err) {
      console.error('Error fetching comments:', err);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchComments();
  }, [entityId, refreshTrigger]);
  
  useEffect(() => {
    // Scroll to bottom when new comments are added
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await axios.post(
        getEndpoint(),
        { text: newComment.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setComments(prev => [...prev, res.data.comment]);
      setNewComment('');
      toast.success('Comment added');
    } catch (err) {
      console.error('Error adding comment:', err);
      toast.error(err.response?.data?.error || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleDelete = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }
    
    setDeleting(commentId);
    try {
      await axios.delete(`${getEndpoint()}/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setComments(prev => prev.filter(c => c._id !== commentId));
      toast.success('Comment deleted');
    } catch (err) {
      console.error('Error deleting comment:', err);
      toast.error(err.response?.data?.error || 'Failed to delete comment');
    } finally {
      setDeleting(null);
    }
  };
  
  // Check if user can delete a comment
  const canDeleteComment = (comment) => {
    if (userRole === 'Admin') return true;
    if (userRole === 'Project Manager') return true;
    return comment.userId?._id === userId || comment.userId === userId;
  };
  
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
    return d.toLocaleDateString();
  };
  
  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };
  
  const getCommenterClass = (comment) => {
    const isOwn = comment.userId?._id === userId || comment.userId === userId;
    return isOwn ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200';
  };
  
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={24} className="text-slate-400 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Comments List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p className="text-sm font-medium">No comments yet</p>
            <p className="text-xs">Start the conversation</p>
          </div>
        ) : (
          comments.map((comment) => {
            const commenterName = comment.userName || comment.userId?.name || 'Unknown User';
            const isOwn = comment.userId?._id === userId || comment.userId === userId;
            
            return (
              <div
                key={comment._id}
                className={`p-4 rounded-xl border ${getCommenterClass(comment)} transition-all`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                        isOwn ? 'bg-blue-600' : 'bg-slate-400'
                      }`}>
                        {getInitials(commenterName)}
                      </div>
                      <span className="font-bold text-sm text-slate-800">
                        {commenterName}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock size={10} />
                        {formatTime(comment.createdAt)}
                      </span>
                      {isOwn && (
                        <span className="text-[8px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                      {comment.text}
                    </p>
                  </div>
                  
                  {canDeleteComment(comment) && (
                    <button
                      onClick={() => handleDelete(comment._id)}
                      disabled={deleting === comment._id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all flex-shrink-0 disabled:opacity-50"
                      title="Delete comment"
                    >
                      {deleting === comment._id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={commentsEndRef} />
      </div>
      
      {/* Comment Input */}
      {canComment && (
        <form onSubmit={handleSubmit} className="flex items-end gap-2 pt-2 border-t border-slate-200">
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none font-medium text-sm text-slate-700 focus:border-blue-400 transition-all resize-none min-h-[48px] max-h-[100px]"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (newComment.trim()) handleSubmit(e);
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
      )}
    </div>
  );
};

export default CommentSection;