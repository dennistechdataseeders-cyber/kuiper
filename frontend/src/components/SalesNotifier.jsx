// frontend/src/components/SalesNotifier.jsx
//
// Listens for meeting / call / task reminders pushed by the server and, for each one:
//   • shows a desktop notification (OS-level, works while the tab is in the background)
//   • speaks the reminder aloud
//   • shows an in-app toast
//   • asks the NotificationBell to refresh (the reminder is already stored in the bucket)
//
// Mounted once in App.jsx.
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import notificationManager from '../utils/notifications';
import API_BASE_URL from '../config';

// Roles that can create meetings / calls / tasks (see backend leadActivityRoutes).
const ACTIVITY_ROLES = ['Sales', 'Sales Manager', 'Admin', 'Super Admin', 'Project Manager'];
const SEEN_KEY = 'reminder_seen_ids';

// With several tabs open every tab gets the event; only the first one should speak.
const markSeen = (id) => {
  if (!id) return true;
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    if (seen.includes(id)) return false;
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id].slice(-50)));
  } catch {
    /* storage unavailable – fall through and notify */
  }
  return true;
};

const SalesNotifier = () => {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // Re-render on every route change so a login that happens inside the SPA
  // (localStorage is written, then we navigate) is picked up without a page refresh.
  useLocation();
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');
  const enabled = Boolean(token && userId && ACTIVITY_ROLES.includes(role));

  useEffect(() => {
    if (!enabled) return undefined;

    const socket = io(API_BASE_URL, { auth: { token } });

    const joinRoom = () => socket.emit('join-user-room', userId); // also runs on every reconnect
    socket.on('connect', joinRoom);

    socket.on('sales:upcoming-activity', (data) => {
      // Always refresh the bell – the reminder is already in the bucket.
      window.dispatchEvent(new CustomEvent('notifications:refresh'));

      if (!markSeen(data.notificationId)) return;

      toast(data.message, { icon: '⏰', duration: 10000, position: 'top-center' });

      notificationManager.notifyUpcomingActivity(data, () => {
        navigateRef.current(data.link || '/sales/activities/meetings');
      });
    });

    return () => {
      socket.off('connect', joinRoom);
      socket.disconnect();
    };
  }, [enabled, token, userId]);

  return null; // renders nothing
};

export default SalesNotifier;
