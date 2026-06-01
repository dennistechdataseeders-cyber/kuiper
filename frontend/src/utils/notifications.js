// Frontend notification manager
// Location: frontend/src/utils/notifications.js

class NotificationManager {
  constructor() {
    this.permission = null;
    this.isSupported = 'Notification' in window;
    this.audioContext = null;
    // Use absolute path for custom icon - make sure this file exists
    this.customIcon = `${window.location.origin}/images/login_img.png`;
  }

  // Request permission from user
  async requestPermission() {
    if (!this.isSupported) {
      console.warn('Desktop notifications not supported');
      toast.error('Your browser does not support desktop notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      toast.success('Notifications are already enabled!');
      return true;
    }

    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        this.permission = permission;
        
        if (permission === 'granted') {
          toast.success('Desktop notifications enabled!');
          // Send a test notification
          this.show({
            title: '🔔 Notifications Enabled',
            body: 'You will now receive real-time updates',
            icon: this.customIcon,
            silent: false
          });
          return true;
        } else {
          toast.error('Notification permission denied');
          return false;
        }
      } catch (error) {
        console.error('Error requesting permission:', error);
        toast.error('Could not request notification permission');
        return false;
      }
    }

    toast.error('Notifications are blocked. Please check your browser settings.');
    return false;
  }

  // Check if we can send notifications
  canNotify() {
    const can = this.isSupported && Notification.permission === 'granted';
    if (!can) {
      console.log('Cannot send notification - permission:', Notification.permission);
    }
    return can;
  }

  // Play notification sound
  playSound(type = 'default') {
    try {
      let frequency = 440;
      let duration = 200;
      
      switch(type) {
        case 'urgent':
          frequency = 880;
          duration = 300;
          break;
        case 'success':
          frequency = 523.25;
          duration = 200;
          break;
        case 'ticket':
          frequency = 659.25;
          duration = 250;
          break;
        default:
          frequency = 440;
          duration = 150;
      }
      
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Resume audio context if suspended (browser policy)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gainNode.gain.value = 0.2;
      
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, this.audioContext.currentTime + 0.5);
      }, duration);
      
    } catch(e) {
      console.log('Audio not supported:', e);
    }
  }

  // Show notification with custom icon
  show(options) {
    if (!this.canNotify()) {
      console.log('Cannot show notification - permission not granted');
      return null;
    }

    const {
      title,
      body,
      icon = this.customIcon,
      tag = null,
      requireInteraction = false,
      silent = false,
      data = null,
      onClick = null
    } = options;

    try {
      const notificationOptions = {
        body: body,
        icon: icon,
        silent: silent,
        requireInteraction: requireInteraction,
        badge: this.customIcon,
        timestamp: Date.now()
      };

      if (tag) notificationOptions.tag = tag;
      if (data) notificationOptions.data = data;

      const notification = new Notification(title, notificationOptions);
      console.log('✅ Notification sent:', title);

      // Handle click
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        if (onClick) onClick(notification.data);
        notification.close();
      };

      // Auto-close after 5 seconds for non-urgent
      if (!requireInteraction) {
        setTimeout(() => notification.close(), 5000);
      }

      // Play sound for important notifications
      if (!silent) {
        const priority = options.priority || 'default';
        this.playSound(priority);
      }

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }

  // Specific notification types
  notifyNewTicket(ticket, onClick) {
    console.log('notifyNewTicket called for ticket:', ticket.title);
    return this.show({
      title: '🎫 New Support Ticket',
      body: `${ticket.title.substring(0, 60)} - Priority: ${ticket.priority}`,
      tag: `ticket-${ticket._id}`,
      priority: ticket.priority === 'Urgent' ? 'urgent' : 'ticket',
      data: { ticketId: ticket._id, type: 'ticket', url: `/tickets/${ticket._id}` },
      onClick
    });
  }

  notifyTicketAssigned(ticket, onClick) {
    const isUrgent = ticket.priority === 'Urgent';
    return this.show({
      title: '📋 Ticket Assigned to You',
      body: `${ticket.title.substring(0, 60)} - Priority: ${ticket.priority}`,
      tag: `assigned-${ticket._id}`,
      priority: isUrgent ? 'urgent' : 'default',
      data: { ticketId: ticket._id, type: 'ticket', url: `/tickets/${ticket._id}` },
      requireInteraction: isUrgent,
      onClick
    });
  }

  notifyStatusUpdate(ticket, oldStatus, newStatus, onClick) {
    return this.show({
      title: `🔄 Ticket Status Updated`,
      body: `"${ticket.title.substring(0, 50)}" changed from ${oldStatus} to ${newStatus}`,
      tag: `status-${ticket._id}`,
      data: { ticketId: ticket._id, type: 'ticket', url: `/tickets/${ticket._id}` },
      onClick
    });
  }

  notifyNewComment(ticket, commentAuthor, onClick) {
    console.log('notifyNewComment called for ticket:', ticket.title, 'by:', commentAuthor);
    return this.show({
      title: '💬 New Comment',
      body: `${commentAuthor} commented on "${ticket.title.substring(0, 50)}"`,
      tag: `comment-${ticket._id}`,
      data: { ticketId: ticket._id, type: 'ticket', url: `/tickets/${ticket._id}` },
      onClick
    });
  }

  notifyNewTask(task, onClick) {
    return this.show({
      title: '📝 New Task Assigned',
      body: `${task.details?.substring(0, 80)}...`,
      tag: `task-${task._id}`,
      data: { taskId: task._id, type: 'task' },
      onClick
    });
  }

  // Reset audio context on user interaction
  initAudio() {
    if (!this.audioContext && window.AudioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}

// Create singleton instance
const notificationManager = new NotificationManager();

// Initialize audio on first user interaction
const initAudioOnInteraction = () => {
  notificationManager.initAudio();
  document.removeEventListener('click', initAudioOnInteraction);
  document.removeEventListener('keydown', initAudioOnInteraction);
};

document.addEventListener('click', initAudioOnInteraction);
document.addEventListener('keydown', initAudioOnInteraction);

export default notificationManager;