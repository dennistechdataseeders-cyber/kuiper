import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Plus, Ticket, Clock, CheckCircle, AlertCircle, Users, Lock, Globe, Tag, Filter, UserCheck, Search } from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import io from 'socket.io-client';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import notificationManager from '../utils/notifications';

const TicketDashboard = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');
  const currentUserId = localStorage.getItem('userId');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const canSeeInternal = ['Admin', 'Project Manager', 'Developer', 'Sales', 'Sales Manager', 'Team Lead'].includes(userRole);
  const isClient = userRole === 'Client';
  const isHR = userRole === 'HR';
  const isFinance = userRole === 'Finance';

  useEffect(() => {
    fetchTickets();
    
    notificationManager.initAudio();
    
    const socket = io(API_BASE_URL);
    socket.emit('join-user-room', currentUserId);
    
    socket.on('ticket_created', (newTicket) => {
      setTickets(prev => [newTicket, ...prev]);
      toast.success(`New ticket: ${newTicket.title}`);
      
      if (userRole === 'Project Manager' || userRole === 'Admin' || userRole === 'Team Lead') {
        notificationManager.notifyNewTicket(newTicket, () => {
          navigate(`/tickets/${newTicket._id}`);
        });
      } else if (newTicket.assignedTo?._id === currentUserId) {
        notificationManager.notifyTicketAssigned(newTicket, () => {
          navigate(`/tickets/${newTicket._id}`);
        });
      }
    });
    
    socket.on('ticket_updated', (updatedTicket) => {
      const oldTicket = tickets.find(t => t._id === updatedTicket._id);
      setTickets(prev => prev.map(t => 
        t._id === updatedTicket._id ? updatedTicket : t
      ));
      
      toast.info(`Ticket ${formatTicketNumber(updatedTicket.ticketNumber)} status updated to ${updatedTicket.status}`);
      
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
    
    socket.on('ticket_assigned', (assignedTicket) => {
      setTickets(prev => prev.map(t => 
        t._id === assignedTicket._id ? assignedTicket : t
      ));
      
      if (assignedTicket.assignedTo?._id === currentUserId) {
        toast.success(`Ticket assigned to you: ${assignedTicket.title}`);
        notificationManager.notifyTicketAssigned(assignedTicket, () => {
          navigate(`/tickets/${assignedTicket._id}`);
        });
      }
    });
    
    socket.on('ticket_commented', (updatedTicket) => {
      const lastComment = updatedTicket.comments?.[updatedTicket.comments.length - 1];
      
      if (lastComment && lastComment.userId !== currentUserId) {
        setTickets(prev => prev.map(t => 
          t._id === updatedTicket._id ? updatedTicket : t
        ));
        
        toast.success(`New comment from ${lastComment.userName} on ticket ${formatTicketNumber(updatedTicket.ticketNumber)}`);
        
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
  }, []);

  // Format ticket number to 4 digits (e.g., 1 -> 0001, 16 -> 0016)
  const formatTicketNumber = (number) => {
    if (!number) return '0000';
    const num = parseInt(number);
    if (isNaN(num)) return String(number);
    return String(num).padStart(4, '0');
  };

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

  const getTicketTypeColor = (type) => {
    const typeColors = {
      'Data Extraction': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      'Data Quality': 'bg-purple-100 text-purple-700 border-purple-200',
      'Delivery': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'Enhancement': 'bg-amber-100 text-amber-700 border-amber-200',
      'Finance': 'bg-green-100 text-green-700 border-green-200',
      'HR': 'bg-pink-100 text-pink-700 border-pink-200',
      'Payroll': 'bg-blue-100 text-blue-700 border-blue-200',
      'Sales': 'bg-orange-100 text-orange-700 border-orange-200',
      'Production': 'bg-red-100 text-red-700 border-red-200',
      'Admin': 'bg-gray-100 text-gray-700 border-gray-200',
      'IT': 'bg-cyan-100 text-cyan-700 border-cyan-200',
      'Development': 'bg-violet-100 text-violet-700 border-violet-200',
      'Feasibility': 'bg-indigo-100 text-indigo-700 border-indigo-200'
    };
    return typeColors[type] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  // ============================================
  // FILTER TICKETS WITH SEARCH
  // ============================================
  const filteredTickets = tickets.filter(t => {
    // Status filter
    if (filter !== 'all' && t.status !== filter) return false;
    
    // Type filter (internal/external)
    if (filterType === 'internal' && !t.isInternal) return false;
    if (filterType === 'external' && t.isInternal) return false;
    
    // For HR - ONLY show tickets assigned to this HR user
    if (isHR) {
      if (t.assignedTo?._id !== currentUserId && t.assignedTo !== currentUserId) return false;
    }
    
    // For Finance - ONLY show tickets assigned to this Finance user
    if (isFinance) {
      if (t.assignedTo?._id !== currentUserId && t.assignedTo !== currentUserId) return false;
    }
    
    // Search filter - search by ticket number, title, or assigned to name
    if (searchQuery.trim() !== '') {
      const query = searchQuery.trim().toLowerCase();
      
      // Search by ticket number (formatted as 4 digits)
      const formattedNumber = formatTicketNumber(t.ticketNumber);
      const ticketNumberMatch = formattedNumber.toLowerCase().includes(query) || 
                               String(t.ticketNumber).toLowerCase().includes(query) || false;
      
      // Search by ticket title
      const titleMatch = t.title?.toLowerCase().includes(query) || false;
      
      // Search by assigned to name
      const assignedToName = t.assignedTo?.name?.toLowerCase() || '';
      const assignedToMatch = assignedToName.includes(query) || false;
      
      // Search by created by name
      const createdByName = t.createdBy?.name?.toLowerCase() || '';
      const createdByMatch = createdByName.includes(query) || false;
      
      // Search by project custom ID or name
      const projectIdMatch = t.projectId?.projectCustomId?.toLowerCase().includes(query) || false;
      const projectNameMatch = t.projectId?.name?.toLowerCase().includes(query) || false;
      
      if (!ticketNumberMatch && !titleMatch && !assignedToMatch && !createdByMatch && !projectIdMatch && !projectNameMatch) {
        return false;
      }
    }
    
    return true;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'Open').length,
    inProgress: tickets.filter(t => t.status === 'In Progress').length,
    resolved: tickets.filter(t => t.status === 'Resolved').length,
    internal: tickets.filter(t => t.isInternal).length,
    external: tickets.filter(t => !t.isInternal).length,
    feasibility: tickets.filter(t => t.category === 'Production' && t.subcategory === 'Feasibility').length
  };

  // Stats for HR and Finance - only count assigned tickets
  const getAssignedStats = () => {
    const assignedTickets = tickets.filter(t => 
      t.assignedTo?._id === currentUserId || t.assignedTo === currentUserId
    );
    return {
      total: assignedTickets.length,
      open: assignedTickets.filter(t => t.status === 'Open').length,
      inProgress: assignedTickets.filter(t => t.status === 'In Progress').length,
      resolved: assignedTickets.filter(t => t.status === 'Resolved').length,
    };
  };

  const assignedStats = (isHR || isFinance) ? getAssignedStats() : stats;

  const getCategoryDisplay = (ticket) => {
    if (ticket.subItem) return ticket.subItem;
    if (ticket.subcategory) return ticket.subcategory;
    if (ticket.category) return ticket.category;
    return null;
  };

  const isFeasibilityTicket = (ticket) => {
    return ticket.category === 'Production' && ticket.subcategory === 'Feasibility';
  };

  // Clear search handler
  const clearSearch = () => {
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-gray-50 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 p-3 sm:p-6 transition-all duration-300 ${isCollapsed ? 'ml-10' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-4 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-sm text-gray-600 mt-1 hidden sm:block">
            {isHR ? 'HR & Admin Tickets' : 
             isFinance ? 'Finance & Payroll Tickets' : 
             'Track and manage all support requests'}
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
          {Notification.permission !== 'granted' && Notification.permission !== 'denied' && (
            <button
              onClick={() => notificationManager.requestPermission()}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all"
            >
              Enable Notifications
            </button>
          )}
          
          <button
            onClick={() => navigate('/tickets/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-200 flex items-center gap-2 flex-1 sm:flex-none justify-center"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">
              {userRole !== 'Client' && userRole !== 'HR' && userRole !== 'Finance' ? 'New Internal Ticket' : 'New Ticket'}
            </span>
            <span className="sm:hidden">New Ticket</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - Responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-8">
        <div className="bg-white rounded-lg p-3 sm:p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-sm text-gray-600">Total</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">
                {isHR || isFinance ? assignedStats.total : stats.total}
              </p>
            </div>
            <Ticket size={isMobile ? 20 : 32} className="text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-3 sm:p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-sm text-gray-600">Open</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-600">
                {isHR || isFinance ? assignedStats.open : stats.open}
              </p>
            </div>
            <AlertCircle size={isMobile ? 20 : 32} className="text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-3 sm:p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-sm text-gray-600">In Prog</p>
              <p className="text-lg sm:text-2xl font-bold text-yellow-600">
                {isHR || isFinance ? assignedStats.inProgress : stats.inProgress}
              </p>
            </div>
            <Clock size={isMobile ? 20 : 32} className="text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-3 sm:p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-sm text-gray-600">Resolved</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600">
                {isHR || isFinance ? assignedStats.resolved : stats.resolved}
              </p>
            </div>
            <CheckCircle size={isMobile ? 20 : 32} className="text-green-500" />
          </div>
        </div>

        {/* HR Specific Stats Card */}
        {isHR && (
          <div className="bg-white rounded-lg p-3 sm:p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-gray-600">HR</p>
                <p className="text-lg sm:text-2xl font-bold text-pink-600">
                  {tickets.filter(t => 
                    (t.assignedTo?._id === currentUserId || t.assignedTo === currentUserId) &&
                    (['HR', 'Admin', 'Payroll'].includes(t.category) ||
                    ['Employee Documents', 'Attendance & Leave', 'Employee Management'].includes(t.subcategory))
                  ).length}
                </p>
              </div>
              <Users size={isMobile ? 20 : 32} className="text-pink-500" />
            </div>
          </div>
        )}

        {/* Finance Specific Stats Card */}
        {isFinance && (
          <div className="bg-white rounded-lg p-3 sm:p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-gray-600">Finance</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600">
                  {tickets.filter(t => 
                    (t.assignedTo?._id === currentUserId || t.assignedTo === currentUserId) &&
                    (['Finance', 'Payroll', 'Admin'].includes(t.category) ||
                    ['Reimbursement', 'Payment Requests', 'Invoice Management', 'Salary', 'Tax & Deductions'].includes(t.subcategory))
                  ).length}
                </p>
              </div>
              <Clock size={isMobile ? 20 : 32} className="text-green-500" />
            </div>
          </div>
        )}

        {/* Internal Tickets Stats */}
        {canSeeInternal && !isHR && !isFinance && (
          <div className="bg-white rounded-lg p-3 sm:p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-gray-600">Internal</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600">{stats.internal}</p>
              </div>
              <Lock size={isMobile ? 20 : 32} className="text-purple-500" />
            </div>
          </div>
        )}
      </div>

      {/* Search Bar & Filters */}
      <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200 mb-4 sm:mb-6">
        {/* Search Bar */}
        <div className="mb-3 sm:mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={isMobile ? 16 : 18} className="text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isMobile ? "Search tickets..." : "Search by Ticket Number (e.g., 0016), Title, Name, or Project..."}
              className="w-full pl-9 sm:pl-10 pr-10 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm bg-gray-50 hover:bg-white"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <span className="text-xs sm:text-sm font-medium">Clear</span>
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="mt-1 text-xs text-gray-500 flex items-center gap-1 sm:gap-2 flex-wrap">
              <span className="font-medium">Searching:</span>
              <span className="bg-blue-50 text-blue-700 px-1.5 sm:px-2 py-0.5 rounded-md font-medium text-[10px] sm:text-xs">
                "{searchQuery}"
              </span>
              <span className="text-gray-400 text-[10px] sm:text-xs">
                ({filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''})
              </span>
            </div>
          )}
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
            <span className="text-[10px] sm:text-xs text-gray-500 mr-0.5 sm:mr-1 font-medium hidden sm:inline">Status:</span>
            {['all', 'Open', 'In Progress', 'Resolved', 'Closed'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status === 'all' ? 'all' : status)}
                className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                  filter === (status === 'all' ? 'all' : status)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>

          {canSeeInternal && !isHR && !isFinance && (
            <>
              <div className="w-px h-6 sm:h-8 bg-gray-300 mx-1 sm:mx-2 hidden sm:block"></div>
              <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
                <span className="text-[10px] sm:text-xs text-gray-500 mr-0.5 sm:mr-1 font-medium hidden sm:inline">Type:</span>
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-xs font-medium transition-all flex items-center gap-0.5 sm:gap-1 ${
                    filterType === 'all'
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Filter size={isMobile ? 10 : 12} />
                  <span className="hidden sm:inline">All</span>
                </button>
                <button
                  onClick={() => setFilterType('external')}
                  className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-xs font-medium transition-all flex items-center gap-0.5 sm:gap-1 ${
                    filterType === 'external'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Globe size={isMobile ? 10 : 12} />
                  <span className="hidden sm:inline">External</span>
                </button>
                <button
                  onClick={() => setFilterType('internal')}
                  className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-xs font-medium transition-all flex items-center gap-0.5 sm:gap-1 ${
                    filterType === 'internal'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Lock size={isMobile ? 10 : 12} />
                  <span className="hidden sm:inline">Internal</span>
                </button>
              </div>
            </>
          )}

          {(filter !== 'all' || filterType !== 'all' || searchQuery) && (
            <>
              <div className="w-px h-6 sm:h-8 bg-gray-300 mx-1 sm:mx-2 hidden sm:block"></div>
              <button
                onClick={() => {
                  setFilter('all');
                  setFilterType('all');
                  setSearchQuery('');
                }}
                className="px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-all whitespace-nowrap"
              >
                Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tickets Table - Responsive */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {isMobile ? (
            // Mobile Card View
            <div className="divide-y divide-gray-200">
              {filteredTickets.length === 0 ? (
                <div className="p-8 text-center">
                  <Ticket size={40} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No tickets found</p>
                  <p className="text-xs text-gray-400 mt-1">Create a new ticket to get started</p>
                </div>
              ) : (
                filteredTickets.map(ticket => {
                  const formattedNumber = formatTicketNumber(ticket.ticketNumber);
                  const isFeasibility = isFeasibilityTicket(ticket);
                  
                  return (
                    <div 
                      key={ticket._id} 
                      className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/tickets/${ticket._id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-medium text-gray-900">
                              {formattedNumber}
                            </span>
                            {ticket.isInternal && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[8px] font-bold">
                                <Lock size={8} />
                                Internal
                              </span>
                            )}
                            {isFeasibility && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[8px] font-bold">
                                <UserCheck size={8} />
                                Feasibility
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-1">{ticket.title}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={`inline-flex px-1.5 py-0.5 text-[8px] font-semibold rounded ${getStatusColor(ticket.status)}`}>
                              {ticket.status}
                            </span>
                            <span className={`inline-flex px-1.5 py-0.5 text-[8px] font-semibold rounded ${getPriorityColor(ticket.priority)}`}>
                              {ticket.priority}
                            </span>
                            <span className="text-[9px] text-gray-500 truncate max-w-[100px]">
                              {ticket.projectId?.projectCustomId || 'General'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 text-[9px] text-gray-400">
                            <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                            {ticket.assignedTo && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <Users size={10} />
                                  {ticket.assignedTo.name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/tickets/${ticket._id}`);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium whitespace-nowrap ml-2"
                        >
                          View →
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            // Desktop Table View
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title / Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Ticket size={48} className="text-gray-300" />
                        <p className="font-medium">No tickets found</p>
                        <p className="text-sm text-gray-400">
                          {searchQuery ? (
                            <>No tickets match your search: "<span className="font-medium">{searchQuery}</span>"</>
                          ) : isHR ? (
                            'No HR tickets assigned to you'
                          ) : isFinance ? (
                            'No Finance tickets assigned to you'
                          ) : (
                            'Create a new ticket to get started'
                          )}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map(ticket => {
                    const categoryDisplay = getCategoryDisplay(ticket);
                    const isFeasibility = isFeasibilityTicket(ticket);
                    const formattedNumber = formatTicketNumber(ticket.ticketNumber);
                    
                    return (
                      <tr key={ticket._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium text-gray-900">
                              {formattedNumber}
                            </span>
                            {ticket.isInternal && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-md text-[9px] font-bold">
                                <Lock size={10} />
                                Internal
                              </span>
                            )}
                            {isFeasibility && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[9px] font-bold">
                                <UserCheck size={10} />
                                Feasibility
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{ticket.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <p className="text-sm text-gray-500">
                                {ticket.projectId?.name || (ticket.isInternal ? 'Internal Task' : 'No Project')}
                              </p>
                              {categoryDisplay && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold border ${getTicketTypeColor(ticket.category)}`}>
                                  <Tag size={10} />
                                  {categoryDisplay}
                                </span>
                              )}
                              {ticket.ticketType && !categoryDisplay && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold border ${getTicketTypeColor(ticket.ticketType)}`}>
                                  <Tag size={10} />
                                  {ticket.ticketType}
                                </span>
                              )}
                            </div>
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
                              <span className="text-sm text-gray-700">
                                {ticket.assignedTo.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {ticket.projectId?.projectCustomId || 'General'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => navigate(`/tickets/${ticket._id}`)}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                          >
                            View Details →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDashboard;