// frontend/src/components/SalesNotifier.jsx
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import notificationManager from '../utils/notifications';
import API_BASE_URL from '../config';
import { useNavigate } from 'react-router-dom';

const SalesNotifier = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const userRole = localStorage.getItem('role');
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');

    if (userRole !== 'Sales' || !userId || !token) {
      return;
    }

    const socket = io(API_BASE_URL, {
      auth: { token },
    });

    socket.on('connect', () => {
      console.log('🔌 SalesNotifier socket connected');
      socket.emit('join-user-room', userId);
    });

    socket.on('sales:upcoming-activity', (data) => {
      console.log('📢 Received upcoming activity:', data);

      // 1. Show an in-app toast
      toast.success(data.message, {
        icon: '⏰',
        duration: 8000, // Keep it visible longer
        position: 'top-center',
      });

      // 2. Trigger the desktop notification
      const notification = notificationManager.notifyUpcomingActivity(data);
      if (notification) {
        notification.onclick = () => {
          window.focus();
          navigate('/sales/activities/meetings'); // Or navigate to a specific detail view
          notification.close();
        };
      }
    });
    
    // Optional: Also listen for "sales:daily-alert" if you want an in-app banner
    // socket.on('sales:daily-alert', (data) => { ... });

    return () => {
      socket.disconnect();
    };
  }, [navigate]);

  return null; // This component doesn't render anything
};

export default SalesNotifier;