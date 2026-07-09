// frontend/src/components/NotificationBell.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff, MessageSquare, CheckCircle, AlertCircle, X, Clock } from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from '../config';
import notificationManager from '../utils/notifications';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const NotificationBell = () => {
  const [permission, setPermission] = useState('default');
  const [isSupported, setIsSupported] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [removingNotificationId, setRemovingNotificationId] = useState(null);

  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setIsSupported('Notification' in window);
    setPermission(Notification.permission);
    
    if (Notification.permission === 'granted') {
      notificationManager.permission = 'granted';
    }
    
    fetchNotificationCount();
    
    const interval = setInterval(fetchNotificationCount, 30000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const calculateDropdownPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = isMobile ? window.innerWidth - 32 : 380;
      const maxWidth = Math.min(dropdownWidth, 400);
      
      let right = window.innerWidth - rect.right;
      let top = rect.bottom + 8;
      
      if (top + 500 > window.innerHeight) {
        top = rect.top - 500 - 8;
        if (top < 10) {
          top = 10;
        }
      }
      
      if (right < 10) {
        right = 10;
      }
      if (right + maxWidth > window.innerWidth - 10) {
        right = window.innerWidth - maxWidth - 10;
      }
      
      setDropdownPosition({ top, right });
    }
  }, [isMobile]);

  const fetchNotificationCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const res = await axios.get(`${API_BASE_URL}/api/notifications/count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotificationCount(res.data.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filter out 'open_ticket' type notifications - only show real notifications
      const filteredNotifications = (res.data.notifications || []).filter(
        n => n.type !== 'open_ticket'
      );
      
      setNotifications(filteredNotifications);
      setNotificationCount(res.data.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBellClick = () => {
    if (permission !== 'granted') {
      requestNotificationPermission();
      return;
    }
    
    const newShowState = !showDropdown;
    setShowDropdown(newShowState);
    if (newShowState) {
      calculateDropdownPosition();
      fetchNotifications();
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotificationCount(prev => Math.max(0, prev - 1));
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API_BASE_URL}/api/notifications/mark-all-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Remove all notifications from the list
      setNotifications([]);
      setNotificationCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const handleNotificationClick = async (notification) => {
    // Set the notification ID for removal animation
    setRemovingNotificationId(notification._id);
    
    try {
      // Mark as read if it's a notification (not an open ticket)
      if (notification._id && !notification._id.toString().startsWith('open_')) {
        await markAsRead(notification._id);
      }
      
      // Remove from local state immediately
      setNotifications(prev => prev.filter(n => n._id !== notification._id));
      
      // Update notification count locally
      setNotificationCount(prev => Math.max(0, prev - 1));
      
      // Close dropdown
      setShowDropdown(false);
      
      // Clear removal state after a moment
      setTimeout(() => {
        setRemovingNotificationId(null);
      }, 300);
      
    } catch (error) {
      console.error('Error handling notification click:', error);
      // Even if there's an error, remove from local state
      setNotifications(prev => prev.filter(n => n._id !== notification._id));
      setNotificationCount(prev => Math.max(0, prev - 1));
      setRemovingNotificationId(null);
    }
    
    // If it's a ticket notification, navigate to the ticket
    if (notification.ticketId) {
      const ticketId = typeof notification.ticketId === 'object' 
        ? notification.ticketId._id 
        : notification.ticketId;
      
      // Small delay to allow the dropdown to close before navigation
      setTimeout(() => {
        navigate(`/tickets/${ticketId}`);
      }, 200);
    }
  };

  const requestNotificationPermission = async () => {
    const granted = await notificationManager.requestPermission();
    setPermission(granted ? 'granted' : 'denied');
    
    if (granted) {
      toast.success('Desktop notifications enabled!');
      notificationManager.show({
        title: 'Notifications Enabled',
        body: 'You will now receive real-time updates',
        icon: '/images/tab_logo.png', 
        silent: false
      });
    } else {
      toast.error('Notification permission denied');
    }
  };

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'ticket_created': return '🎫';
      case 'ticket_assigned': return '📋';
      case 'ticket_commented': return '💬';
      case 'ticket_status_updated': return '🔄';
      default: return '🔔';
    }
  };

  const getStatusColor = () => {
    if (!isSupported) return 'bg-gray-100';
    if (permission === 'granted') return 'bg-green-100';
    if (permission === 'denied') return 'bg-red-100';
    return 'bg-yellow-100';
  };

  const getTimeAgo = (date) => {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  const renderDropdown = () => {
    if (!showDropdown || permission !== 'granted') return null;

    const dropdownWidth = isMobile ? window.innerWidth - 32 : 380;
    const maxWidth = Math.min(dropdownWidth, 400);
    const isMobileFull = isMobile;

    return createPortal(
      <>
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99998] sm:hidden"
          onClick={() => setShowDropdown(false)}
        />
        
        <div 
          ref={dropdownRef}
          className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
          style={{
            position: 'fixed',
            top: isMobileFull ? '60px' : `${dropdownPosition.top}px`,
            right: isMobileFull ? '50%' : `${dropdownPosition.right}px`,
            left: isMobileFull ? '50%' : 'auto',
            transform: isMobileFull ? 'translateX(-50%)' : 'none',
            width: isMobileFull ? 'calc(100vw - 32px)' : `${maxWidth}px`,
            maxWidth: '400px',
            minWidth: isMobileFull ? 'calc(100vw - 32px)' : '320px',
            zIndex: 99999,
            transformOrigin: 'top right',
            maxHeight: '90vh',
          }}
        >
          <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-800">Notifications</span>
              {notificationCount > 0 && (
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                  {notificationCount}
                </span>
              )}
            </div>
            {notificationCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[500px]">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs text-gray-400 mt-2">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-500">No notifications</p>
                <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {notifications.map((notification, index) => {
                  const isRead = notification.read || false;
                  const ticketTitle = typeof notification.ticketId === 'object' 
                    ? notification.ticketId?.title || notification.message 
                    : notification.message;
                  const lastComment = notification.lastComment || 
                    (notification.ticketId?.comments && notification.ticketId.comments.length > 0 
                      ? notification.ticketId.comments[notification.ticketId.comments.length - 1] 
                      : null);
                  const isRemoving = removingNotificationId === notification._id;
                  
                  return (
                    <motion.div
                      key={notification._id || index}
                      layout
                      initial={{ opacity: 1, scale: 1, height: 'auto' }}
                      animate={{ 
                        opacity: isRemoving ? 0 : 1,
                        scale: isRemoving ? 0.8 : 1,
                        height: isRemoving ? 0 : 'auto',
                        marginBottom: isRemoving ? 0 : undefined,
                        padding: isRemoving ? 0 : undefined
                      }}
                      exit={{ 
                        opacity: 0, 
                        scale: 0.8,
                        height: 0,
                        marginBottom: 0,
                        paddingTop: 0,
                        paddingBottom: 0
                      }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      style={{
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        onClick={() => handleNotificationClick(notification)}
                        className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-all ${
                          !isRead ? 'bg-blue-50/50 border-l-4 border-l-blue-500' : ''
                        } ${isRemoving ? 'pointer-events-none opacity-50' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 text-lg mt-0.5">
                            {notification.type === 'ticket_commented' ? (
                              <MessageSquare size={16} className="text-purple-500" />
                            ) : (
                              getNotificationIcon(notification.type)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm ${!isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                                {ticketTitle || notification.message}
                              </p>
                              <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                                {getTimeAgo(notification.createdAt)}
                              </span>
                            </div>
                            
                            {notification.type === 'ticket_commented' && lastComment && (
                              <div className="mt-1.5 p-2 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-semibold text-gray-600">
                                    {lastComment.userName || 'User'}:
                                  </span>
                                  <span className="text-xs text-gray-600 line-clamp-2">
                                    {lastComment.text || 'No text'}
                                  </span>
                                </div>
                                {notification.hasAttachments && (
                                  <div className="mt-1 text-[10px] text-purple-500">
                                    📎 Has attachments
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {notification.ticketId && typeof notification.ticketId === 'object' && notification.ticketId.ticketNumber && (
                              <p className="text-xs text-gray-400 mt-1">
                                {notification.ticketId.ticketNumber}
                                {notification.ticketId.status && (
                                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] font-medium ${
                                    notification.ticketId.status === 'Open' ? 'bg-blue-100 text-blue-700' :
                                    notification.ticketId.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' :
                                    notification.ticketId.status === 'Resolved' ? 'bg-green-100 text-green-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {notification.ticketId.status}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                          {!isRead && (
                            <div className="flex-shrink-0 w-2 h-2 mt-1.5 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
          
          <div className="p-2 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => {
                setShowDropdown(false);
                navigate('/tickets');
              }}
              className="w-full text-center text-xs font-medium text-blue-600 hover:text-blue-800 py-1"
            >
              View all tickets →
            </button>
          </div>
        </div>
      </>,
      document.body
    );
  };

  // Calculate total count (unread notifications only - no open tickets)
  const totalCount = notificationCount;

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={handleBellClick}
        className={`relative p-1.5 rounded-lg transition-colors group ${getStatusColor()}`}
        title={permission === 'granted' ? 'Notifications Active' : 'Notifications Disabled'}
      >
        {permission === 'granted' ? (
          <Bell size={18} className="text-green-500" />
        ) : permission === 'denied' ? (
          <BellOff size={18} className="text-red-500" />
        ) : (
          <Bell size={18} className="text-yellow-500 animate-pulse" />
        )}
        
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-md">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {renderDropdown()}
    </div>
  );
};

export default NotificationBell;