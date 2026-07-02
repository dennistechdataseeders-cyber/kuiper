// frontend/src/pages/ClientFeedDetails.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, AlertCircle, Loader2 } from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const ClientFeedDetails = () => {
  const { feedId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    if (feedId) {
      fetchFeedDetails();
    }
  }, [feedId]);

  const fetchFeedDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const effectiveFeedId = feedId || location.state?.feedId;
      
      if (!effectiveFeedId) {
        toast.error('No feed ID provided');
        setLoading(false);
        return;
      }

      console.log('Fetching feed details for ID:', effectiveFeedId);
      
      const res = await axios.get(`${API_BASE_URL}/api/client/feeds/${effectiveFeedId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Feed details response:', res.data);
      
      const feedData = {
        ...res.data,
        feed_name: res.data.feed_name || res.data.name || 'Unnamed Feed',
        _id: res.data._id || effectiveFeedId,
        status: res.data.status || res.data.feedStatus || 'Pending',
        progress: res.data.progress || 0,
        stages: res.data.stages || {},
        failed: res.data.failed || false,
        error_message: res.data.error_message || '',
        updated_at: res.data.updated_at || res.data.updatedAt || res.data.created_at || res.data.createdAt,
        projectName: res.data.projectName || res.data.project || 'Unknown Project',
        projectCustomId: res.data.projectCustomId || res.data.projectCustomId,
        projectId: res.data.projectId
      };
      
      console.log('Transformed feed:', feedData);
      setFeed(feedData);
    } catch (error) {
      console.error('Error fetching feed details:', error);
      
      if (error.response?.status !== 404) {
        toast.error(error.response?.data?.error || 'Failed to load feed details');
      }
      
      if (error.response?.status === 404) {
        setFeed(null);
        toast.error('Feed not found. Redirecting...');
        setTimeout(() => {
          navigate('/client');
        }, 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading feed details...</p>
        </div>
      </div>
    );
  }

  if (!feed) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <p className="text-gray-600 font-medium">Feed not found</p>
          <p className="text-sm text-gray-400 mt-1">The feed you're looking for doesn't exist or has been removed</p>
          <button 
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/client');
              }
            }}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const totalStages = 6; // Total number of stages
  const completedStagesCount = Object.values(feed.stages || {}).filter(s => s?.completed === true).length;
  const calculatedProgress = Math.round((completedStagesCount / totalStages) * 100);
  const displayProgress = feed.progress || calculatedProgress;

  // Determine progress bar color
  const getProgressColor = () => {
    if (feed.failed) return 'bg-red-500';
    if (displayProgress === 100) return 'bg-green-500';
    return 'bg-blue-500';
  };

  return (
    <div className={`min-h-screen bg-slate-50 p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Back Button */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => {
            const projectId = feed.projectId?._id || feed.projectId;
            if (projectId) {
              navigate(`/client/projects/${projectId}/feeds`, { 
                state: { 
                  projectId: projectId, 
                  projectName: feed.projectCustomId || feed.projectName
                } 
              });
            } else {
              navigate('/client');
            }
          }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="font-medium">Back to Feeds</span>
        </button>
      </div>

      {/* Feed Name Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{feed.feed_name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {feed.projectCustomId || feed.projectName || 'Unknown Project'}
        </p>
      </div>

      {/* Progress Bar Only */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Progress</h2>
          <span className="text-2xl font-bold text-blue-600">{displayProgress}%</span>
        </div>
        
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
            style={{ width: `${Math.min(displayProgress, 100)}%` }}
          />
        </div>
        
        <div className="mt-3 text-sm text-slate-500">
          Last updated: {feed.updated_at ? new Date(feed.updated_at).toLocaleString() : 'N/A'}
        </div>
        
        {feed.failed && feed.error_message && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">Error: {feed.error_message}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientFeedDetails;