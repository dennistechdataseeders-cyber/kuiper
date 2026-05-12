import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Search,
  Hash,
  ChevronLeft,
  ChevronRight,
  Activity,
  Filter,
  Edit3,
  Users,
  Clock,
  X
} from 'lucide-react';
import API_BASE_URL from '../config';

const weekDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const ProjectFeeds = () => {
  const [projects, setProjects] = useState([]);
  const [feeds, setFeeds] = useState([]);

  // FILTERS
  const [feedTypeFilter, setFeedTypeFilter] = useState('ALL');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // PAGINATION
  const [currentPage, setCurrentPage] = useState(1);
  const feedsPerPage = 10;

  // EDIT MODAL
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFeedId, setEditingFeedId] = useState(null);

  const [feedForm, setFeedForm] = useState({
    name: '',
    assignedDevelopers: [],
    feedType: 'Daily',
    weekDay: ''
  });

  const [developers, setDevelopers] = useState([]);

  const token = localStorage.getItem('token');
  const currentUserId = localStorage.getItem('userId');

  const ADMIN_BASE = `${API_BASE_URL}/api/admin`;

  const authHeader = {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // RESET PAGE
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProject, searchTerm, feedTypeFilter]);

  const fetchData = async () => {
    try {
      const [projectRes, devRes] = await Promise.all([
        axios.get(`${ADMIN_BASE}/projects`, authHeader),
        axios.get(
          `${ADMIN_BASE}/users/developers`,
          authHeader
        )
      ]);

      const allProjects = projectRes.data || [];

      const filteredProjects = allProjects.filter(
        p =>
          p.projectManager?._id === currentUserId ||
          p.projectManager === currentUserId
      );

      // SORT PROJECTS ASCENDING
      filteredProjects.sort((a, b) =>
        (a.projectCustomId || '').localeCompare(
          b.projectCustomId || '',
          undefined,
          {
            numeric: true,
            sensitivity: 'base'
          }
        )
      );

      setProjects(filteredProjects);
      setDevelopers(devRes.data || []);

      // FLATTEN FEEDS
      const allFeeds = filteredProjects.flatMap(project =>
        (project.feeds || []).map(feed => ({
          ...feed,
          projectId: project._id,
          projectName: project.name,
          projectCustomId: project.projectCustomId
        }))
      );

      setFeeds(allFeeds);

    } catch (err) {
      console.error(err);
    }
  };

  // FILTER + SORT
  const filteredFeeds = useMemo(() => {
    let result = [...feeds];

    // PROJECT FILTER
    if (selectedProject !== 'ALL') {
      result = result.filter(
        feed => feed.projectId === selectedProject
      );
    }

    // FEED TYPE FILTER
    if (feedTypeFilter !== 'ALL') {
      result = result.filter(
        feed => feed.feedType === feedTypeFilter
      );
    }

    // SEARCH
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();

      result = result.filter(feed =>
        feed.name?.toLowerCase().includes(search) ||
        feed.projectCustomId
          ?.toLowerCase()
          .includes(search)
      );
    }

    // SORT ASCENDING
    result.sort((a, b) =>
      (a.projectCustomId || '').localeCompare(
        b.projectCustomId || '',
        undefined,
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
    );

    return result;
  }, [
    feeds,
    selectedProject,
    searchTerm,
    feedTypeFilter
  ]);

  // PAGINATION
  const indexOfLastFeed = currentPage * feedsPerPage;

  const indexOfFirstFeed =
    indexOfLastFeed - feedsPerPage;

  const currentFeeds = filteredFeeds.slice(
    indexOfFirstFeed,
    indexOfLastFeed
  );

  const totalPages = Math.ceil(
    filteredFeeds.length / feedsPerPage
  );

  // EDIT FEED
  const handleEditClick = (feed) => {
    setEditingFeedId(feed._id);

    setFeedForm({
      name: feed.name || '',
      assignedDevelopers:
        feed.assignedDevelopers?.map(d =>
          typeof d === 'object' ? d._id : d
        ) || [],
      feedType: feed.feedType || 'Daily',
      weekDay: feed.weekDay || ''
    });

    setShowEditModal(true);
  };

  const closeModal = () => {
    setShowEditModal(false);

    setFeedForm({
      name: '',
      assignedDevelopers: [],
      feedType: 'Daily',
      weekDay: ''
    });

    setEditingFeedId(null);
  };

  const handleUpdateFeed = async (e) => {
    e.preventDefault();

    try {
      await axios.put(
        `${ADMIN_BASE}/feeds/${editingFeedId}`,
        feedForm,
        authHeader
      );

      closeModal();
      fetchData();

    } catch (err) {
      alert('Failed to update feed');
    }
  };

  return (
    <div className="ml-64 p-10 bg-[#F4F7FE] min-h-screen">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black text-[#1B2559]">
            Feed Control Center
          </h1>

          <p className="text-sm font-bold text-slate-400 mt-2">
            Monitor and manage all active feeds
          </p>
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-100 p-4 rounded-3xl border border-slate-100 shadow-sm">
          {/* PROJECT FILTER */}
          <div className="relative">
            <Filter
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <select
              value={selectedProject}
              onChange={(e) =>
                setSelectedProject(e.target.value)
              }
              className="pl-11 pr-10 py-3 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-black text-sm text-slate-700 min-w-[260px]"
            >
              <option value="ALL">
                All Projects
              </option>

              {projects.map(project => (
                <option
                  key={project._id}
                  value={project._id}
                >
                  {project.projectCustomId}
                </option>
              ))}
            </select>
          </div>

          {/* FEED TYPE FILTER */}
          <div className="relative">
            <Clock
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <select
              value={feedTypeFilter}
              onChange={(e) =>
                setFeedTypeFilter(e.target.value)
              }
              className="pl-11 pr-10 py-3 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-black text-sm text-slate-700 min-w-[220px]"
            >
              <option value="ALL">
                All Feed Types
              </option>

              <option value="Daily">
                Daily
              </option>

              <option value="Weekly">
                Weekly
              </option>

              <option value="Once off">
                Once off
              </option>
            </select>
          </div>

          {/* SEARCH */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              placeholder="Search feed..."
              value={searchTerm}
              onChange={(e) =>
                setSearchTerm(e.target.value)
              }
              className="pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold text-sm w-[260px]"
            />
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Activity size={24} />
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Total Feeds
            </p>

            <p className="text-3xl font-black text-[#1B2559]">
              {filteredFeeds.length}
            </p>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-center w-full min-w-[1200px]">
            <thead className="bg-[#F8FAFC] border-b border-slate-100">
              <tr>
                <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Feed
                </th>

                <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Project
                </th>

                <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Feed Type
                </th>

                <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Weekly Day
                </th>

                <th className="text-left px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Developers
                </th>

                <th className="text-right px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {currentFeeds.length > 0 ? (
                currentFeeds.map(feed => (
                  <tr
                    key={feed._id}
                    className="border-b border-slate-50 hover:bg-slate-50/60 transition-all"
                  >
                    {/* FEED */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#111C44] text-white flex items-center justify-center">
                          <Hash size={18} />
                        </div>

                        <div>
                          <p className="text-sm font-black text-[#1B2559]">
                            {feed.name}
                          </p>

                          <p className="text-xs font-bold text-slate-400 mt-1">
                            Feed Stream
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* PROJECT */}
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center gap-2 bg-slate-50 text-slate-700 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100">
                        {feed.projectCustomId}
                      </span>
                    </td>

                    {/* TYPE */}
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100">
                        <Clock size={12} />
                        {feed.feedType}
                      </span>
                    </td>

                    {/* WEEKDAY */}
                    <td className="px-6 py-5">
                      {feed.feedType === 'Weekly' ? (
                        <span className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-100">
                          {feed.weekDay}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-bold text-xs">
                          —
                        </span>
                      )}
                    </td>

                    {/* DEVELOPERS */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <Users
                          size={14}
                          className="text-slate-400"
                        />

                        <span className="text-sm font-black text-[#1B2559]">
                          {feed.assignedDevelopers?.length || 0}
                        </span>
                      </div>
                    </td>

                    {/* ACTIONS */}
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() =>
                            handleEditClick(feed)
                          }
                          className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all"
                        >
                          <Edit3 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="py-24 text-center"
                  >
                    <p className="text-sm font-black uppercase tracking-widest text-slate-300">
                      No feeds found
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="mt-12 flex justify-center items-center gap-3">
          <button
            disabled={currentPage === 1}
            onClick={() =>
              setCurrentPage(prev => prev - 1)
            }
            className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 disabled:opacity-30"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex gap-2 bg-white p-1.5 rounded-[1.5rem] border border-slate-100 shadow-sm">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() =>
                  setCurrentPage(i + 1)
                }
                className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                  currentPage === i + 1
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                    : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button
            disabled={currentPage === totalPages}
            onClick={() =>
              setCurrentPage(prev => prev + 1)
            }
            className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex justify-center items-center z-[120] p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-[#1B2559] tracking-tight">
                Edit Feed
              </h2>

              <button
                onClick={closeModal}
                className="text-slate-300 hover:text-slate-600"
              >
                <X size={28} />
              </button>
            </div>

            <form
              onSubmit={handleUpdateFeed}
              className="space-y-6"
            >
              <input
                type="text"
                required
                placeholder="Feed Name"
                value={feedForm.name}
                onChange={(e) =>
                  setFeedForm({
                    ...feedForm,
                    name: e.target.value
                  })
                }
                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-bold"
              />

              <select
                value={feedForm.feedType}
                onChange={(e) =>
                  setFeedForm({
                    ...feedForm,
                    feedType: e.target.value,
                    weekDay:
                      e.target.value !== 'Weekly'
                        ? ''
                        : feedForm.weekDay
                  })
                }
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-slate-700"
              >
                <option value="Daily">
                  Daily
                </option>

                <option value="Weekly">
                  Weekly
                </option>

                <option value="Once off">
                  Once off
                </option>
              </select>

              {feedForm.feedType === 'Weekly' && (
                <select
                  required
                  value={feedForm.weekDay}
                  onChange={(e) =>
                    setFeedForm({
                      ...feedForm,
                      weekDay: e.target.value
                    })
                  }
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-slate-700"
                >
                  <option value="">
                    Select Day
                  </option>

                  {weekDays.map(day => (
                    <option
                      key={day}
                      value={day}
                    >
                      {day}
                    </option>
                  ))}
                </select>
              )}

              <div className="grid grid-cols-2 gap-3 max-h-52 overflow-y-auto">
                {developers.map(dev => (
                  <label
                    key={dev._id}
                    className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
                      feedForm.assignedDevelopers.includes(
                        dev._id
                      )
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={feedForm.assignedDevelopers.includes(
                        dev._id
                      )}
                      onChange={(e) => {
                        const updated =
                          e.target.checked
                            ? [
                                ...feedForm.assignedDevelopers,
                                dev._id
                              ]
                            : feedForm.assignedDevelopers.filter(
                                id =>
                                  id !== dev._id
                              );

                        setFeedForm({
                          ...feedForm,
                          assignedDevelopers:
                            updated
                        });
                      }}
                    />

                    <span className="text-[10px] font-black uppercase">
                      {dev.name}
                    </span>
                  </label>
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-5 bg-[#111C44] text-white font-black rounded-2xl hover:bg-blue-600 transition-all uppercase text-xs tracking-widest shadow-xl"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectFeeds;