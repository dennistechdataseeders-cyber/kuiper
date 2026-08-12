// frontend/src/pages/ResourceAnalytics.jsx

import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
  Search,
  Download,
  PieChart,
  BarChart3,
  Clock,
  TrendingUp,
  AlertCircle,
  Info,
  Ticket
} from 'lucide-react';

import API_BASE_URL from '../config';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import {
  Pie,
  Bar
} from 'react-chartjs-2';

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
} from 'chart.js';

import toast from 'react-hot-toast';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
);

const ResourceAnalytics = () => {
  /*
  ========================================
  REFS
  ========================================
  */

  const pieChartRef = useRef(null);
  const { isCollapsed } = useSidebar();
  const barChartRef = useRef(null);

  /*
  ========================================
  STATES
  ========================================
  */

  const [analytics, setAnalytics] = useState([]);
  const [ticketAnalytics, setTicketAnalytics] = useState([]);
  const [projects, setProjects] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('feeds');
  const [summary, setSummary] = useState({
    totalLogs: 0,
    totalFeeds: 0,
    totalNetHours: 0,
    totalNetTimeFormatted: '0h 0m 0s',
    totalOverlapHours: 0,
    totalOverlapTimeFormatted: '0h 0m 0s',
    totalRawHours: 0
  });

  const [ticketSummary, setTicketSummary] = useState({
    totalLogs: 0,
    totalTickets: 0,
    totalNetHours: 0,
    totalNetTimeFormatted: '0h 0m 0s',
    totalOverlapHours: 0,
    totalOverlapTimeFormatted: '0h 0m 0s',
    totalRawHours: 0
  });

  /*
  ========================================
  FILTER STATES
  ========================================
  */

  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedDeveloper, setSelectedDeveloper] = useState('all');
  const [selectedFeed, setSelectedFeed] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  /*
  ========================================
  DATE RANGE
  ========================================
  */

  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  /*
  ========================================
  SORT
  ========================================
  */

  const [sortType, setSortType] = useState('highest');

  /*
  ========================================
  COLORS
  ========================================
  */

  const chartColors = [
    '#2563EB', '#7C3AED', '#059669', '#EA580C', '#DC2626', '#0891B2',
    '#9333EA', '#16A34A', '#CA8A04', '#DB2777', '#4F46E5', '#0F766E'
  ];

  const ticketChartColors = [
    '#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6', '#3B82F6', '#EF4444',
    '#10B981', '#8B5CF6', '#F472B6', '#FBBF24', '#34D399', '#60A5FA'
  ];

  /*
  ========================================
  FORMAT TIME
  ========================================
  */

  const formatTime = (seconds = 0) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  /*
  ========================================
  FETCH ANALYTICS
  ========================================
  */

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const params = { startDate, endDate };
      if (selectedProject !== 'all') params.projectId = selectedProject;
      if (selectedDeveloper !== 'all') params.developerId = selectedDeveloper;
      if (selectedFeed !== 'all') params.feedId = selectedFeed;

      const [feedRes, ticketRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/resource-analytics`, {
          headers: { Authorization: `Bearer ${token}` },
          params
        }),
        axios.get(`${API_BASE_URL}/api/resource-analytics/tickets`, {
          headers: { Authorization: `Bearer ${token}` },
          params
        }).catch(() => ({ data: { analyticsData: [], summary: {} } }))
      ]);

      console.log('Feed API Response:', feedRes.data);
      console.log('Ticket API Response:', ticketRes.data);

      setAnalytics(Array.isArray(feedRes.data.analyticsData) ? feedRes.data.analyticsData : []);
      setTicketAnalytics(Array.isArray(ticketRes.data.analyticsData) ? ticketRes.data.analyticsData : []);
      setProjects(Array.isArray(feedRes.data.projects) ? feedRes.data.projects : []);
      setFeeds(Array.isArray(feedRes.data.feeds) ? feedRes.data.feeds : []);
      setDevelopers(Array.isArray(feedRes.data.developers) ? feedRes.data.developers : []);
      
      if (feedRes.data.summary) {
        setSummary(feedRes.data.summary);
      }
      
      if (ticketRes.data.summary) {
        setTicketSummary(ticketRes.data.summary);
      }

    } catch (err) {
      console.error('Analytics Error:', err);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate, selectedProject, selectedDeveloper, selectedFeed]);

  /*
  ========================================
  FILTERED DATA - Feeds
  ========================================
  */

  const filteredData = useMemo(() => {
    let result = [...analytics];

    result = result.filter(item => (item.netTime || 0) > 0);

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.feedName?.toLowerCase().includes(search) ||
        item.projectName?.toLowerCase().includes(search) ||
        item.developerName?.toLowerCase().includes(search)
      );
    }

    result.sort((a, b) => {
      if (sortType === 'highest') {
        return b.netTime - a.netTime;
      }
      return a.netTime - b.netTime;
    });

    return result;
  }, [analytics, searchTerm, sortType]);

  /*
  ========================================
  FILTERED DATA - Tickets
  ========================================
  */

  const filteredTicketData = useMemo(() => {
    let result = [...ticketAnalytics];

    result = result.filter(item => (item.netTime || 0) > 0);

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.ticketTitle?.toLowerCase().includes(search) ||
        item.ticketNumber?.toLowerCase().includes(search) ||
        item.projectName?.toLowerCase().includes(search) ||
        item.developerName?.toLowerCase().includes(search)
      );
    }

    result.sort((a, b) => {
      if (sortType === 'highest') {
        return b.netTime - a.netTime;
      }
      return a.netTime - b.netTime;
    });

    return result;
  }, [ticketAnalytics, searchTerm, sortType]);

  /*
  ========================================
  COMBINED DATA
  ========================================
  */

  const combinedData = useMemo(() => {
    const feedItems = filteredData.map(item => ({
      ...item,
      type: 'feed',
      name: item.feedName || 'Unknown Feed',
      id: item.feedId,
      projectName: item.projectName,
      developerName: item.developerName,
      netTime: item.netTime || 0,
      totalTime: item.totalTime || 0,
      formattedNetTime: item.formattedNetTime || formatTime(item.netTime || 0),
      formattedTotalTime: item.formattedTotalTime || formatTime(item.totalTime || 0),
      logCount: item.logCount || 0,
      lastDate: item.lastDate
    }));

    const ticketItems = filteredTicketData.map(item => ({
      ...item,
      type: 'ticket',
      name: `${item.ticketNumber} - ${item.ticketTitle}` || 'Unknown Ticket',
      id: item.ticketId,
      projectName: item.projectName,
      developerName: item.developerName || 'Unknown',
      netTime: item.netTime || 0,
      totalTime: item.totalTime || 0,
      formattedNetTime: item.formattedNetTime || formatTime(item.netTime || 0),
      formattedTotalTime: item.formattedTotalTime || formatTime(item.totalTime || 0),
      logCount: item.logCount || 0,
      lastDate: item.lastDate
    }));

    return [...feedItems, ...ticketItems].sort((a, b) => {
      if (sortType === 'highest') {
        return b.netTime - a.netTime;
      }
      return a.netTime - b.netTime;
    });
  }, [filteredData, filteredTicketData, sortType]);

  /*
  ========================================
  CHART DATA
  ========================================
  */

  const getChartData = (data, colors, isTicket = false) => {
    const labels = data.map(item => {
      if (isTicket) {
        return item.ticketNumber && item.ticketTitle 
          ? `${item.ticketNumber} - ${item.ticketTitle}`
          : item.name || 'Unknown Ticket';
      }
      return item.feedName || item.name || 'Unknown Feed';
    });
    
    const values = data.map(item => item.netTime || 0);
    const totalSeconds = values.reduce((sum, val) => sum + val, 0);

    const metadata = data.reduce((acc, item, index) => {
      let name = '';
      if (isTicket) {
        name = item.ticketNumber && item.ticketTitle 
          ? `${item.ticketNumber} - ${item.ticketTitle}`
          : item.name || 'Unknown Ticket';
      } else {
        name = item.feedName || item.name || 'Unknown Feed';
      }
      
      acc[index] = {
        name: name,
        netSeconds: item.netTime || 0,
        formattedNetTime: item.formattedNetTime || formatTime(item.netTime || 0)
      };
      return acc;
    }, {});

    return {
      labels,
      values,
      totalSeconds,
      metadata,
      data: {
        labels,
        datasets: [{
          label: 'Net Time (seconds)',
          data: values,
          backgroundColor: labels.map((_, index) => colors[index % colors.length]),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      }
    };
  };

  const feedChartData = getChartData(filteredData, chartColors, false);
  const ticketChartData = getChartData(filteredTicketData, ticketChartColors, true);
  const combinedChartData = getChartData(combinedData, [...chartColors, ...ticketChartColors], false);

  const chartTooltipOptions = (metadata, totalSeconds, isTicket = false) => ({
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      tooltip: {
        callbacks: {
          title: function(context) {
            const index = context[0].dataIndex;
            const meta = metadata[index];
            return meta?.name || context[0].label || 'Unknown';
          },
          label: function(context) {
            const index = context.dataIndex;
            const meta = metadata[index];
            const seconds = context.raw || 0;
            const percentage = totalSeconds > 0 ? ((seconds / totalSeconds) * 100).toFixed(1) : 0;
            
            return [
              `  Net Time: ${meta?.formattedNetTime || formatTime(seconds)}`,
              `  Percentage: ${percentage}%`
            ];
          }
        }
      },
      legend: {
        position: 'bottom',
        labels: { 
          font: { size: 10 }, 
          boxWidth: 12,
          padding: 20,
          generateLabels: function(chart) {
            const original = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
            original.forEach(label => {
              if (label.text && label.text.length > 30) {
                label.text = label.text.substring(0, 27) + '...';
              }
            });
            return original;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return formatTime(value);
          }
        }
      }
    }
  });

  /*
  ========================================
  DOWNLOAD PDF
  ========================================
  */

  const downloadPDF = async () => {
    const loadingToast = toast.loading('Generating PDF report...');

    try {
      const pdfContainer = document.createElement('div');
      pdfContainer.style.position = 'absolute';
      pdfContainer.style.top = '-9999px';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.backgroundColor = '#ffffff';
      pdfContainer.style.width = '800px';
      pdfContainer.style.padding = '20px';
      pdfContainer.style.fontFamily = 'Arial, sans-serif';

      const pieChartClone = pieChartRef.current?.cloneNode(true);
      const barChartClone = barChartRef.current?.cloneNode(true);

      if (pieChartClone) {
        const canvas = pieChartClone.querySelector('canvas');
        if (canvas) {
          canvas.style.width = '300px';
          canvas.style.height = '200px';
        }
        pdfContainer.appendChild(pieChartClone);
      }

      if (barChartClone) {
        const canvas = barChartClone.querySelector('canvas');
        if (canvas) {
          canvas.style.width = '300px';
          canvas.style.height = '200px';
        }
        pdfContainer.appendChild(barChartClone);
      }

      document.body.appendChild(pdfContainer);
      await new Promise(resolve => setTimeout(resolve, 100));

      const pdf = new jsPDF('p', 'mm', 'a4');

      pdf.setFontSize(22);
      pdf.setTextColor(37, 99, 235);
      pdf.text('Resource Analytics Report (Net Time)', 14, 20);

      pdf.setDrawColor(220, 220, 220);
      pdf.line(14, 24, 195, 24);

      pdf.setFontSize(11);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`Start Date: ${startDate}`, 14, 35);
      pdf.text(`End Date: ${endDate}`, 14, 42);
      
      pdf.setFontSize(12);
      pdf.setTextColor(37, 99, 235);
      pdf.text('📋 Feed Summary', 14, 55);
      pdf.setFontSize(10);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`Total Net Time: ${summary.totalNetTimeFormatted}`, 14, 63);
      pdf.text(`Total Overlap: ${summary.totalOverlapTimeFormatted}`, 14, 70);
      pdf.text(`Total Feeds: ${filteredData.length}`, 14, 77);

      pdf.setFontSize(12);
      pdf.setTextColor(139, 92, 246);
      pdf.text('🎫 Ticket Summary', 105, 55);
      pdf.setFontSize(10);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`Total Net Time: ${ticketSummary.totalNetTimeFormatted}`, 105, 63);
      pdf.text(`Total Overlap: ${ticketSummary.totalOverlapTimeFormatted}`, 105, 70);
      pdf.text(`Total Tickets: ${filteredTicketData.length}`, 105, 77);

      if (pieChartRef.current) {
        try {
          const pieCanvas = pieChartRef.current.querySelector('canvas');
          if (pieCanvas) {
            const pieImgData = pieCanvas.toDataURL('image/png');
            pdf.setFontSize(14);
            pdf.setTextColor(30, 41, 59);
            pdf.text('Distribution (Net Time)', 14, 92);
            pdf.addImage(pieImgData, 'PNG', 14, 97, 80, 60);
          }
        } catch (err) {
          console.error('Pie chart capture error:', err);
        }
      }

      if (barChartRef.current) {
        try {
          const barCanvas = barChartRef.current.querySelector('canvas');
          if (barCanvas) {
            const barImgData = barCanvas.toDataURL('image/png');
            pdf.setFontSize(14);
            pdf.setTextColor(30, 41, 59);
            pdf.text('Comparison (Net Time)', 105, 92);
            pdf.addImage(barImgData, 'PNG', 105, 97, 85, 60);
          }
        } catch (err) {
          console.error('Bar chart capture error:', err);
        }
      }

      const tableData = activeTab === 'combined' ? combinedData : 
                        activeTab === 'tickets' ? filteredTicketData : filteredData;
      
      // ✅ FIXED: Removed Overlap column from Feed table
      // ✅ FIXED: Ticket table only shows Ticket, Developer, Raw Time
      // ✅ FIXED: Combined table shows Type, Name, Developer, Net Time, Raw Time
      const getTableHeaders = () => {
        if (activeTab === 'combined') {
          return ['Type', 'Name', 'Developer', 'Net Time', 'Raw Time'];
        } else if (activeTab === 'tickets') {
          return ['Ticket', 'Developer', 'Raw Time'];
        } else {
          return ['Feed', 'Project', 'Developer', 'Net Time', 'Raw Time'];
        }
      };

      const getTableBody = () => {
        if (activeTab === 'combined') {
          return tableData.map(item => [
            item.type === 'feed' ? '📋 Feed' : '🎫 Ticket',
            item.name || 'Unknown',
            item.developerName || 'Unknown',
            item.formattedNetTime || formatTime(item.netTime || 0),
            item.formattedTotalTime || formatTime(item.totalTime || 0)
          ]);
        } else if (activeTab === 'tickets') {
          return tableData.map(item => [
            item.ticketNumber && item.ticketTitle ? `${item.ticketNumber} - ${item.ticketTitle}` : 'Unknown Ticket',
            item.developerName || 'Unknown',
            item.formattedTotalTime || formatTime(item.totalTime || 0)
          ]);
        } else {
          return tableData.map(item => [
            item.feedName || 'Unknown Feed',
            item.projectName || 'Unknown',
            item.developerName || 'Unknown',
            item.formattedNetTime || formatTime(item.netTime || 0),
            item.formattedTotalTime || formatTime(item.totalTime || 0)
          ]);
        }
      };

      autoTable(pdf, {
        startY: 170,
        head: [getTableHeaders()],
        body: getTableBody(),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235] }
      });

      document.body.removeChild(pdfContainer);
      pdf.save(`resource-analytics-${activeTab}-${Date.now()}.pdf`);

      toast.dismiss(loadingToast);
      toast.success('Report downloaded successfully!');

    } catch (err) {
      console.error('PDF ERROR:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  /*
  ========================================
  RENDER HELPERS
  ========================================
  */

  const renderChartSection = (data, chartData, title, colors, isTicket = false) => {
    const hasData = data.length > 0;
    const chartOptions = chartTooltipOptions(chartData.metadata, chartData.totalSeconds, isTicket);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div ref={pieChartRef} className="bg-white p-4 rounded-[2rem] border lg:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className={isTicket ? "text-purple-600" : "text-blue-600"} size={20} />
            <h2 className="text-lg font-black">{title} Distribution (Net Time)</h2>
            <span className={`text-[10px] font-bold ${isTicket ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'} px-2 py-0.5 rounded-full`}>
              {data.length}
            </span>
          </div>
          <div className="max-w-xs mx-auto" style={{ height: '280px' }}>
            {hasData ? (
              <Pie data={chartData.data} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                No data to display
              </div>
            )}
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-3">
            Hover on segments to see details
          </p>
        </div>

        <div ref={barChartRef} className="bg-white p-4 rounded-[2rem] border lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className={isTicket ? "text-purple-600" : "text-blue-600"} size={20} />
            <h2 className="text-lg font-black">{title} Comparison (Net Time)</h2>
          </div>
          <div className="h-80">
            {hasData ? (
              <Bar data={chartData.data} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                No data to display
              </div>
            )}
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-3">
            Hover on bars to see details
          </p>
        </div>
      </div>
    );
  };

  // ✅ FIXED: Ticket table only shows Ticket, Developer, Raw Time (NO Net Time, NO Overlap, NO Project)
  // ✅ FIXED: Feed table shows Feed, Project, Developer, Net Time, Raw Time (NO Overlap)
  const renderTable = (data, isTicket = false) => {
    if (data.length === 0) {
      return (
        <div className="bg-white rounded-[2rem] border p-12 text-center">
          <div className="flex flex-col items-center gap-2">
            {isTicket ? <Ticket size={40} className="text-slate-300" /> : <Clock size={40} className="text-slate-300" />}
            <p className="text-slate-400 font-medium">No {isTicket ? 'ticket' : 'feed'} data found</p>
            <p className="text-xs text-slate-400">Try adjusting your filters</p>
          </div>
        </div>
      );
    }

    // ✅ FIXED: Ticket table only shows Ticket, Developer, Raw Time (no Net Time, no Project)
    const headers = isTicket 
      ? ['Ticket', 'Developer', 'Net Time']
      : ['Feed', 'Project', 'Developer', 'Net Time'];

    return (
      <div className="bg-white rounded-[2rem] border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                {headers.map((header, idx) => (
                  <th key={idx} className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                let name = '';
                if (isTicket) {
                  name = item.ticketNumber && item.ticketTitle 
                    ? `${item.ticketNumber} - ${item.ticketTitle}`
                    : 'Unknown Ticket';
                } else {
                  name = item.feedName || 'Unknown Feed';
                }
                
                // ✅ FIXED: Conditional rendering based on isTicket
                if (isTicket) {
                  // Ticket table: Ticket, Developer, Raw Time
                  return (
                    <tr key={item.ticketId || index} className="border-t hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium">{name}</td>
                      <td className="px-6 py-4">{item.developerName || 'Unknown'}</td>
                      <td className="px-6 py-4 text-slate-600">{item.formattedTotalTime || formatTime(item.totalTime || 0)}</td>
                    </tr>
                  );
                } else {
                  // Feed table: Feed, Project, Developer, Net Time, Raw Time
                  return (
                    <tr key={item.feedId || index} className="border-t hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium">{name}</td>
                      <td className="px-6 py-4">{item.projectName || 'Unknown'}</td>
                      <td className="px-6 py-4">{item.developerName || 'Unknown'}</td>
                      <td className="px-6 py-4 font-bold text-green-700">{item.formattedNetTime || formatTime(item.netTime || 0)}</td>
                      {/* <td className="px-6 py-4 text-slate-600">{item.formattedTotalTime || formatTime(item.totalTime || 0)}</td> */}
                    </tr>
                  );
                }
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black">Resource Analytics</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-600 font-black mt-2">
            Net Time Without Overlap
          </p>
        </div>
        <button
          onClick={downloadPDF}
          className="bg-blue-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold hover:bg-blue-700 transition-colors"
        >
          <Download size={18} />
          Download PDF
        </button>
      </div>

      {/* INFO BANNER */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
        <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Net Time Calculation</p>
          <p className="text-xs text-blue-700">
            This report shows <strong>net time without overlap</strong>. If a developer worked on multiple items simultaneously, 
            the overlapping time is counted only once. Raw time shows the sum of all individual timers.
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1">
              <Clock size={12} className="text-green-600" />
              <span className="font-medium text-green-700">Net Time: Actual work time</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} className="text-amber-600" />
              <span className="font-medium text-amber-700">Overlap: Duplicate time</span>
            </span>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          className={`px-6 py-3 text-sm font-black uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'feeds' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
          onClick={() => setActiveTab('feeds')}
        >
          <div className="flex items-center gap-2">
            <Clock size={16} />
            Feeds
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {filteredData.length}
            </span>
          </div>
        </button>
        <button
          className={`px-6 py-3 text-sm font-black uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'tickets' 
              ? 'border-purple-600 text-purple-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
          onClick={() => setActiveTab('tickets')}
        >
          <div className="flex items-center gap-2">
            <Ticket size={16} />
            Tickets
            <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              {filteredTicketData.length}
            </span>
          </div>
        </button>
        <button
          className={`px-6 py-3 text-sm font-black uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'combined' 
              ? 'border-emerald-600 text-emerald-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
          onClick={() => setActiveTab('combined')}
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={16} />
            Combined
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {combinedData.length}
            </span>
          </div>
        </button>
      </div>

      {/* FILTERS */}
      <div className="bg-white rounded-[2rem] p-5 border border-slate-200 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          
          <div>
            <label className="text-xs uppercase font-black text-slate-500 mb-2 block">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="h-12 border rounded-2xl px-4 w-full"
            >
              <option value="all">All Projects</option>
              {projects.map(project => (
                <option key={project._id} value={project._id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase font-black text-slate-500 mb-2 block">Developer</label>
            <select
              value={selectedDeveloper}
              onChange={(e) => setSelectedDeveloper(e.target.value)}
              className="h-12 border rounded-2xl px-4 w-full"
            >
              <option value="all">All Developers</option>
              {developers.map(dev => (
                <option key={dev._id} value={dev._id}>{dev.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase font-black text-slate-500 mb-2 block">Feed</label>
            <select
              value={selectedFeed}
              onChange={(e) => setSelectedFeed(e.target.value)}
              className="h-12 border rounded-2xl px-4 w-full"
            >
              <option value="all">All Feeds</option>
              {feeds.map(feed => (
                <option key={feed._id} value={feed._id}>{feed.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase font-black text-slate-500 mb-2 block">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-12 border rounded-2xl px-4 w-full"
            />
          </div>

          <div>
            <label className="text-xs uppercase font-black text-slate-500 mb-2 block">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-12 border rounded-2xl px-4 w-full"
            />
          </div>

          <div>
            <label className="text-xs uppercase font-black text-slate-500 mb-2 block">Sort</label>
            <select
              value={sortType}
              onChange={(e) => setSortType(e.target.value)}
              className="h-12 border rounded-2xl px-4 w-full"
            >
              <option value="highest">Most Net Time</option>
              <option value="lowest">Least Net Time</option>
            </select>
          </div>
        </div>

        <div className="mt-4 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search feeds, tickets, projects, or developers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 border rounded-2xl pl-11 pr-4"
          />
        </div>
      </div>

      {/* FEED SECTION */}
      {activeTab === 'feeds' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
            <div className="bg-white p-6 rounded-[2rem] border">
              <p className="text-xs uppercase font-black text-slate-400">Total Net Time</p>
              <h2 className="text-3xl font-black mt-2 text-green-600">{summary.totalNetTimeFormatted || '0h 0m 0s'}</h2>
              <p className="text-[10px] text-slate-400 mt-1">Actual work time</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border">
              <p className="text-xs uppercase font-black text-slate-400">Total Overlap</p>
              <h2 className="text-3xl font-black mt-2 text-amber-600">{summary.totalOverlapTimeFormatted || '0h 0m 0s'}</h2>
              <p className="text-[10px] text-slate-400 mt-1">Duplicate/overlapping time</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border">
              <p className="text-xs uppercase font-black text-slate-400">Total Feeds</p>
              <h2 className="text-3xl font-black mt-2">{filteredData.length}</h2>
              <p className="text-[10px] text-slate-400 mt-1">Unique feeds analyzed</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border">
              <p className="text-xs uppercase font-black text-slate-400">Total Logs</p>
              <h2 className="text-3xl font-black mt-2">{summary.totalLogs || 0}</h2>
              <p className="text-[10px] text-slate-400 mt-1">Individual time entries</p>
            </div>
          </div>

          {renderChartSection(filteredData, feedChartData, 'Feed', chartColors, false)}
          {renderTable(filteredData, false)}
        </>
      )}

      {/* TICKET SECTION */}
      {activeTab === 'tickets' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
            <div className="bg-white p-6 rounded-[2rem] border">
              <p className="text-xs uppercase font-black text-slate-400">Total Net Time</p>
              <h2 className="text-3xl font-black mt-2 text-purple-600">{ticketSummary.totalNetTimeFormatted || '0h 0m 0s'}</h2>
              <p className="text-[10px] text-slate-400 mt-1">Actual work time</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border">
              <p className="text-xs uppercase font-black text-slate-400">Total Overlap</p>
              <h2 className="text-3xl font-black mt-2 text-amber-600">{ticketSummary.totalOverlapTimeFormatted || '0h 0m 0s'}</h2>
              <p className="text-[10px] text-slate-400 mt-1">Duplicate/overlapping time</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border">
              <p className="text-xs uppercase font-black text-slate-400">Total Tickets</p>
              <h2 className="text-3xl font-black mt-2">{filteredTicketData.length}</h2>
              <p className="text-[10px] text-slate-400 mt-1">Unique tickets analyzed</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border">
              <p className="text-xs uppercase font-black text-slate-400">Total Logs</p>
              <h2 className="text-3xl font-black mt-2">{ticketSummary.totalLogs || 0}</h2>
              <p className="text-[10px] text-slate-400 mt-1">Individual time entries</p>
            </div>
          </div>

          {renderChartSection(filteredTicketData, ticketChartData, 'Ticket', ticketChartColors, true)}
          {renderTable(filteredTicketData, true)}
        </>
      )}

      {/* COMBINED SECTION */}
      {activeTab === 'combined' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
            <div className="bg-white p-6 rounded-[2rem] border">
              <p className="text-xs uppercase font-black text-slate-400">Total Net Time</p>
              <h2 className="text-3xl font-black mt-2 text-emerald-600">
                {formatTime(
                  (summary.totalNetTimeFormatted ? parseTimeString(summary.totalNetTimeFormatted) : 0) +
                  (ticketSummary.totalNetTimeFormatted ? parseTimeString(ticketSummary.totalNetTimeFormatted) : 0)
                )}
              </h2>
              <p className="text-[10px] text-slate-400 mt-1">Actual work time</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border">
              <p className="text-xs uppercase font-black text-slate-400">Total Overlap</p>
              <h2 className="text-3xl font-black mt-2 text-amber-600">
                {formatTime(
                  (summary.totalOverlapTimeFormatted ? parseTimeString(summary.totalOverlapTimeFormatted) : 0) +
                  (ticketSummary.totalOverlapTimeFormatted ? parseTimeString(ticketSummary.totalOverlapTimeFormatted) : 0)
                )}
              </h2>
              <p className="text-[10px] text-slate-400 mt-1">Duplicate/overlapping time</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border">
              <p className="text-xs uppercase font-black text-slate-400">Total Items</p>
              <h2 className="text-3xl font-black mt-2">{combinedData.length}</h2>
              <p className="text-[10px] text-slate-400 mt-1">
                {filteredData.length} feeds + {filteredTicketData.length} tickets
              </p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border">
              <p className="text-xs uppercase font-black text-slate-400">Total Logs</p>
              <h2 className="text-3xl font-black mt-2">
                {(summary.totalLogs || 0) + (ticketSummary.totalLogs || 0)}
              </h2>
              <p className="text-[10px] text-slate-400 mt-1">Individual time entries</p>
            </div>
          </div>

          {renderChartSection(combinedData, combinedChartData, 'Combined', [...chartColors, ...ticketChartColors], false)}

          <div className="bg-white rounded-[2rem] border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Developer</th>
                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Net Time</th>
                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Raw Time</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        No data found for the selected filters
                      </td>
                    </tr>
                  ) : (
                    combinedData.map((item, index) => (
                      <tr key={item.id || index} className="border-t hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                            item.type === 'feed' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {item.type === 'feed' ? '📋 Feed' : '🎫 Ticket'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium">{item.name || 'Unknown'}</td>
                        <td className="px-6 py-4">{item.developerName || 'Unknown'}</td>
                        <td className="px-6 py-4 font-bold text-green-700">{item.formattedNetTime || formatTime(item.netTime || 0)}</td>
                        <td className="px-6 py-4 text-slate-600">{item.formattedTotalTime || formatTime(item.totalTime || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm font-black text-slate-500 uppercase tracking-wider">Loading Analytics...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to parse time string like "1h 30m 45s" to seconds
function parseTimeString(timeStr) {
  if (!timeStr) return 0;
  let seconds = 0;
  const parts = timeStr.split(' ');
  for (const part of parts) {
    if (part.includes('h')) {
      seconds += parseInt(part) * 3600;
    } else if (part.includes('m')) {
      seconds += parseInt(part) * 60;
    } else if (part.includes('s')) {
      seconds += parseInt(part);
    }
  }
  return seconds;
}

export default ResourceAnalytics;