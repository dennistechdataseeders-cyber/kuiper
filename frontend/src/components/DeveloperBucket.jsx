import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CheckCircle, Clock, AlertCircle, MessageSquare, 
  Layers, Calendar, ChevronDown, ChevronUp, User, ExternalLink, X 
} from 'lucide-react';

const DeveloperBucket = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [revertDetails, setRevertDetails] = useState("");

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/dev/my-bucket', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const sortedData = res.data.sort((a, b) => 
        new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp)
      );
      setTasks(sortedData);
    } catch (error) {
      console.error("Fetch Error:", error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const openCompleteModal = (e, task) => {
    e.stopPropagation();
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleFinalSubmit = async () => {
    if (!revertDetails.trim()) return alert("Please provide a description.");
    
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`http://localhost:5000/api/dev/tasks/${selectedTask._id}`, 
        { 
          status: 'Completed',
          details: revertDetails, // Updates description
          name: "Task Revert"     // Updates the name as requested
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setIsModalOpen(false);
      setRevertDetails("");
      fetchTasks(); 
    } catch (error) {
      alert("Failed to update task");
    }
  };

  return (
    <div className="p-8 ml-64 bg-white min-h-screen font-sans text-slate-900">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-[1000] tracking-tight text-slate-900">Stream</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Operations Hub</p>
        </div>
        <div className="px-4 py-1 bg-slate-50 rounded-full border border-slate-200 text-[11px] font-black flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
          {tasks.filter(t => t.status !== 'Completed').length} ACTIVE
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 italic text-slate-300 font-black text-xs tracking-tighter">SYNCING_DATABASE...</div>
      ) : (
        <div className="max-w-4xl space-y-3">
          {tasks.map((item) => {
            const isExpanded = expandedId === item._id;
            const isCompleted = item.status === 'Completed';
            
            return (
              <div 
                key={item._id} 
                onClick={() => setExpandedId(isExpanded ? null : item._id)}
                className={`group cursor-pointer bg-white border rounded-3xl transition-all duration-500 overflow-hidden ${
                  isExpanded ? 'border-blue-200 shadow-2xl shadow-blue-100/50 scale-[1.01]' : 'border-slate-100 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 overflow-hidden">
                    <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                      {isCompleted ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    </div>
                    <div className="truncate">
                      <h3 className={`text-sm font-black transition-colors ${isExpanded ? 'text-blue-600' : 'text-slate-800'}`}>
                        {item.name || "System Stream"}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        {item.projectId?.name || 'Project'} • {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-slate-300"/> : <ChevronDown size={16} className="text-slate-300"/>}
                </div>

                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-50 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs font-bold text-slate-500 leading-relaxed">
                        {item.details || "No specific details provided for this data stream."}
                      </div>
                      <div className="flex flex-col justify-end">
                        {!isCompleted ? (
                          <button 
                            onClick={(e) => openCompleteModal(e, item)}
                            className="w-full py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                          >
                            Complete Request
                          </button>
                        ) : (
                          <div className="w-full py-3 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center border border-emerald-100">
                            Task Verified
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* COMPLETION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-white overflow-hidden p-8 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900">Task Revert</h2>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Submit Final Report</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Resolution Description</label>
                <textarea 
                  value={revertDetails}
                  onChange={(e) => setRevertDetails(e.target.value)}
                  placeholder="Describe the work performed or findings..."
                  className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                />
              </div>

              <button 
                onClick={handleFinalSubmit}
                className="w-full py-4 bg-slate-900 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-xl shadow-blue-900/10"
              >
                Submit & Close Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperBucket;