// frontend/src/pages/TicketDashboard.jsx - WITH WATCHING FILTER

import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Plus, Ticket, Clock, CheckCircle, AlertCircle, Users, Lock, Globe, Tag, Filter, UserCheck, Search, GitFork, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import io from 'socket.io-client';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import notificationManager from '../utils/notifications';
import { PM_ROLES, isPMRole } from '../utils/roles';
import useIsMobile from '../utils/useIsMobile';
import { Badge, Button, Card, PageHeader, ResponsiveTable, StatCard } from '../components/ui';

const PAGE_SIZE = 25;
const EMPTY_STATS = {
  total: 0, open: 0, inProgress: 0, resolved: 0, internal: 0, external: 0, feasibility: 0, watching: 0,
  assigned: { total: 0, open: 0, inProgress: 0, resolved: 0 }, hrAssigned: 0, financeAssigned: 0,
};

const TicketDashboard = () => {
  // Server-side pages: `tickets` is the current page only; filters/search run in Mongo
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [serverStats, setServerStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const requestSeq = useRef(0);
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');
  const currentUserId = localStorage.getItem('userId');
  const isMobile = useIsMobile();

  const canSeeInternal = ['Admin', ...PM_ROLES, 'Developer', 'Sales', 'Sales Manager', 'Team Lead'].includes(userRole);
  const isClient = userRole === 'Client';
  const isHR = userRole === 'HR';
  const isFinance = userRole === 'Finance';

  useEffect(() => {
    notificationManager.initAudio();
    
    const socket = io(API_BASE_URL);
    socket.emit('join-user-room', currentUserId);
    
    socket.on('ticket_created', (newTicket) => {
      setTickets(prev => [newTicket, ...prev]);
      setTotal(prev => prev + 1);
      fetchStats();
      toast.success(`New ticket: ${newTicket.title}`);
      
      if (isPMRole(userRole) || userRole === 'Admin' || userRole === 'Team Lead') {
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
      fetchStats();

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

  // HR and Finance only ever see the tickets assigned to them in this list
  const onlyAssignedToMe = isHR || isFinance;

  const fetchTickets = useCallback(async (pageToLoad) => {
    const seq = ++requestSeq.current; // ignore answers to older requests
    setListLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          page: pageToLoad,
          limit: PAGE_SIZE,
          status: filter,
          type: filterType,
          q: debouncedSearch || undefined,
          assignedToMe: onlyAssignedToMe ? 1 : undefined,
        },
      });
      if (seq !== requestSeq.current) return;
      setTickets(res.data.items);
      setTotal(res.data.total);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      if (seq === requestSeq.current) {
        setListLoading(false);
        setLoading(false);
      }
    }
  }, [filter, filterType, debouncedSearch, onlyAssignedToMe]);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tickets/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServerStats(res.data);
    } catch (error) {
      console.error('Error fetching ticket stats:', error);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Search is sent to the server 300 ms after the user stops typing
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // New filter / search -> back to page 1
  useEffect(() => { setPage(1); }, [filter, filterType, debouncedSearch]);

  useEffect(() => { fetchTickets(page); }, [fetchTickets, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
  // Filters, search (ticket number, title, assignee / creator, project, feed) and the
  // Watching filter run on the server; this is the current page of results.
  // ============================================
  const filteredTickets = tickets;

  // Card counts come from GET /api/tickets/stats (same visibility rules as the list)
  const stats = serverStats;
  // HR and Finance cards only count tickets assigned to them
  const assignedStats = (isHR || isFinance) ? serverStats.assigned : stats;

  const getCategoryDisplay = (ticket) => {
    if (ticket.subItem) return ticket.subItem;
    if (ticket.subcategory) return ticket.subcategory;
    if (ticket.category) return ticket.category;
    return null;
  };

  const isFeasibilityTicket = (ticket) => {
    return ticket.category === 'Production' && ticket.subcategory === 'Feasibility';
  };

  // Get display name for project/feed column
  const getProjectFeedDisplay = (ticket) => {
    // If it's a Production ticket with a feed, show feed name
    if (ticket.category === 'Production' && ticket.feedId) {
      return {
        type: 'feed',
        name: ticket.feedId.name || 'Unknown Feed',
        icon: <GitFork size={14} className="text-blue-500" />
      };
    }
    // Otherwise show project
    if (ticket.projectId) {
      return {
        type: 'project',
        name: ticket.projectId.projectCustomId || ticket.projectId.name || 'Unknown Project',
        icon: <Tag size={14} className="text-gray-400" />
      };
    }
    return {
      type: 'none',
      name: ticket.isInternal ? 'Internal Task' : 'General',
      icon: null
    };
  };

  // Clear search handler
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Get filter options - includes 'Watching' for non-client, non-HR, non-Finance users
  const getFilterOptions = () => {
    const baseOptions = ['all', 'Open', 'In Progress', 'Resolved', 'Closed'];
    // Add 'Watching' for users who can have watchers (not Client, HR, Finance)
    if (!isClient && !isHR && !isFinance) {
      return [...baseOptions, 'Watching'];
    }
    return baseOptions;
  };

  const filterOptions = getFilterOptions();

  if (loading) {
    return (
      <div className="page bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading tickets...</p>
        </div>
      </div>
    );
  }

  // Filter buttons share one look; only the colours differ
  const filterButtonClass = (active, activeColors) =>
    active ? activeColors : 'bg-gray-100 text-gray-700 hover:bg-gray-200';

  const emptyHint = searchQuery ? (
    <>No tickets match your search: "<span className="font-medium">{searchQuery}</span>"</>
  ) : isHR ? (
    'No HR tickets assigned to you'
  ) : isFinance ? (
    'No Finance tickets assigned to you'
  ) : (
    'Create a new ticket to get started'
  );

  return (
    <div className="page bg-gray-50">
      <div className="stack">
        {/* Header */}
        <PageHeader
          title="Support Tickets"
          subtitle={isHR ? 'HR & Admin Tickets' :
                    isFinance ? 'Finance & Payroll Tickets' :
                    'Track and manage all support requests'}
          actions={
            <>
              {Notification.permission !== 'granted' && Notification.permission !== 'denied' && (
                <Button
                  variant="plain"
                  onClick={() => notificationManager.requestPermission()}
                  className="flex-1 lg:flex-none bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Enable Notifications
                </Button>
              )}

              <Button
                onClick={() => navigate('/tickets/create')}
                className="flex-1 lg:flex-none shadow-lg shadow-blue-200"
              >
                <Plus size={18} />
                {userRole !== 'Client' && userRole !== 'HR' && userRole !== 'Finance' ? 'New Internal Ticket' : 'New Ticket'}
              </Button>
            </>
          }
        />

        {/* Stats Cards - Responsive grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <StatCard
            label="Total"
            value={isHR || isFinance ? assignedStats.total : stats.total}
            icon={<Ticket size={28} className="text-blue-500" />}
          />
          <StatCard
            label="Open"
            value={isHR || isFinance ? assignedStats.open : stats.open}
            valueClass="text-blue-600"
            icon={<AlertCircle size={28} className="text-blue-500" />}
          />
          <StatCard
            label="In Progress"
            value={isHR || isFinance ? assignedStats.inProgress : stats.inProgress}
            valueClass="text-yellow-600"
            icon={<Clock size={28} className="text-yellow-500" />}
          />
          <StatCard
            label="Resolved"
            value={isHR || isFinance ? assignedStats.resolved : stats.resolved}
            valueClass="text-green-600"
            icon={<CheckCircle size={28} className="text-green-500" />}
          />

          {/* Watching Stats Card */}
          {!isClient && !isHR && !isFinance && (
            <StatCard label="Watching" value={stats.watching} valueClass="text-purple-600" icon={<Eye size={28} className="text-purple-500" />} />
          )}

          {/* HR Specific Stats Card */}
          {isHR && (
            <StatCard label="HR" value={serverStats.hrAssigned} valueClass="text-pink-600" icon={<Users size={28} className="text-pink-500" />} />
          )}

          {/* Finance Specific Stats Card */}
          {isFinance && (
            <StatCard label="Finance" value={serverStats.financeAssigned} valueClass="text-green-600" icon={<Clock size={28} className="text-green-500" />} />
          )}

          {/* Internal Tickets Stats */}
          {canSeeInternal && !isHR && !isFinance && (
            <StatCard label="Internal" value={stats.internal} valueClass="text-purple-600" icon={<Lock size={28} className="text-purple-500" />} />
          )}
        </div>

        {/* Search Bar & Filters */}
        <Card>
          {/* Search Bar */}
          <div className="mb-3 sm:mb-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isMobile ? "Search tickets..." : "Search by Ticket Number (e.g., 0016), Title, Name, Project, or Feed..."}
                className="input pl-10 pr-16 bg-gray-50 hover:bg-white"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <span className="text-sm font-medium">Clear</span>
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="meta mt-2 flex items-center gap-2 flex-wrap">
                <span className="font-medium">Searching:</span>
                <Badge className="bg-blue-50 text-blue-700">"{searchQuery}"</Badge>
                <span>
                  ({total} ticket{total !== 1 ? 's' : ''})
                </span>
              </div>
            )}
          </div>

          {/* Filter Buttons - includes Watching */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="label">Status:</span>
              {filterOptions.map(status => (
                <Button
                  key={status}
                  variant="plain"
                  size="sm"
                  onClick={() => setFilter(status === 'all' ? 'all' : status)}
                  className={filterButtonClass(
                    filter === (status === 'all' ? 'all' : status),
                    status === 'Watching' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                  )}
                >
                  {status === 'Watching' && <Eye size={14} />}
                  {status === 'all' ? 'All' : status}
                </Button>
              ))}
            </div>

            {canSeeInternal && !isHR && !isFinance && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="label">Type:</span>
                <Button
                  variant="plain"
                  size="sm"
                  onClick={() => setFilterType('all')}
                  className={filterButtonClass(filterType === 'all', 'bg-gray-800 text-white')}
                >
                  <Filter size={14} /> All
                </Button>
                <Button
                  variant="plain"
                  size="sm"
                  onClick={() => setFilterType('external')}
                  className={filterButtonClass(filterType === 'external', 'bg-green-600 text-white')}
                >
                  <Globe size={14} /> External
                </Button>
                <Button
                  variant="plain"
                  size="sm"
                  onClick={() => setFilterType('internal')}
                  className={filterButtonClass(filterType === 'internal', 'bg-purple-600 text-white')}
                >
                  <Lock size={14} /> Internal
                </Button>
              </div>
            )}

            {(filter !== 'all' || filterType !== 'all' || searchQuery) && (
              <Button
                variant="plain"
                size="sm"
                onClick={() => {
                  setFilter('all');
                  setFilterType('all');
                  setSearchQuery('');
                }}
                className="bg-red-50 text-red-600 hover:bg-red-100"
              >
                Clear All
              </Button>
            )}
          </div>
        </Card>

        {/* Tickets: cards on mobile, table from md up */}
        <div className={`card !p-0 overflow-hidden transition-opacity ${listLoading ? 'opacity-60' : ''}`}>
          {filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <Ticket size={48} className="text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No tickets found</p>
              <p className="text-sm text-gray-400 break-words max-w-full">{emptyHint}</p>
            </div>
          ) : isMobile ? (
            // Mobile Card View
            <div className="divide-y divide-gray-200">
              {filteredTickets.map(ticket => {
                const categoryDisplay = getCategoryDisplay(ticket);
                const formattedNumber = formatTicketNumber(ticket.ticketNumber);
                const isFeasibility = isFeasibilityTicket(ticket);
                const projectFeed = getProjectFeedDisplay(ticket);
                const isWatching = (ticket.watchers || []).some(w => (w._id || w) === currentUserId);

                return (
                  <div
                    key={ticket._id}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/tickets/${ticket._id}`)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="font-mono text-sm font-medium text-gray-900">{formattedNumber}</span>
                        <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                        <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/tickets/${ticket._id}`);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium whitespace-nowrap shrink-0"
                      >
                        View →
                      </button>
                    </div>
                    <p className="text-sm font-medium text-gray-900 break-words">{ticket.title}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {ticket.isInternal && (
                        <Badge className="bg-purple-100 text-purple-700"><Lock size={12} /> Internal</Badge>
                      )}
                      {isFeasibility && (
                        <Badge className="bg-indigo-100 text-indigo-700"><UserCheck size={12} /> Feasibility</Badge>
                      )}
                      {isWatching && ticket.status !== 'Closed' && (
                        <Badge className="bg-purple-100 text-purple-700"><Eye size={12} /> Watching</Badge>
                      )}
                      {categoryDisplay && (
                        <Badge className={`border ${getTicketTypeColor(ticket.category)}`}><Tag size={12} className="shrink-0" /> {categoryDisplay}</Badge>
                      )}
                      {ticket.ticketType && !categoryDisplay && (
                        <Badge className={`border ${getTicketTypeColor(ticket.ticketType)}`}><Tag size={12} className="shrink-0" /> {ticket.ticketType}</Badge>
                      )}
                    </div>
                    <div className="meta flex items-center gap-x-3 gap-y-1 mt-2 flex-wrap">
                      {ticket.projectId?.name && (
                        <span className="min-w-0 break-words">{ticket.projectId.name}</span>
                      )}
                      {projectFeed.type !== 'none' && (
                        <span className="flex items-center gap-1 min-w-0 max-w-full">
                          <span className="shrink-0">{projectFeed.icon}</span>
                          <span className="min-w-0 break-all">{projectFeed.name}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1 min-w-0">
                        <Users size={12} className="shrink-0" />
                        {ticket.assignedTo ? ticket.assignedTo.name : 'Unassigned'}
                      </span>
                      <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Desktop Table View
            <ResponsiveTable minWidth={900} stickyFirst={false}>
              <table>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="th">Ticket</th>
                    <th className="th">Title / Type</th>
                    <th className="th">Priority</th>
                    <th className="th">Status</th>
                    <th className="th">Assigned To</th>
                    <th className="th">Feed</th>
                    <th className="th">Created</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTickets.map(ticket => {
                    const categoryDisplay = getCategoryDisplay(ticket);
                    const isFeasibility = isFeasibilityTicket(ticket);
                    const formattedNumber = formatTicketNumber(ticket.ticketNumber);
                    const projectFeed = getProjectFeedDisplay(ticket);
                    const isWatching = (ticket.watchers || []).some(w => (w._id || w) === currentUserId);

                    return (
                      <tr key={ticket._id} className="hover:bg-gray-50 transition-colors">
                        <td className="td">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-sm font-medium text-gray-900">{formattedNumber}</span>
                            {ticket.isInternal && (
                              <Badge className="bg-purple-100 text-purple-700"><Lock size={12} /> Internal</Badge>
                            )}
                            {isFeasibility && (
                              <Badge className="bg-indigo-100 text-indigo-700"><UserCheck size={12} /> Feasibility</Badge>
                            )}
                            {isWatching && ticket.status !== 'Closed' && (
                              <Badge className="bg-purple-100 text-purple-700"><Eye size={12} /> Watching</Badge>
                            )}
                          </div>
                        </td>
                        <td className="td min-w-[220px]">
                          <p className="font-medium text-gray-900">{ticket.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <p className="text-sm text-gray-500">
                              {ticket.projectId?.name || (ticket.isInternal ? 'Internal Task' : 'No Project')}
                            </p>
                            {categoryDisplay && (
                              <Badge className={`border ${getTicketTypeColor(ticket.category)}`}><Tag size={12} className="shrink-0" /> {categoryDisplay}</Badge>
                            )}
                            {ticket.ticketType && !categoryDisplay && (
                              <Badge className={`border ${getTicketTypeColor(ticket.ticketType)}`}><Tag size={12} className="shrink-0" /> {ticket.ticketType}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="td">
                          <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                        </td>
                        <td className="td">
                          <Badge className={`border whitespace-nowrap ${getStatusColor(ticket.status)}`}>{ticket.status}</Badge>
                        </td>
                        <td className="td">
                          {ticket.assignedTo ? (
                            <div className="flex items-center gap-2">
                              <Users size={14} className="text-gray-400 shrink-0" />
                              <span>{ticket.assignedTo.name}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">Unassigned</span>
                          )}
                        </td>
                        <td className="td">
                          {projectFeed.type !== 'none' ? (
                            <span className="block truncate max-w-[120px]" title={projectFeed.name}>
                              {projectFeed.name}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">General</span>
                          )}
                        </td>
                        <td className="td text-gray-500">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </td>
                        <td className="td text-right">
                          <button
                            onClick={() => navigate(`/tickets/${ticket._id}`)}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors whitespace-nowrap"
                          >
                            View Details →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ResponsiveTable>
          )}

          {/* Pagination */}
          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1 || listLoading}
                >
                  <ChevronLeft size={16} /> Previous
                </Button>
                <span className="font-medium text-gray-700 whitespace-nowrap">{page} / {pageCount}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount || listLoading}
                >
                  Next <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDashboard;