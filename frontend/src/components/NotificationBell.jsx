// frontend/src/components/NotificationBell.jsx - FULLY UPDATED WITH ANNOUNCEMENT SUPPORT

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff, MessageSquare, CheckCircle, AlertCircle, X, Clock, Megaphone } from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from '../config';
import notificationManager from '../utils/notifications';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const NotificationBell = () => {
  const [permission, setPermission] = useState('default');
  const [isSupported, setIsSupported] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [announcementCount, setAnnouncementCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const currentUserId = localStorage.getItem('userId');

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize notification permission
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

  // Socket listener for real-time announcement updates
  useEffect(() => {
    let socket = null;
    
    const setupSocket = async () => {
      try {
        const { io } = await import('socket.io-client');
        socket = io(API_BASE_URL, {
          transports: ['websocket'],
          auth: { token: localStorage.getItem('token') }
        });
        
        socket.on('new_announcement', (data) => {
          console.log('📢 New announcement received:', data);
          // Increment announcement count
          setAnnouncementCount(prev => prev + 1);
          // Show toast notification
          toast.success(`📢 ${data.title}`, {
            duration: 5000,
            icon: '📢'
          });
          // Refresh notifications if dropdown is open
          if (showDropdown) {
            fetchNotifications();
          }
          // Refresh count
          fetchNotificationCount();
        });
        
        socket.on('announcement_count_update', (data) => {
          console.log('📢 Announcement count update:', data);
          setAnnouncementCount(data.count || 0);
        });
        
        socket.on('connect', () => {
          console.log('🔔 NotificationBell socket connected');
        });
        
        socket.on('disconnect', () => {
          console.log('🔔 NotificationBell socket disconnected');
        });
      } catch (error) {
        console.error('Socket setup error:', error);
      }
    };
    
    setupSocket();
    
    return () => {
      if (socket) socket.disconnect();
    };
  }, [showDropdown]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate dropdown position
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

  // Fetch notification count from server
  const fetchNotificationCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // Fetch ticket notifications
      const res = await axios.get(`${API_BASE_URL}/api/notifications/count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotificationCount(res.data.unreadCount || 0);
      setOpenTicketCount(res.data.openTicketCount || 0);
      
      // Fetch unviewed announcements
      try {
        const annRes = await axios.get(`${API_BASE_URL}/api/announcements/unviewed/count`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAnnouncementCount(annRes.data.count || 0);
      } catch (annError) {
        console.error('Error fetching announcement count:', annError);
        setAnnouncementCount(0);
      }
      
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  };

  // Fetch all notifications (tickets + announcements)
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      
      const res = await axios.get(`${API_BASE_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let allNotifications = res.data.notifications || [];
      
      // Ensure announcement notifications have the proper flags
      allNotifications = allNotifications.map(notif => {
        if (notif.type === 'new_announcement' || notif.isAnnouncement) {
          return {
            ...notif,
            isAnnouncement: true,
            type: 'new_announcement'
          };
        }
        return notif;
      });
      
      // Set announcement count from the backend
      setAnnouncementCount(res.data.announcementCount || 0);
      
      setNotifications(allNotifications);
      
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle bell click
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

  // Handle notification click
  const handleNotificationClick = async (notification) => {
    console.log('🔔 Clicked notification:', notification);
    
    // ============================================
    // HANDLE ANNOUNCEMENT NOTIFICATIONS
    // ============================================
    if (notification.type === 'new_announcement' || notification.isAnnouncement) {
      const announcementId = notification.announcementId || notification._id?.replace('announcement_', '');
      
      if (!announcementId) {
        console.error('No announcement ID found:', notification);
        setShowDropdown(false);
        navigate('/announcements');
        return;
      }
      
      // Mark as viewed on server
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${API_BASE_URL}/api/announcements/${announcementId}/viewed`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Announcement marked as viewed');
      } catch (error) {
        console.error('Error marking announcement as viewed:', error);
      }
      
      // Remove from UI
      setNotifications(prev => prev.filter(n => {
        const nId = n._id || n.announcementId;
        return nId !== notification._id && nId !== `announcement_${announcementId}`;
      }));
      
      // Decrease announcement count
      setAnnouncementCount(prev => Math.max(0, prev - 1));
      setShowDropdown(false);
      
      // Navigate to announcements page
      navigate('/announcements');
      return;
    }
    
    // ============================================
    // HANDLE TICKET NOTIFICATIONS
    // ============================================
    
    // Get the notification ID
    let notifId = notification._id;
    if (notifId && typeof notifId === 'object' && notifId.$oid) {
      notifId = notifId.$oid;
    }
    const notifIdStr = String(notifId || '');
    console.log('📝 Notification ID:', notifIdStr);
    
    // Get ticket ID
    let ticketId = notification.ticketId;
    if (ticketId && typeof ticketId === 'object' && ticketId._id) {
      ticketId = ticketId._id;
    }
    if (ticketId && typeof ticketId === 'object' && ticketId.$oid) {
      ticketId = ticketId.$oid;
    }
    const ticketIdStr = String(ticketId || '');
    console.log('🎫 Ticket ID:', ticketIdStr);
    
    // IMMEDIATELY remove from UI
    setNotifications(prev => {
      const filtered = prev.filter(n => {
        let nId = n._id;
        if (nId && typeof nId === 'object' && nId.$oid) {
          nId = nId.$oid;
        }
        const nIdStr = String(nId || '');
        
        let nTicketId = n.ticketId;
        if (nTicketId && typeof nTicketId === 'object' && nTicketId._id) {
          nTicketId = nTicketId._id;
        }
        if (nTicketId && typeof nTicketId === 'object' && nTicketId.$oid) {
          nTicketId = nTicketId.$oid;
        }
        const nTicketIdStr = String(nTicketId || '');
        
        const isMatch = nIdStr === notifIdStr || nTicketIdStr === ticketIdStr;
        return !isMatch;
      });
      
      console.log('📊 Notifications after removal:', filtered.length);
      return filtered;
    });
    
    setNotificationCount(prev => Math.max(0, prev - 1));
    setShowDropdown(false);
    
    // Call the mark-as-read API
    try {
      const token = localStorage.getItem('token');
      
      if (notification.type === 'open_ticket') {
        console.log('📌 Marking open_ticket as read for ticket:', ticketIdStr);
        await axios.patch(`${API_BASE_URL}/api/notifications/${notifIdStr}/read`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Open ticket notification marked as read on server');
      } else {
        await axios.patch(`${API_BASE_URL}/api/notifications/${notifIdStr}/read`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Notification marked as read on server');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
    
    // Navigate to the ticket
    if (ticketIdStr) {
      console.log('🔀 Navigating to ticket:', ticketIdStr);
      navigate(`/tickets/${ticketIdStr}`);
    }
    
    // Refresh the count from server
    setTimeout(() => {
      fetchNotificationCount();
      if (showDropdown) {
        fetchNotifications();
      }
    }, 1000);
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Immediately clear all notifications from UI
      setNotifications([]);
      setNotificationCount(0);
      setAnnouncementCount(0);
      
      // Call API in background
      await axios.patch(`${API_BASE_URL}/api/notifications/mark-all-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Also mark all announcements as viewed
      try {
        // Fetch all unviewed announcements and mark them
        const annRes = await axios.get(`${API_BASE_URL}/api/announcements`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 50 }
        });
        
        if (annRes.data.success && annRes.data.announcements) {
          const unviewed = annRes.data.announcements.filter(
            a => !a.viewedBy || !a.viewedBy.includes(currentUserId)
          );
          
          for (const a of unviewed) {
            await axios.post(`${API_BASE_URL}/api/announcements/${a._id}/viewed`, {}, {
              headers: { Authorization: `Bearer ${token}` }
            });
          }
        }
      } catch (annError) {
        console.error('Error marking announcements as viewed:', annError);
      }
      
      toast.success('All notifications cleared');
      
      fetchNotificationCount();
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  };

  // Request notification permission
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

  // Get notification icon
  const getNotificationIcon = (type) => {
    switch(type) {
      case 'ticket_created': return '🎫';
      case 'ticket_assigned': return '📋';
      case 'ticket_commented': return '💬';
      case 'ticket_status_updated': return '🔄';
      case 'ticket_closed': return '✅';
      case 'open_ticket': return '📌';
      case 'new_announcement': return '📢';
      default: return '🔔';
    }
  };

  // Get status color
  const getStatusColor = () => {
    if (!isSupported) return 'bg-gray-100';
    if (permission === 'granted') return 'bg-green-100';
    if (permission === 'denied') return 'bg-red-100';
    return 'bg-yellow-100';
  };

  // Get time ago
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

  // Render dropdown
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
          {/* Header */}
          <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-800">Notifications</span>
              {notificationCount + announcementCount > 0 && (
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                  {notificationCount + announcementCount}
                </span>
              )}
            </div>
            {(notificationCount + announcementCount) > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear all
              </button>
            )}
          </div>
          
          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
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
              notifications.map((notification, index) => {
                const isRead = notification.read || false;
                
                // Handle announcement notifications
                if (notification.type === 'new_announcement' || notification.isAnnouncement) {
                  return (
                    <div
                      key={notification._id || index}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-all ${
                        !isRead ? 'bg-purple-50/50 border-l-4 border-l-purple-500' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 text-lg mt-0.5">
                          <Megaphone size={16} className="text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm ${!isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                              {notification.message || notification.title || 'New Announcement'}
                            </p>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                              {getTimeAgo(notification.createdAt)}
                            </span>
                          </div>
                          {notification.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {notification.description}
                            </p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-1">
                            {notification.createdByName || 'System'}
                          </p>
                        </div>
                        {!isRead && (
                          <div className="flex-shrink-0 w-2 h-2 mt-1.5 bg-purple-500 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  );
                }
                
                // Handle ticket notifications
                const ticketTitle = typeof notification.ticketId === 'object' 
                  ? notification.ticketId?.title || notification.message 
                  : notification.message;
                const lastComment = notification.lastComment || 
                  (notification.ticketId?.comments && notification.ticketId.comments.length > 0 
                    ? notification.ticketId.comments[notification.ticketId.comments.length - 1] 
                    : null);
                
                return (
                  <div
                    key={notification._id || index}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-all ${
                      !isRead ? 'bg-blue-50/50 border-l-4 border-l-blue-500' : ''
                    }`}
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
                );
              })
            )}
          </div>
          
          {/* Footer */}
          <div className="p-2 border-t border-gray-100 bg-gray-50 flex gap-1">
            <button
              onClick={() => {
                setShowDropdown(false);
                navigate('/tickets');
              }}
              className="flex-1 text-center text-xs font-medium text-blue-600 hover:text-blue-800 py-1"
            >
              View Tickets →
            </button>
            <button
              onClick={() => {
                setShowDropdown(false);
                navigate('/announcements');
              }}
              className="flex-1 text-center text-xs font-medium text-purple-600 hover:text-purple-800 py-1"
            >
              Announcements →
            </button>
          </div>
        </div>
      </>,
      document.body
    );
  };

  const totalCount = notificationCount + announcementCount;

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