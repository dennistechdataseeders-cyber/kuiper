import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Volume2, VolumeX, CheckCircle } from 'lucide-react';
import notificationManager from '../utils/notifications';
import toast from 'react-hot-toast';

const NotificationSettings = () => {
  const [permission, setPermission] = useState('default');
  const [settings, setSettings] = useState({
    newTickets: true,
    assignments: true,
    comments: true,
    statusUpdates: true,
    sound: true
  });

  useEffect(() => {
  setPermission(Notification.permission);
  try {
    const saved = localStorage.getItem('notificationSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        setSettings(parsed);
      }
    }
  } catch (e) {
    // If corrupted, use defaults
    localStorage.removeItem('notificationSettings');
  }
}, []);

  const saveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
    toast.success('Notification preferences saved');
  };

  const enableNotifications = async () => {
    const granted = await notificationManager.requestPermission();
    setPermission(granted ? 'granted' : 'denied');
    if (granted) {
      toast.success('Desktop notifications enabled!');
    }
  };

  const testNotification = () => {
    if (permission === 'granted') {
      notificationManager.show({
        title: 'Test Notification',
        body: 'Your notification settings are working!',
        silent: !settings.sound
      });
    }
  };

  return (
    <div className="page bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <h1 className="page-title">Notification Settings</h1>
          <p className="text-sm text-gray-600 mt-1">Configure how you receive alerts and updates</p>
        </div>

        {/* Permission Status */}
        <div className="card mb-4 sm:mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {permission === 'granted' ? (
                <Bell size={24} className="text-green-600 shrink-0" />
              ) : (
                <BellOff size={24} className="text-gray-400 shrink-0" />
              )}
              <div>
                <h3 className="font-semibold text-gray-900">Desktop Notifications</h3>
                <p className="text-sm text-gray-500">
                  {permission === 'granted' 
                    ? 'Notifications are enabled' 
                    : permission === 'denied'
                    ? 'Notifications are blocked by your browser'
                    : 'Click enable to receive desktop alerts'}
                </p>
              </div>
            </div>
            {permission !== 'granted' && (
              <button
                onClick={enableNotifications}
                className="btn btn-md bg-blue-600 text-white hover:bg-blue-700"
              >
                Enable Notifications
              </button>
            )}
          </div>
        </div>

        {/* Notification Types */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Notification Types</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 py-2">
              <div>
                <p className="font-medium text-gray-800">New Tickets</p>
                <p className="text-sm text-gray-500">When a new ticket is created</p>
              </div>
              <label className="relative inline-flex items-center shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.newTickets}
                  onChange={(e) => saveSettings({ ...settings, newTickets: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between gap-4 py-2">
              <div>
                <p className="font-medium text-gray-800">Ticket Assignments</p>
                <p className="text-sm text-gray-500">When a ticket is assigned to you</p>
              </div>
              <label className="relative inline-flex items-center shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.assignments}
                  onChange={(e) => saveSettings({ ...settings, assignments: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between gap-4 py-2">
              <div>
                <p className="font-medium text-gray-800">Comments</p>
                <p className="text-sm text-gray-500">When someone adds a comment to your ticket</p>
              </div>
              <label className="relative inline-flex items-center shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.comments}
                  onChange={(e) => saveSettings({ ...settings, comments: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between gap-4 py-2">
              <div>
                <p className="font-medium text-gray-800">Status Updates</p>
                <p className="text-sm text-gray-500">When ticket status changes</p>
              </div>
              <label className="relative inline-flex items-center shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.statusUpdates}
                  onChange={(e) => saveSettings({ ...settings, statusUpdates: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between gap-4 py-2 border-t border-gray-100 pt-4 mt-2">
              <div className="flex items-center gap-2">
                {settings.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
                <div>
                  <p className="font-medium text-gray-800">Sound Alerts</p>
                  <p className="text-sm text-gray-500">Play sound when notifications arrive</p>
                </div>
              </div>
              <label className="relative inline-flex items-center shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.sound}
                  onChange={(e) => saveSettings({ ...settings, sound: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Test Button */}
        <div className="mt-6">
          <button
            onClick={testNotification}
            disabled={permission !== 'granted'}
            className="btn btn-md w-full bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Send Test Notification
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;