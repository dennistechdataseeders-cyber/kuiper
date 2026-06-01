import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const CreateTicket = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    projectId: '',
    feedId: ''
  });
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isCollapsed } = useSidebar();
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');
  const currentUserId = localStorage.getItem('userId');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/admin/client-projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProjects(res.data);
      setFilteredProjects(res.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
      setFilteredProjects([]);
    }
  };

  const fetchFeeds = async (projectId) => {
    if (!projectId) {
      setFeeds([]);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tickets/feeds/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeeds(res.data);
    } catch (error) {
      console.error('Error fetching feeds:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.projectId) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/tickets`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Ticket created successfully!');
      navigate('/tickets');
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast.error(error.response?.data?.error || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  const getProjectDisplayName = (project) => {
    return project.projectCustomId || project.name;
  };

  if (userRole === 'Client' && filteredProjects.length === 0 && projects.length === 0) {
    return (
      <div className={`min-h-screen bg-gray-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="mb-8">
          <button
            onClick={() => navigate('/tickets')}
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Tickets
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900">Create New Ticket</h1>
          <p className="text-gray-600 mt-1">Submit a support request for your project</p>
        </div>

        <div className="max-w-2xl">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                <ArrowLeft size={32} className="text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-yellow-800">No Projects Assigned</h3>
              <p className="text-yellow-700">
                You don't have any projects assigned to you yet. 
                Please contact your project manager to get assigned to a project before creating tickets.
              </p>
              <button
                onClick={() => navigate('/tickets')}
                className="mt-4 px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Back to Tickets
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/tickets')}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Tickets
        </button>
        
        <h1 className="text-3xl font-bold text-gray-900">Create New Ticket</h1>
        <p className="text-gray-600 mt-1">Submit a support request for your project</p>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Brief summary of the issue"
              />
            </div>
            
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                required
                rows={5}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Detailed description of the problem..."
              />
            </div>
            
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority *
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            
            {/* Project */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project *
              </label>
              <select
                required
                value={formData.projectId}
                onChange={(e) => {
                  setFormData({ ...formData, projectId: e.target.value, feedId: '' });
                  fetchFeeds(e.target.value);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Select a project</option>
                {filteredProjects.map(project => (
                  <option key={project._id} value={project._id}>
                    {getProjectDisplayName(project)}
                    {userRole === 'Client' ? ' (Your Project)' : ''}
                  </option>
                ))}
              </select>
              
              {/* Show message if no projects available */}
              {filteredProjects.length === 0 && (
                <p className="text-sm text-amber-600 mt-2">
                  {userRole === 'Client' 
                    ? "You don't have any projects assigned. Please contact your project manager."
                    : "No projects available. Create a project first."}
                </p>
              )}
            </div>
            
            {/* Feed (Optional) */}
            {feeds.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Related Feed (Optional)
                </label>
                <select
                  value={formData.feedId}
                  onChange={(e) => setFormData({ ...formData, feedId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Select a feed (optional)</option>
                  {feeds.map(feed => (
                    <option key={feed._id} value={feed._id}>
                      {feed.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || filteredProjects.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                'Creating...'
              ) : (
                <>
                  <Send size={18} />
                  Create Ticket
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTicket;