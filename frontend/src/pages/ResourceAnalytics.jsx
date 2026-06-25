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
  Info
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
  const [projects, setProjects] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalLogs: 0,
    totalFeeds: 0,
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

      const res = await axios.get(`${API_BASE_URL}/api/resource-analytics`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      console.log('API Response:', res.data);

      setAnalytics(Array.isArray(res.data.analyticsData) ? res.data.analyticsData : []);
      setProjects(Array.isArray(res.data.projects) ? res.data.projects : []);
      setFeeds(Array.isArray(res.data.feeds) ? res.data.feeds : []);
      setDevelopers(Array.isArray(res.data.developers) ? res.data.developers : []);
      
      if (res.data.summary) {
        setSummary(res.data.summary);
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
  FILTERED DATA - Only include feeds with netTime > 0
  ========================================
  */

  const filteredData = useMemo(() => {
    let result = [...analytics];

    // 🔥 FIX: Filter out feeds with 0 net time
    result = result.filter(item => (item.netTime || 0) > 0);

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.feedName?.toLowerCase().includes(search) ||
        item.projectName?.toLowerCase().includes(search) ||
        item.developerName?.toLowerCase().includes(search)
      );
    }

    // Apply sorting
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
  CHART DATA - Using seconds directly
  ========================================
  */

  const chartLabels = filteredData.map(item => item.feedName || 'Unknown Feed');
  
  // 🔥 FIX: Use netTime in seconds directly (don't divide by 3600)
  const chartValues = filteredData.map(item => item.netTime || 0);

  // Calculate total for percentage
  const totalNetSeconds = filteredData.reduce((sum, item) => sum + (item.netTime || 0), 0);

  // Create metadata for tooltips
  const feedMetadata = filteredData.reduce((acc, item, index) => {
    acc[index] = {
      feedName: item.feedName,
      projectName: item.projectName,
      developerName: item.developerName,
      netSeconds: item.netTime || 0,
      formattedNetTime: item.formattedNetTime || formatTime(item.netTime || 0),
      formattedTotalTime: item.formattedTotalTime || formatTime(item.totalTime || 0),
      formattedOverlapTime: item.formattedOverlapTime || formatTime(item.overlapTime || 0),
      description: item.description,
      logCount: item.logCount
    };
    return acc;
  }, {});

  const pieData = {
    labels: chartLabels,
    datasets: [{
      label: 'Net Time (seconds)',
      data: chartValues,
      backgroundColor: chartLabels.map((_, index) => chartColors[index % chartColors.length]),
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };

  const barData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Net Time (seconds)',
        data: chartValues,
        backgroundColor: chartLabels.map((_, index) => chartColors[index % chartColors.length]),
        borderRadius: 6,
        borderColor: '#ffffff',
        borderWidth: 2
      }
    ]
  };

  // 🔥 FIX: Custom tooltip with better formatting
  const chartTooltipOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      tooltip: {
        callbacks: {
          title: function(context) {
            const index = context[0].dataIndex;
            const metadata = feedMetadata[index];
            return metadata?.feedName || context[0].label || 'Unknown Feed';
          },
          label: function(context) {
            const index = context.dataIndex;
            const metadata = feedMetadata[index];
            const seconds = context.raw || 0;
            const percentage = totalNetSeconds > 0 ? ((seconds / totalNetSeconds) * 100).toFixed(1) : 0;
            
            return [
              `  Net Time: ${metadata?.formattedNetTime || formatTime(seconds)}`,
              `  Percentage: ${percentage}%`,
              `  Project: ${metadata?.projectName || 'Unknown'}`,
              `  Developer: ${metadata?.developerName || 'Unknown'}`,
              `  Raw Time: ${metadata?.formattedTotalTime || '0s'}`,
              `  Logs: ${metadata?.logCount || 0}`
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
  };

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
      pdf.text(`Total Net Time: ${summary.totalNetTimeFormatted}`, 14, 49);
      pdf.text(`Total Overlap: ${summary.totalOverlapTimeFormatted}`, 14, 56);
      pdf.text(`Total Feeds: ${filteredData.length}`, 14, 63);

      // Capture pie chart
      if (pieChartRef.current) {
        try {
          const pieCanvas = pieChartRef.current.querySelector('canvas');
          if (pieCanvas) {
            const pieImgData = pieCanvas.toDataURL('image/png');
            pdf.setFontSize(16);
            pdf.text('Feed Distribution (Net Time)', 14, 77);
            pdf.addImage(pieImgData, 'PNG', 14, 82, 80, 60);
          }
        } catch (err) {
          console.error('Pie chart capture error:', err);
        }
      }

      // Capture bar chart
      if (barChartRef.current) {
        try {
          const barCanvas = barChartRef.current.querySelector('canvas');
          if (barCanvas) {
            const barImgData = barCanvas.toDataURL('image/png');
            pdf.setFontSize(16);
            pdf.text('Feed Comparison (Net Time)', 105, 77);
            pdf.addImage(barImgData, 'PNG', 105, 82, 85, 60);
          }
        } catch (err) {
          console.error('Bar chart capture error:', err);
        }
      }

      // Table with filtered data
      autoTable(pdf, {
        startY: 155,
        head: [['Feed', 'Project', 'Developer', 'Net Time', 'Raw Time', 'Overlap', 'Logs']],
        body: filteredData.map(item => [
          item.feedName || 'Unknown',
          item.projectName || 'Unknown',
          item.developerName || 'Unknown',
          item.formattedNetTime || formatTime(item.netTime || 0),
          item.formattedTotalTime || formatTime(item.totalTime || 0),
          item.formattedOverlapTime || formatTime(item.overlapTime || 0),
          item.logCount || 0
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235] }
      });

      document.body.removeChild(pdfContainer);
      pdf.save(`resource-analytics-net-time-${Date.now()}.pdf`);

      toast.dismiss(loadingToast);
      toast.success('Report downloaded successfully!');

    } catch (err) {
      console.error('PDF ERROR:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to generate PDF. Please try again.');
    }
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
            This report shows <strong>net time without overlap</strong>. If a developer worked on multiple feeds simultaneously, 
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

      {/* FILTERS */}
      <div className="bg-white rounded-[2rem] p-5 border border-slate-200 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          
          {/* PROJECT */}
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

          {/* DEVELOPER */}
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

          {/* FEED */}
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

          {/* START DATE */}
          <div>
            <label className="text-xs uppercase font-black text-slate-500 mb-2 block">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-12 border rounded-2xl px-4 w-full"
            />
          </div>

          {/* END DATE */}
          <div>
            <label className="text-xs uppercase font-black text-slate-500 mb-2 block">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-12 border rounded-2xl px-4 w-full"
            />
          </div>

          {/* SORT */}
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

        {/* SEARCH */}
        <div className="mt-4 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search feeds, projects, or developers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 border rounded-2xl pl-11 pr-4"
          />
        </div>
      </div>

      {/* SUMMARY CARDS */}
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

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* PIE CHART */}
        <div ref={pieChartRef} className="bg-white p-4 rounded-[2rem] border lg:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="text-blue-600" size={20} />
            <h2 className="text-lg font-black">Feed Distribution (Net Time)</h2>
          </div>
          <div className="max-w-xs mx-auto" style={{ height: '280px' }}>
            {filteredData.length > 0 ? (
              <Pie data={pieData} options={chartTooltipOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                No data to display
              </div>
            )}
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-3">
            Hover on segments to see project & developer details
          </p>
        </div>

        {/* BAR CHART */}
        <div ref={barChartRef} className="bg-white p-4 rounded-[2rem] border lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="text-blue-600" size={20} />
            <h2 className="text-lg font-black">Feed Comparison (Net Time)</h2>
          </div>
          <div className="h-80">
            {filteredData.length > 0 ? (
              <Bar data={barData} options={chartTooltipOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                No data to display
              </div>
            )}
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-3">
            Hover on bars to see project & developer details
          </p>
        </div>
      </div>

      {/* TABLE - Shows Net Time vs Raw Time */}
      <div className="bg-white rounded-[2rem] border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Feed</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Project</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Developer</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Net Time</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Raw Time</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Overlap</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Logs</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No data found for the selected filters
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr key={item.feedId || index} className="border-t hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium">{item.feedName || 'Unknown'}</td>
                    <td className="px-6 py-4">{item.projectName || 'Unknown'}</td>
                    <td className="px-6 py-4">{item.developerName || 'Unknown'}</td>
                    <td className="px-6 py-4 font-bold text-green-700">{item.formattedNetTime || formatTime(item.netTime || 0)}</td>
                    <td className="px-6 py-4 text-slate-600">{item.formattedTotalTime || formatTime(item.totalTime || 0)}</td>
                    <td className="px-6 py-4 text-amber-600">{item.formattedOverlapTime || formatTime(item.overlapTime || 0)}</td>
                    <td className="px-6 py-4 text-slate-600">{item.logCount || 0}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{item.lastDate || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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

export default ResourceAnalytics;