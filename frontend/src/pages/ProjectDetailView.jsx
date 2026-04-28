import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { ChevronRight, Code, Terminal, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config';

const ProjectDetailView = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      const token = localStorage.getItem('token');
      const headers = { headers: { Authorization: `Bearer ${token}` } };
      try {
        const [projRes, feedRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/projects/${id}`, headers),
          axios.get(`${API_BASE_URL}/api/dev/my-feeds`, headers) // Filtered by dev ID on backend
        ]);
        setProject(projRes.data);
        // Only show feeds belonging to THIS project
        setFeeds(feedRes.data.filter(f => f.projectId._id === id));
      } catch (err) {
        toast.error("Error loading project details");
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const updateStatus = async (feedId, newStatus) => {
    const token = localStorage.getItem('token');
    try {
      await axios.patch(`${API_BASE_URL}/api/dev/feeds/${feedId}/status`, 
        { status: newStatus }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Updated to ${newStatus}`);
      // Refresh local state
      setFeeds(feeds.map(f => f._id === feedId ? { ...f, status: newStatus } : f));
    } catch (err) {
      toast.error("Update failed");
    }
  };

  if (loading) return <div className="lg:ml-64 p-10 font-bold text-slate-400">Loading Environment...</div>;

  return (
    <div className="lg:ml-64 p-8 bg-[#fdfdfd] min-h-screen">
      {/* HEADER */}
      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
        <span>Projects</span> <ChevronRight size={12}/> <span>{project?.projectCustomId}</span>
      </div>
      <h1 className="text-4xl font-black text-slate-900 mb-2">{project?.name}</h1>
      <p className="text-slate-500 max-w-2xl mb-10">{project?.description}</p>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* LEFT COLUMN: ASSIGNED FEEDS & STEPS */}
        <div className="xl:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Terminal size={20} className="text-blue-600"/> Assigned Technical Feeds
          </h2>
          
          {feeds.map((feed) => (
            <div key={feed._id} className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-800">{feed.name}</h3>
                  <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-md uppercase">
                    {feed.feedType}
                  </span>
                </div>
                
                {/* STATUS SELECTOR */}
                <select 
                  value={feed.status || 'Pending'}
                  onChange={(e) => updateStatus(feed._id, e.target.value)}
                  className={`text-xs font-black p-2 rounded-xl border-none outline-none ring-1 ring-slate-100 cursor-pointer ${
                    feed.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 
                    feed.status === 'In Progress' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </div>

              {/* DYNAMIC STEPS / PATH SECTION */}
              <div className="bg-slate-900 rounded-2xl p-6 text-slate-300 font-mono text-sm relative overflow-hidden">
                <div className="flex items-center gap-2 mb-4 text-slate-500 text-xs font-bold uppercase">
                  <Code size={14}/> Implementation Path
                </div>
                <div className="space-y-3 relative z-10">
                  {/* Assuming your feed object has a "steps" array or string */}
                  {feed.steps ? (
                    feed.steps.split(',').map((step, index) => (
                      <div key={index} className="flex gap-3">
                        <span className="text-blue-500 font-bold">{index + 1}.</span>
                        <span>{step.trim()}</span>
                      </div>
                    ))
                  ) : (
                    <p className="italic text-slate-600">// No specific steps defined for this feed.</p>
                  )}
                </div>
                <div className="absolute top-0 right-0 p-4 opacity-5">
                   <Terminal size={100}/>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT COLUMN: PROJECT INTEL */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl">
            <h3 className="font-black text-xs uppercase tracking-[0.2em] opacity-50 mb-6">Project Metadata</h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Clock className="text-blue-400" size={20}/>
                <div>
                  <p className="text-[10px] font-bold opacity-40 uppercase">Started</p>
                  <p className="text-sm font-bold">{new Date(project?.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <AlertCircle className="text-amber-400" size={20}/>
                <div>
                  <p className="text-[10px] font-bold opacity-40 uppercase">Priority</p>
                  <p className="text-sm font-bold">High Priority Deployment</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailView;