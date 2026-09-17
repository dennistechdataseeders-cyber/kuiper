// frontend/src/pages/ResourceAnalytics.jsx

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';
import {
  Clock,
  Users,
  Rss,
  Ticket as TicketIcon,
  Calendar,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronUp,
  Briefcase,
  X,
  Search,
  BarChart3,
  PieChart,
  TrendingUp
} from 'lucide-react';
import { Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import toast from 'react-hot-toast';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const TABS = [
  { key: 'developer', label: 'By Developer', icon: Users },
  { key: 'feed', label: 'By Feed', icon: Rss },
  { key: 'ticket', label: 'By Ticket', icon: TicketIcon }
];

// Default date range: last 30 days from current date
function defaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate());
  const fmt = (d) => d.toISOString().split('T')[0];
  return { startDate: fmt(start), endDate: fmt(end) };
}

// Counts Mon–Fri inclusive between two YYYY-MM-DD date strings
function getWeekdayCount(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

const ResourceAnalytics = () => {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('developer');
  const [sortDesc, setSortDesc] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCharts, setShowCharts] = useState(true);

  // Filters
  const initialDates = defaultDates();
  const [selectedDevelopers, setSelectedDevelopers] = useState([]);
  const [projectId, setProjectId] = useState('all');
  const [startDate, setStartDate] = useState(initialDates.startDate);
  const [endDate, setEndDate] = useState(initialDates.endDate);

  const developerOptions = useMemo(() => {
    if (!data?.developers) return [];
    return data.developers.map((d) => ({ value: d._id, label: d.name || d.email }));
  }, [data]);

  const projectOptions = useMemo(() => {
    if (!data?.projects) return [];
    return data.projects.map((p) => ({
      value: p._id,
      label: p.projectCustomId || p.name
    }));
  }, [data]);

  const fetchData = async () => {
    try {
      const params = { startDate, endDate };
      if (selectedDevelopers.length > 0) {
        params.developerId = selectedDevelopers.map((d) => d.value).join(',');
      }
      if (projectId !== 'all') {
        params.projectId = projectId;
      }

      const res = await axios.get(`${API_BASE_URL}/api/resource-analytics`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setData(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load resource analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilters = () => {
    if (startDate && endDate && startDate > endDate) {
      toast.error('Start date must be before end date');
      return;
    }
    setLoading(true);
    fetchData();
  };

  const handleReset = () => {
    const d = defaultDates();
    setSelectedDevelopers([]);
    setProjectId('all');
    setStartDate(d.startDate);
    setEndDate(d.endDate);
    setSearchQuery('');
    setLoading(true);
    setTimeout(fetchData, 0);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const summary = data?.summary;

  // Working (Mon–Fri) days in the currently selected date range
  const workingDaysInRange = useMemo(
    () => getWeekdayCount(startDate, endDate),
    [startDate, endDate]
  );

  // Total net (feed + ticket, overlap-corrected) minutes divided across working days
  const avgWorkingMinutes = useMemo(() => {
    const totalSeconds = summary?.totalNetCombinedTime || 0;
    if (!workingDaysInRange) return 0;
    return totalSeconds / 60 / workingDaysInRange;
  }, [summary, workingDaysInRange]);

  const sortedRows = useMemo(() => {
    if (!data) return [];
    const key =
      activeTab === 'developer' ? 'netCombinedTime' : 'netTime';
    const source =
      activeTab === 'developer'
        ? data.byDeveloper
        : activeTab === 'feed'
        ? data.byFeed
        : data.byTicket;

    let rows = [...(source || [])];
    
    if (activeTab === 'feed' && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      rows = rows.filter((r) => 
        r.feedName?.toLowerCase().includes(query) ||
        r.projectName?.toLowerCase().includes(query) ||
        r.developerName?.toLowerCase().includes(query)
      );
    }
    
    if (activeTab === 'ticket' && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      rows = rows.filter((r) => 
        r.ticketNumber?.toLowerCase().includes(query) ||
        r.ticketTitle?.toLowerCase().includes(query) ||
        r.projectName?.toLowerCase().includes(query) ||
        r.developerName?.toLowerCase().includes(query)
      );
    }
    
    rows.sort((a, b) => (sortDesc ? b[key] - a[key] : a[key] - b[key]));
    return rows;
  }, [data, activeTab, sortDesc, searchQuery]);

  // Chart data preparation
  const chartData = useMemo(() => {
    if (!data) return null;

    // Developer chart data (top 10)
    const devData = data.byDeveloper?.slice(0, 10) || [];
    const devLabels = devData.map(d => d.developerName || 'Unknown');
    const devCombined = devData.map(d => d.netCombinedTime || 0);
    const devFeed = devData.map(d => d.netFeedTime || 0);
    const devTicket = devData.map(d => d.netTicketTime || 0);

    // Feed chart data (top 10)
    const feedData = data.byFeed?.slice(0, 10) || [];
    const feedLabels = feedData.map(d => d.feedName || 'Unknown');
    const feedTimes = feedData.map(d => d.netTime || 0);

    // Ticket chart data (top 10)
    const ticketData = data.byTicket?.slice(0, 10) || [];
    const ticketLabels = ticketData.map(d => d.ticketNumber || 'Unknown');
    const ticketTimes = ticketData.map(d => d.netTime || 0);

    // Pie chart data - developer distribution
    const pieData = data.byDeveloper?.slice(0, 8) || [];
    const pieLabels = pieData.map(d => d.developerName || 'Unknown');
    const pieValues = pieData.map(d => d.netCombinedTime || 0);

    return {
      devBar: {
        labels: devLabels,
        datasets: [
          {
            label: 'Feed Time',
            data: devFeed,
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1
          },
          {
            label: 'Ticket Time',
            data: devTicket,
            backgroundColor: 'rgba(245, 158, 11, 0.7)',
            borderColor: 'rgba(245, 158, 11, 1)',
            borderWidth: 1
          }
        ]
      },
      feedBar: {
        labels: feedLabels,
        datasets: [{
          label: 'Net Time',
          data: feedTimes,
          backgroundColor: feedTimes.map(t => 
            t > 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(148, 163, 184, 0.4)'
          ),
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1
        }]
      },
      ticketBar: {
        labels: ticketLabels,
        datasets: [{
          label: 'Net Time',
          data: ticketTimes,
          backgroundColor: ticketTimes.map(t => 
            t > 0 ? 'rgba(245, 158, 11, 0.7)' : 'rgba(148, 163, 184, 0.4)'
          ),
          borderColor: 'rgba(245, 158, 11, 1)',
          borderWidth: 1
        }]
      },
      pie: {
        labels: pieLabels,
        datasets: [{
          data: pieValues,
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(14, 165, 233, 0.8)',
            'rgba(234, 179, 8, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderColor: '#fff',
          borderWidth: 2
        }]
      }
    };
  }, [data]);

  if (loading) {
    return (
      <div
        className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center transition-all duration-300 ${
          isCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Loading resource analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}
    >
      {/* Header */}
      <div className="mb-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Resource Analytics
          </h1>
          <p className="text-[10px] font-medium text-slate-500 mt-0.5">
            Net time developers spend on feeds and tickets, overlap-corrected per developer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCharts(!showCharts)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            {showCharts ? <BarChart3 size={13} /> : <TrendingUp size={13} />}
            {showCharts ? 'Hide Charts' : 'Show Charts'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-3 mb-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-end">
          <div className="lg:col-span-4">
            <label className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">
              <Users size={11} />
              Developers
            </label>
            <Select
              isMulti
              options={developerOptions}
              value={selectedDevelopers}
              onChange={(val) => setSelectedDevelopers(val || [])}
              placeholder="All developers"
              classNamePrefix="ra-select"
              styles={selectStyles}
            />
          </div>

          <div className="lg:col-span-3">
            <label className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">
              <Briefcase size={11} />
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            >
              <option value="all">All Projects</option>
              {projectOptions.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">
              <Calendar size={11} />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">
              <Calendar size={11} />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          <div className="lg:col-span-1 flex gap-1.5">
            <button
              onClick={handleApplyFilters}
              className="flex-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700 transition-all"
            >
              Apply
            </button>
          </div>
        </div>

        {(selectedDevelopers.length > 0 || projectId !== 'all') && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {selectedDevelopers.map((d) => (
              <span
                key={d.value}
                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded-full border border-blue-100"
              >
                {d.label}
                <X
                  size={10}
                  className="cursor-pointer"
                  onClick={() =>
                    setSelectedDevelopers((prev) => prev.filter((x) => x.value !== d.value))
                  }
                />
              </span>
            ))}
            <button
              onClick={handleReset}
              className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 ml-0.5"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
        <SummaryCard
          icon={Layers}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
          label="Net Combined Time"
          value={summary?.totalNetCombinedTimeFormatted || '0s'}
          sub={`${summary?.totalNetCombinedHours || '0.00'} hrs total`}
        />
        <SummaryCard
          icon={Rss}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          label="Net Feed Time"
          value={summary?.totalNetFeedTimeFormatted || '0s'}
          sub={`${summary?.totalFeedsWithTime ?? 0} of ${summary?.totalFeeds ?? 0} feeds`}
        />
        <SummaryCard
          icon={TicketIcon}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          label="Net Ticket Time"
          value={summary?.totalNetTicketTimeFormatted || '0s'}
          sub={`${summary?.totalTicketsWithTime ?? 0} of ${summary?.totalTickets ?? 0} tickets`}
        />
        <SummaryCard
          icon={Clock}
          iconColor="text-slate-600"
          iconBg="bg-slate-100"
          label="Overlap Removed"
          value={formatTimeFromSeconds(summary?.totalOverlapTime)}
          sub={`${summary?.totalDevelopers ?? 0} developers`}
        />
        <SummaryCard
          icon={TrendingUp}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          label="Avg Working Minutes"
          value={`${avgWorkingMinutes.toFixed(2)} mins/day`}
          sub={`over ${workingDaysInRange} working day${workingDaysInRange === 1 ? '' : 's'}`}
        />
      </div>

      {/* Charts Section */}
      {showCharts && chartData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-3">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Users size={12} />
              Developer Distribution
            </h3>
            <div className="h-48">
              <Doughnut
                data={chartData.pie}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: {
                        boxWidth: 10,
                        padding: 8,
                        font: { size: 9 }
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const label = context.label || '';
                          const value = context.parsed || 0;
                          const total = context.dataset.data.reduce((a, b) => a + b, 0);
                          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                          return `${label}: ${formatTimeFromSeconds(value)} (${percentage}%)`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-3 lg:col-span-2">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <BarChart3 size={12} />
              Developer Time Breakdown (Top 10)
            </h3>
            <div className="h-48">
              <Bar
                data={chartData.devBar}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top',
                      labels: {
                        boxWidth: 10,
                        padding: 8,
                        font: { size: 9 }
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return `${context.dataset.label}: ${formatTimeFromSeconds(context.parsed.y)}`;
                        }
                      }
                    }
                  },
                  scales: {
                    x: {
                      ticks: {
                        font: { size: 8 },
                        maxRotation: 45
                      }
                    },
                    y: {
                      ticks: {
                        font: { size: 8 },
                        callback: function(value) {
                          return formatTimeFromSeconds(value);
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearchQuery('');
                }}
                className={`flex items-center gap-1 px-3 py-2 text-[10px] font-semibold border-b-2 transition-all ${
                  isActive
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon size={13} />
                {tab.label}
                <span
                  className={`ml-0.5 px-1 py-0.5 rounded-full text-[9px] font-bold ${
                    isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.key === 'developer'
                    ? data?.byDeveloper?.length ?? 0
                    : tab.key === 'feed'
                    ? data?.byFeed?.length ?? 0
                    : data?.byTicket?.length ?? 0}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => setSortDesc((s) => !s)}
            className="ml-auto flex items-center gap-0.5 px-3 py-2 text-[9px] font-semibold text-slate-500 hover:text-slate-700"
          >
            {sortDesc ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            {sortDesc ? 'Highest' : 'Lowest'}
          </button>
        </div>

        {/* Search Bar */}
        {(activeTab === 'feed' || activeTab === 'ticket') && (
          <div className="px-3 py-2 bg-slate-50/50 border-b border-slate-200">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab === 'feed' ? 'feeds, projects, or developers' : 'tickets, projects, or developers'}...`}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {sortedRows.length === 0 ? (
            <div className="text-center py-8">
              <Clock size={28} className="mx-auto text-slate-300 mb-1.5" />
              <p className="text-slate-500 font-medium text-sm">
                {searchQuery ? 'No results found for your search' : 'No time logged for the selected filters'}
              </p>
              <p className="text-slate-400 text-[10px] mt-0.5">
                {searchQuery ? 'Try adjusting your search terms' : 'Try widening the date range or clearing developer filters'}
              </p>
            </div>
          ) : activeTab === 'developer' ? (
            <DeveloperTable rows={sortedRows} />
          ) : activeTab === 'feed' ? (
            <FeedTable rows={sortedRows} />
          ) : (
            <TicketTable rows={sortedRows} />
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   SUBCOMPONENTS
   ============================================================ */

const SummaryCard = ({ icon: Icon, iconColor, iconBg, label, value, sub }) => (
  <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-2 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-1.5">
      <div className={`w-6 h-6 rounded-lg ${iconBg} flex items-center justify-center`}>
        <Icon size={12} className={iconColor} />
      </div>
    </div>
    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
    <p className="text-base font-black text-slate-800">{value}</p>
    <p className="text-[9px] text-slate-400 mt-0.5">{sub}</p>
  </div>
);

const Th = ({ children, align = 'left' }) => (
  <th
    className={`px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide text-${align}`}
  >
    {children}
  </th>
);

const DeveloperTable = ({ rows }) => {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <table className="w-full">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          <Th>Developer</Th>
          <Th align="right">Net Feed</Th>
          <Th align="right">Net Ticket</Th>
          <Th align="right">Net Combined</Th>
          <Th align="right">Overlap Saved</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r, index) => {
          const isExpanded = expandedId === r.developerId;
          return (
            <React.Fragment key={r.developerId}>
              <tr
                onClick={() => setExpandedId(isExpanded ? null : r.developerId)}
                className={`cursor-pointer transition-colors ${
                  isExpanded ? 'bg-blue-50/40' : 'hover:bg-slate-50/70'
                }`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400 w-4">
                      #{index + 1}
                    </span>
                    {isExpanded ? (
                      <ChevronUp size={12} className="text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown size={12} className="text-slate-400 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-800 text-xs">{r.developerName}</p>
                      <p className="text-[9px] text-slate-400">{r.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-medium text-emerald-700">
                  {r.netFeedTimeFormatted}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-medium text-amber-700">
                  {r.netTicketTimeFormatted}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-slate-800">
                  {r.netCombinedTimeFormatted}
                </td>
                <td className="px-3 py-2.5 text-right text-[10px] font-medium text-slate-400">
                  {formatTimeFromSeconds(r.overlapTime)}
                </td>
              </tr>
              {isExpanded && (
                <tr>
                  <td colSpan={5} className="bg-slate-50/60 px-3 py-3 border-b border-slate-100">
                    <DeveloperDailyBreakdown developer={r} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
};

const DeveloperDailyBreakdown = ({ developer }) => {
  const rows = developer.dailyBreakdown || [];

  const chartData = useMemo(() => {
    if (rows.length === 0) return null;
    return {
      labels: rows.map((d) => d.date),
      datasets: [
        {
          label: 'Feed Time',
          data: rows.map((d) => d.netFeedTime),
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
          stack: 'day'
        },
        {
          label: 'Ticket Time',
          data: rows.map((d) => d.netTicketTime),
          backgroundColor: 'rgba(245, 158, 11, 0.7)',
          borderColor: 'rgba(245, 158, 11, 1)',
          borderWidth: 1,
          stack: 'day'
        }
      ]
    };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-slate-400 text-center py-4">
        No day-wise activity for {developer.developerName} in the selected range
      </p>
    );
  }

  return (
    <div>
      <h4 className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-2">
        <Calendar size={11} />
        {developer.developerName} — Day-wise Breakdown
      </h4>

      {chartData && (
        <div className="h-40 mb-3">
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'top',
                  labels: { boxWidth: 10, padding: 8, font: { size: 9 } }
                },
                tooltip: {
                  callbacks: {
                    label: (context) =>
                      `${context.dataset.label}: ${formatTimeFromSeconds(context.parsed.y)}`
                  }
                }
              },
              scales: {
                x: { stacked: true, ticks: { font: { size: 8 }, maxRotation: 45 } },
                y: {
                  stacked: true,
                  ticks: {
                    font: { size: 8 },
                    callback: (value) => formatTimeFromSeconds(value)
                  }
                }
              }
            }}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <Th>Date</Th>
              <Th align="right">Feed Time</Th>
              <Th align="right">Ticket Time</Th>
              <Th align="right">Combined</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((d) => (
              <tr key={d.date} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-3 py-1.5 text-xs font-medium text-slate-700">{d.date}</td>
                <td className="px-3 py-1.5 text-right text-xs font-medium text-emerald-700">
                  {d.netFeedTimeFormatted}
                </td>
                <td className="px-3 py-1.5 text-right text-xs font-medium text-amber-700">
                  {d.netTicketTimeFormatted}
                </td>
                <td className="px-3 py-1.5 text-right text-xs font-bold text-slate-800">
                  {d.netCombinedTimeFormatted}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DeveloperList = ({ developers }) => {
  if (!developers || developers.length === 0) {
    return <span className="text-slate-300 text-[10px]">No one yet</span>;
  }
  if (developers.length === 1) {
    return <span className="text-xs text-slate-600">{developers[0].developerName}</span>;
  }
  return (
    <div>
      <span className="text-xs text-slate-600">{developers[0].developerName}</span>
      <span className="ml-1 px-1 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">
        +{developers.length - 1}
      </span>
    </div>
  );
};

const FeedTable = ({ rows }) => (
  <table className="w-full">
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <Th>Feed</Th>
        <Th>Project</Th>
        <Th>Developer(s)</Th>
        <Th align="right">Net Time</Th>
        <Th align="right">Raw Time</Th>
        <Th align="right">Last Activity</Th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {rows.map((r) => (
        <tr key={r.feedId} className="hover:bg-slate-50/70 transition-colors">
          <td className="px-3 py-2.5 font-semibold text-slate-800 text-xs">{r.feedName}</td>
          <td className="px-3 py-2.5 text-xs text-slate-500">{r.projectName}</td>
          <td className="px-3 py-2.5">
            <DeveloperList developers={r.developers} />
          </td>
          <td
            className={`px-3 py-2.5 text-right text-xs font-bold ${
              r.netTime > 0 ? 'text-emerald-700' : 'text-slate-300'
            }`}
          >
            {r.netTimeFormatted}
          </td>
          <td className="px-3 py-2.5 text-right text-[10px] font-medium text-slate-400">
            {r.rawTimeFormatted}
          </td>
          <td className="px-3 py-2.5 text-right text-[10px] font-medium text-slate-400">
            {r.lastDate || '—'}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const TicketTable = ({ rows }) => (
  <table className="w-full">
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <Th>Ticket</Th>
        <Th>Project</Th>
        <Th>Developer(s)</Th>
        <Th>Status</Th>
        <Th align="right">Net Time</Th>
        <Th align="right">Raw Time</Th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {rows.map((r) => (
        <tr key={r.ticketId} className="hover:bg-slate-50/70 transition-colors">
          <td className="px-3 py-2.5">
            <p className="font-semibold text-slate-800 text-xs">{r.ticketNumber}</p>
            <p className="text-[9px] text-slate-400 truncate max-w-xs">{r.ticketTitle}</p>
          </td>
          <td className="px-3 py-2.5 text-xs text-slate-500">{r.projectName}</td>
          <td className="px-3 py-2.5">
            <DeveloperList developers={r.developers} />
          </td>
          <td className="px-3 py-2.5">
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
              r.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
              r.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
              r.status === 'Review' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {r.status || '—'}
            </span>
          </td>
          <td
            className={`px-3 py-2.5 text-right text-xs font-bold ${
              r.netTime > 0 ? 'text-amber-700' : 'text-slate-300'
            }`}
          >
            {r.netTimeFormatted}
          </td>
          <td className="px-3 py-2.5 text-right text-[10px] font-medium text-slate-400">
            {r.rawTimeFormatted}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

/* ============================================================
   HELPERS
   ============================================================ */

function formatTimeFromSeconds(seconds = 0) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

const selectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: '0.375rem',
    borderColor: state.isFocused ? '#93c5fd' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
    minHeight: '28px',
    fontSize: '0.75rem'
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: '#eff6ff',
    borderRadius: '9999px'
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: '#1d4ed8',
    fontWeight: 600,
    fontSize: '0.625rem'
  })
};

export default ResourceAnalytics;