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
  BarChart3
} from 'lucide-react';

import API_BASE_URL from '../config';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import html2canvas from 'html2canvas';

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
    return `${hrs}h ${mins}m`;
  };

  const formatTimeDetailed = (seconds = 0) => {
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

      setAnalytics(Array.isArray(res.data.analyticsData) ? res.data.analyticsData : []);
      setProjects(Array.isArray(res.data.projects) ? res.data.projects : []);
      setFeeds(Array.isArray(res.data.feeds) ? res.data.feeds : []);
      setDevelopers(Array.isArray(res.data.developers) ? res.data.developers : []);

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
  AGGREGATED DATA (ACCUMULATED BY FEED)
  ========================================
  */

  const aggregatedData = useMemo(() => {
    // Group by feed ID to accumulate total time
    const feedMap = new Map();

    analytics.forEach(item => {
      const feedId = item.feed?._id;
      const feedName = item.feed?.name || 'Unknown';
      const projectName = item.project?.name || 'Unknown';
      const developerName = item.developer?.name || 'Unknown';
      const totalHours = Number(((item.totalTime || 0) / 3600).toFixed(2));

      if (!feedMap.has(feedId)) {
        feedMap.set(feedId, {
          feedId: feedId,
          feedName: feedName,
          projectName: projectName,
          developerName: developerName,
          totalTime: 0,
          totalHours: 0,
          description: item.description || '',
          lastDate: item.date || ''
        });
      }

      const existing = feedMap.get(feedId);
      existing.totalTime += item.totalTime || 0;
      existing.totalHours += totalHours;
      if (item.date > existing.lastDate) {
        existing.lastDate = item.date;
      }
    });

    // Convert map to array
    let result = Array.from(feedMap.values()).map(item => ({
      ...item,
      totalHours: Number(item.totalHours.toFixed(2))
    }));

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.feedName.toLowerCase().includes(search) ||
        item.projectName.toLowerCase().includes(search) ||
        item.developerName.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      if (sortType === 'highest') {
        return b.totalTime - a.totalTime;
      }
      return a.totalTime - b.totalTime;
    });

    return result;
  }, [analytics, searchTerm, sortType]);

  /*
  ========================================
  TOTAL TIME
  ========================================
  */

  const totalSeconds = aggregatedData.reduce((acc, item) => acc + (item.totalTime || 0), 0);

  /*
  ========================================
  CHART DATA (USING AGGREGATED DATA)
  ========================================
  */

  const chartLabels = aggregatedData.map(item => item.feedName);
  const chartValues = aggregatedData.map(item => item.totalHours);
  
  // Create a map for tooltip data
  const feedMetadata = aggregatedData.reduce((acc, item, index) => {
    acc[index] = {
      feedName: item.feedName,
      projectName: item.projectName,
      developerName: item.developerName,
      totalHours: item.totalHours,
      totalTimeFormatted: formatTime(item.totalTime)
    };
    return acc;
  }, {});

  const pieData = {
    labels: chartLabels,
    datasets: [{
      label: 'Hours',
      data: chartValues,
      backgroundColor: chartLabels.map((_, index) => chartColors[index % chartColors.length]),
      borderWidth: 1
    }]
  };

  const barData = {
    labels: chartLabels,
    datasets: [{
      label: 'Hours Spent',
      data: chartValues,
      backgroundColor: chartLabels.map((_, index) => chartColors[index % chartColors.length]),
      borderRadius: 8
    }]
  };

  // Custom tooltip for Pie Chart
  const pieTooltipOptions = {
    responsive: true,
    animation: false,
    maintainAspectRatio: true,
    plugins: {
      tooltip: {
        callbacks: {
          title: function(context) {
            const index = context[0].dataIndex;
            const metadata = feedMetadata[index];
            return metadata?.feedName || context[0].label;
          },
          label: function(context) {
            const index = context.dataIndex;
            const metadata = feedMetadata[index];
            const hours = context.raw;
            const percentage = ((hours / chartValues.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
            
            return [
              `  Hours: ${hours} hrs (${percentage}%)`,
              `  Project: ${metadata?.projectName || 'Unknown'}`,
              `  Developer: ${metadata?.developerName || 'Unknown'}`
            ];
          }
        }
      },
      legend: {
        position: 'bottom',
        labels: { 
          font: { size: 10 }, 
          boxWidth: 10,
          generateLabels: function(chart) {
            const original = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
            original.forEach(label => {
              if (label.text.length > 30) {
                label.text = label.text.substring(0, 27) + '...';
              }
            });
            return original;
          }
        }
      }
    }
  };

  // Custom tooltip for Bar Chart
  const barTooltipOptions = {
    responsive: true,
    animation: false,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          title: function(context) {
            const index = context[0].dataIndex;
            const metadata = feedMetadata[index];
            return metadata?.feedName || context[0].label;
          },
          label: function(context) {
            const index = context.dataIndex;
            const metadata = feedMetadata[index];
            const hours = context.raw;
            
            return [
              `  Hours: ${hours} hrs`,
              `  Project: ${metadata?.projectName || 'Unknown'}`,
              `  Developer: ${metadata?.developerName || 'Unknown'}`
            ];
          }
        }
      },
      legend: {
        position: 'bottom',
        labels: { 
          font: { size: 10 }, 
          boxWidth: 10
        }
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'Hours Spent',
          font: { size: 10, weight: 'bold' }
        }
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          font: { size: 9 }
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
      pdf.text('Resource Analytics Report', 14, 20);

      pdf.setDrawColor(220, 220, 220);
      pdf.line(14, 24, 195, 24);

      pdf.setFontSize(11);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`Start Date: ${startDate}`, 14, 35);
      pdf.text(`End Date: ${endDate}`, 14, 42);
      pdf.text(`Total Time: ${formatTime(totalSeconds)}`, 14, 49);
      pdf.text(`Total Feeds: ${aggregatedData.length}`, 14, 56);

      // Capture pie chart
      if (pieChartRef.current) {
        try {
          const pieCanvas = pieChartRef.current.querySelector('canvas');
          if (pieCanvas) {
            const pieImgData = pieCanvas.toDataURL('image/png');
            pdf.setFontSize(16);
            pdf.text('Feed Distribution', 14, 70);
            pdf.addImage(pieImgData, 'PNG', 14, 75, 80, 60);
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
            pdf.text('Feed Comparison', 105, 70);
            pdf.addImage(barImgData, 'PNG', 105, 75, 85, 60);
          }
        } catch (err) {
          console.error('Bar chart capture error:', err);
        }
      }

      // Table with aggregated data
      autoTable(pdf, {
        startY: 150,
        head: [['Feed', 'Project', 'Developer', 'Total Time', 'Last Activity']],
        body: aggregatedData.map(item => [
          item.feedName,
          item.projectName,
          item.developerName,
          formatTime(item.totalTime),
          item.lastDate || '-'
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235] }
      });

      document.body.removeChild(pdfContainer);
      pdf.save(`resource-analytics-${Date.now()}.pdf`);

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
          <h1 className="text-4xl font-black">Resource Analytics</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-600 font-black mt-2">
            Project Time Monitoring
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
              <option value="highest">Most Time</option>
              <option value="lowest">Least Time</option>
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
          <p className="text-xs uppercase font-black text-slate-400">Total Time</p>
          <h2 className="text-3xl font-black mt-2">{formatTime(totalSeconds)}</h2>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border">
          <p className="text-xs uppercase font-black text-slate-400">Total Feeds</p>
          <h2 className="text-3xl font-black mt-2">{aggregatedData.length}</h2>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border">
          <p className="text-xs uppercase font-black text-slate-400">Total Records</p>
          <h2 className="text-3xl font-black mt-2">{analytics.length}</h2>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border">
          <p className="text-xs uppercase font-black text-slate-400">Developers</p>
          <h2 className="text-3xl font-black mt-2">{developers.length}</h2>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* PIE CHART */}
        <div ref={pieChartRef} className="bg-white p-4 rounded-[2rem] border lg:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="text-blue-600" size={20} />
            <h2 className="text-lg font-black">Feed Distribution (Accumulated)</h2>
          </div>
          <div className="max-w-xs mx-auto">
            <Pie data={pieData} options={pieTooltipOptions} />
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-3">
            Hover on segments to see project & developer details
          </p>
        </div>

        {/* BAR CHART */}
        <div ref={barChartRef} className="bg-white p-4 rounded-[2rem] border lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="text-blue-600" size={20} />
            <h2 className="text-lg font-black">Feed Comparison (Accumulated)</h2>
          </div>
          <div className="h-80">
            <Bar data={barData} options={barTooltipOptions} />
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-3">
            Hover on bars to see project & developer details
          </p>
        </div>
      </div>

      {/* TABLE - AGGREGATED VIEW */}
      <div className="bg-white rounded-[2rem] border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Feed</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Project</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Developer</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Total Time</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {aggregatedData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No data found for the selected filters
                  </td>
                </tr>
              ) : (
                aggregatedData.map((item, index) => (
                  <tr key={item.feedId || index} className="border-t hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium">{item.feedName}</td>
                    <td className="px-6 py-4">{item.projectName}</td>
                    <td className="px-6 py-4">{item.developerName}</td>
                    <td className="px-6 py-4 font-bold text-blue-700">{formatTime(item.totalTime)}</td>
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