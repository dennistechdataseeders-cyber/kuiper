import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Plus, Ticket, Clock, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import io from 'socket.io-client';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import notificationManager from '../utils/notifications';

const TicketDashboard = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');
  const currentUserId = localStorage.getItem('userId');

  useEffect(() => {
    fetchTickets();
    
    // Initialize notification manager on mount
    notificationManager.initAudio();
    
    // Socket connection for real-time updates
    const socket = io(API_BASE_URL);
    
    // Join user's personal room
    socket.emit('join-user-room', currentUserId);
    
    // Listen for new tickets
    socket.on('ticket_created', (newTicket) => {
      setTickets(prev => [newTicket, ...prev]);
      toast.success(`New ticket: ${newTicket.title}`);
      
      // Desktop notification for PMs, Admins, and if assigned to current user
      if (userRole === 'Project Manager' || userRole === 'Admin') {
        notificationManager.notifyNewTicket(newTicket, () => {
          navigate(`/tickets/${newTicket._id}`);
        });
      } else if (newTicket.assignedTo?._id === currentUserId) {
        notificationManager.notifyTicketAssigned(newTicket, () => {
          navigate(`/tickets/${newTicket._id}`);
        });
      }
    });
    
    // Listen for ticket updates
    socket.on('ticket_updated', (updatedTicket) => {
      const oldTicket = tickets.find(t => t._id === updatedTicket._id);
      setTickets(prev => prev.map(t => 
        t._id === updatedTicket._id ? updatedTicket : t
      ));
      
      toast.info(`Ticket ${updatedTicket.ticketNumber} status updated to ${updatedTicket.status}`);
      
      // Desktop notification for status change (notify creator and assignee)
      if (oldTicket && oldTicket.status !== updatedTicket.status) {
        const shouldNotify = 
          updatedTicket.createdBy?._id === currentUserId ||
          updatedTicket.assignedTo?._id === currentUserId;
        
        if (shouldNotify) {
          notificationManager.notifyStatusUpdate(updatedTicket, oldTicket.status, updatedTicket.status, () => {
            navigate(`/tickets/${updatedTicket._id}`);
          });
        }
      }
    });
    
    // Listen for ticket assignments
    socket.on('ticket_assigned', (assignedTicket) => {
      setTickets(prev => prev.map(t => 
        t._id === assignedTicket._id ? assignedTicket : t
      ));
      
      // Desktop notification if assigned to current user
      if (assignedTicket.assignedTo?._id === currentUserId) {
        toast.success(`Ticket assigned to you: ${assignedTicket.title}`);
        notificationManager.notifyTicketAssigned(assignedTicket, () => {
          navigate(`/tickets/${assignedTicket._id}`);
        });
      }
    });
    
    // Listen for new comments
   // In the socket.on('ticket_commented', ...) section, add:

socket.on('ticket_commented', (updatedTicket) => {
  // Find the new comment
  const lastComment = updatedTicket.comments?.[updatedTicket.comments.length - 1];
  
  if (lastComment && lastComment.userId !== currentUserId) {
    setTickets(prev => prev.map(t => 
      t._id === updatedTicket._id ? updatedTicket : t
    ));
    
    toast.success(`New comment from ${lastComment.userName} on ticket ${updatedTicket.ticketNumber}`);
    
    // Desktop notification for creator and assignee
    const shouldNotify = 
      updatedTicket.createdBy?._id === currentUserId ||
      updatedTicket.assignedTo?._id === currentUserId;
    
    if (shouldNotify) {
      notificationManager.notifyNewComment(updatedTicket, lastComment.userName, () => {
        navigate(`/tickets/${updatedTicket._id}`);
      });
    }
  }
});
    
    return () => {
      socket.disconnect();
    };
  }, []); // Empty dependency array - run once on mount

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(res.data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Open': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'In Progress': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Resolved': return 'bg-green-100 text-green-700 border-green-200';
      case 'Closed': return 'bg-gray-100 text-gray-700 border-gray-200';
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

  const filteredTickets = filter === 'all' 
    ? tickets 
    : tickets.filter(t => t.status === filter);

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'Open').length,
    inProgress: tickets.filter(t => t.status === 'In Progress').length,
    resolved: tickets.filter(t => t.status === 'Resolved').length
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-gray-50 flex items-center justify-center ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-gray-600 mt-1">Track and manage all support requests</p>
        </div>
        <div className="flex gap-3">
          {/* Optional: Add a "Request Permission" button for first-time users */}
          {Notification.permission !== 'granted' && Notification.permission !== 'denied' && (
            <button
              onClick={() => notificationManager.requestPermission()}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              Enable Notifications
            </button>
          )}
          {userRole === 'Client' && (
            <button
              onClick={() => navigate('/tickets/create')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all"
            >
              <Plus size={20} />
              New Ticket
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Tickets</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Ticket size={32} className="text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Open</p>
              <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
            </div>
            <AlertCircle size={32} className="text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
            </div>
            <Clock size={32} className="text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Resolved</p>
              <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
            </div>
            <CheckCircle size={32} className="text-green-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 mb-6">
        <div className="flex gap-2 flex-wrap">
          {['all', 'Open', 'In Progress', 'Resolved', 'Closed'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status === 'all' ? 'all' : status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === (status === 'all' ? 'all' : status)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All Tickets' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No tickets found
                  </td>
                </tr>
              ) : (
                filteredTickets.map(ticket => (
                  <tr key={ticket._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {ticket.ticketNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{ticket.title}</p>
                        <p className="text-sm text-gray-500">{ticket.projectId?.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md border ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {ticket.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-gray-400" />
                          <span className="text-sm text-gray-700">{ticket.assignedTo.name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => navigate(`/tickets/${ticket._id}`)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        View Details →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TicketDashboard;