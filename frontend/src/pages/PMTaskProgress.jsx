import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  Users, 
  ListTodo,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Target,
  Calendar
} from 'lucide-react';
import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';
import toast from 'react-hot-toast';

const TASKS_PER_PAGE = 5;

const PMTaskProgress = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/admin/pm/task-progress`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setProjects(res.data);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load task progress data');
    } finally {
      setLoading(false);
    }
  };

  // Filter projects
  const filteredProjects = useMemo(() => {
    if (selectedProject === 'all') return projects;

    return projects.filter(
      project => project._id === selectedProject
    );
  }, [projects, selectedProject]);

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    let totalFeeds = 0;

    filteredProjects.forEach(project => {
      project.feeds.forEach(feed => {
        totalFeeds++;
        feed.tasks.forEach(task => {
          totalTasks++;
          if (task.status === 'Completed') {
            completedTasks++;
          }
        });
      });
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return { totalTasks, completedTasks, totalFeeds, completionRate };
  }, [filteredProjects]);

  // Pagination
  const paginatedProjects = useMemo(() => {
    return filteredProjects.map(project => ({
      ...project,
      feeds: project.feeds.map(feed => {
        const start = (currentPage - 1) * TASKS_PER_PAGE;
        const end = start + TASKS_PER_PAGE;

        return {
          ...feed,
          paginatedTasks: feed.tasks.slice(start, end),
          totalPages: Math.ceil(feed.tasks.length / TASKS_PER_PAGE)
        };
      })
    }));
  }, [filteredProjects, currentPage]);

  const getStatusStyles = status => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'In Progress':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'Completed':
        return <CheckCircle size={12} />;
      case 'In Progress':
        return <Clock size={12} />;
      default:
        return <Target size={12} />;
    }
  };

  const getProgressColor = (progress) => {
    if (progress >= 75) return 'from-emerald-500 to-emerald-600';
    if (progress >= 50) return 'from-blue-500 to-blue-600';
    if (progress >= 25) return 'from-amber-500 to-amber-600';
    return 'from-rose-500 to-rose-600';
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Loading task data...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}
    >
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Task Progress
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-2">
              Monitor feed progress and assigned tasks across all projects
            </p>
          </div>

          {/* Project Dropdown */}
          <div className="w-full lg:w-80">
            <div className="relative">
              <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedProject}
                onChange={(e) => {
                  setSelectedProject(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer appearance-none"
              >
                <option value="all">All Projects</option>
                {projects.map(project => (
                  <option key={project._id} value={project._id}>
                    {project.projectCustomId}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronRight size={16} className="text-slate-400 rotate-90" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Total Projects
                </p>
                <p className="text-2xl font-black text-slate-800 mt-1">
                  {filteredProjects.length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Briefcase size={20} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Active Feeds
                </p>
                <p className="text-2xl font-black text-slate-800 mt-1">
                  {overallStats.totalFeeds}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <ListTodo size={20} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Total Tasks
                </p>
                <p className="text-2xl font-black text-slate-800 mt-1">
                  {overallStats.totalTasks}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Target size={20} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Completion Rate
                </p>
                <p className="text-2xl font-black text-emerald-600 mt-1">
                  {overallStats.completionRate}%
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Projects Section */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Briefcase size={32} className="text-slate-300" />
          </div>
          <p className="text-base font-bold text-slate-500">No projects found</p>
          <p className="text-sm text-slate-400 mt-1">Try selecting a different filter</p>
        </div>
      ) : (
        <div className="space-y-6">
          {paginatedProjects.map(project => (
            <div
              key={project._id}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-300"
            >
              {/* Project Header */}
              <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center">
                      <Briefcase size={14} />
                    </div>
                    <h2 className="text-base font-bold text-slate-800">
                      {project.projectCustomId}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {project.feeds.length} Feeds
                    </span>
                  </div>
                </div>
              </div>

              {/* Feeds Section */}
              <div className="p-6 space-y-5">
                {project.feeds.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-slate-400">No feeds available</p>
                  </div>
                ) : (
                  project.feeds.map(feed => (
                    <div
                      key={feed._id}
                      className="border border-slate-200 rounded-2xl p-5 bg-white hover:border-slate-300 transition-all duration-300"
                    >
                      {/* Feed Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <h3 className="text-base font-bold text-slate-800">
                              {feed.name}
                            </h3>
                          </div>
                          <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <ListTodo size={10} />
                            {feed.tasks.length} Tasks
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-2xl font-black bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                            {feed.progress}%
                          </p>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Complete
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-5">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5">
                          <span>Progress</span>
                          <span>{feed.progress}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${getProgressColor(feed.progress)} rounded-full transition-all duration-500 ease-out`}
                            style={{ width: `${feed.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Tasks List */}
                      <div className="space-y-3">
                        {feed.paginatedTasks.length === 0 ? (
                          <div className="text-center py-6">
                            <p className="text-xs text-slate-400">No tasks on this page</p>
                          </div>
                        ) : (
                          feed.paginatedTasks.map(task => (
                            <div
                              key={task._id}
                              className="group border border-slate-100 rounded-xl p-4 bg-slate-50 hover:bg-white hover:shadow-md hover:border-slate-200 transition-all duration-300"
                            >
                              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                {/* Task Details */}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                      task.status === 'Completed' ? 'bg-emerald-500' :
                                      task.status === 'In Progress' ? 'bg-blue-500' : 'bg-amber-500'
                                    }`} />
                                    <p className="text-sm font-bold text-slate-800">
                                      {task.name || 'Task'}
                                    </p>
                                  </div>
                                  <p className="text-xs text-slate-600 leading-relaxed">
                                    {task.details}
                                  </p>
                                </div>

                                {/* Task Metadata */}
                                <div className="flex flex-row lg:flex-col items-center lg:items-end gap-3 lg:gap-1.5">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${getStatusStyles(task.status)}`}
                                  >
                                    {getStatusIcon(task.status)}
                                    {task.status}
                                  </span>
                                  
                                  {task.targetUsers && task.targetUsers.length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <Users size={10} className="text-slate-400" />
                                      <p className="text-[10px] font-semibold text-slate-500">
                                        {task.targetUsers.map(user => user.name).join(', ')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Pagination */}
                      {feed.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-3 mt-5 pt-3 border-t border-slate-100">
                          <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                              currentPage === 1
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                            }`}
                          >
                            <ChevronLeft size={14} />
                            Previous
                          </button>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600">
                              Page {currentPage}
                            </span>
                            <span className="text-xs text-slate-400">of</span>
                            <span className="text-xs font-bold text-slate-600">
                              {feed.totalPages}
                            </span>
                          </div>

                          <button
                            disabled={currentPage === feed.totalPages}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                              currentPage === feed.totalPages
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                            }`}
                          >
                            Next
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PMTaskProgress;