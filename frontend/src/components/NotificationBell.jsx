import React, { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle, AlertCircle } from 'lucide-react';
import notificationManager from '../utils/notifications';
import toast from 'react-hot-toast';

const NotificationBell = () => {
  const [permission, setPermission] = useState('default');
  const [isSupported, setIsSupported] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setIsSupported('Notification' in window);
    setPermission(Notification.permission);
    
    if (Notification.permission === 'granted') {
      notificationManager.permission = 'granted';
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.notification-dropdown')) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

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

  const getStatusIcon = () => {
    if (!isSupported) return <BellOff size={18} className="text-gray-400" />;
    if (permission === 'granted') return <Bell size={18} className="text-green-500" />;
    if (permission === 'denied') return <BellOff size={18} className="text-red-500" />;
    return <Bell size={18} className="text-yellow-500 animate-pulse" />;
  };

  const getStatusColor = () => {
    if (!isSupported) return 'bg-gray-100';
    if (permission === 'granted') return 'bg-green-100';
    if (permission === 'denied') return 'bg-red-100';
    return 'bg-yellow-100';
  };

  return (
      <div className="relative notification-dropdown overflow-visible">
          <button
        onClick={() => {
          if (permission !== 'granted') {
            requestNotificationPermission();
          } else {
            setShowDropdown(!showDropdown);
          }
        }}
        className={`relative p-1.5 rounded-lg transition-colors group ${getStatusColor()}`}
        title={permission === 'granted' ? 'Notifications Active' : 'Notifications Disabled'}
      >
        {getStatusIcon()}
        {permission !== 'granted' && permission !== 'denied' && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>

      {/* Dropdown - positioned to the right side */}
      {showDropdown && permission === 'granted' && (
        <div className="absolute left-full top-0 ml-3 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-600" />
              <span className="text-sm font-semibold text-gray-800">Notifications Active</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">You'll receive real-time updates</p>
          </div>
          
          <div className="p-3 space-y-2">
            <div className="text-xs text-gray-600">
              <div className="flex items-center justify-between py-1">
                <span>🔔 New Tickets</span>
                <span className="text-green-600">On</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>📋 Assignments</span>
                <span className="text-green-600">On</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>💬 Comments</span>
                <span className="text-green-600">On</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>🔊 Sound Alerts</span>
                <span className="text-green-600">On</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => {
              notificationManager.show({
                title: 'Test Notification',
                body: 'Your notifications are working!',
                icon: '/images/tab_logo.png', 
                silent: false
              });
              setShowDropdown(false);
            }}
            className="w-full p-2 text-center text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-100"
          >
            Send Test Notification
          </button>
        </div>
      )}

      {/* Denied state dropdown - positioned to the right side */}
      {showDropdown && permission === 'denied' && (
<div className="absolute left-full top-0 ml-3 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 z-[9999] overflow-hidden animate-in slide-in-from-left-2 duration-200">         <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-red-50 to-white">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600" />
              <span className="text-sm font-semibold text-gray-800">Notifications Blocked</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Please enable notifications in your browser</p>
          </div>
          
          <div className="p-3">
            <div className="bg-blue-50 rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold text-blue-800 mb-2">How to enable:</p>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>Click the <strong>lock icon</strong> 🔒 in the address bar</li>
                <li>Go to <strong>Site settings</strong></li>
                <li>Find <strong>Notifications</strong> and change to <strong>Allow</strong></li>
                <li>Refresh this page</li>
              </ol>
            </div>
            <button
              onClick={() => setShowDropdown(false)}
              className="w-full py-2 text-center text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors rounded-lg"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Default state dropdown - when permission not yet set */}
      {showDropdown && permission !== 'granted' && permission !== 'denied' && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Bell size={24} className="text-blue-500" />
              <div>
                <h4 className="font-semibold text-gray-800">Enable Notifications</h4>
                <p className="text-xs text-gray-500">Get real-time updates</p>
              </div>
            </div>
            <button
              onClick={requestNotificationPermission}
              className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Enable Notifications
            </button>
            <button
              onClick={() => setShowDropdown(false)}
              className="w-full mt-2 py-2 text-center text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors rounded-lg"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;