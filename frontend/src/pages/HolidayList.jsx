// frontend/src/pages/HolidayList.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import {
    Calendar,
    Plus,
    X,
    Edit2,
    Trash2,
    Search,
    ChevronLeft,
    ChevronRight,
    Loader2,
    CheckCircle,
    AlertCircle,
    Filter,
    RefreshCw,
    CalendarDays,
    Clock,
    Info,
    Eye,
    Download,
    Upload
} from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';

const HolidayList = () => {
    const { isCollapsed } = useSidebar();
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState(null);
    const [formData, setFormData] = useState({
        date: '',
        name: '',
        description: '',
        isOptional: false
    });
    const [submitting, setSubmitting] = useState(false);
    
    // Delete confirmation
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingHoliday, setDeletingHoliday] = useState(null);
    
    // Stats
    const [stats, setStats] = useState({
        total: 0,
        optional: 0,
        upcoming: 0
    });

    const token = localStorage.getItem('token');
    const authHeader = {
        headers: { Authorization: `Bearer ${token}` }
    };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];

    useEffect(() => {
        fetchHolidays();
    }, [selectedYear, selectedMonth]);

    const fetchHolidays = async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `${API_BASE_URL}/api/holidays?year=${selectedYear}&month=${selectedMonth}`,
                authHeader
            );
            
            if (res.data.success) {
                setHolidays(res.data.data);
                calculateStats(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching holidays:', error);
            toast.error('Failed to load holidays');
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (holidayData) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const total = holidayData.length;
        const optional = holidayData.filter(h => h.isOptional).length;
        const upcoming = holidayData.filter(h => new Date(h.date) >= today).length;
        
        setStats({ total, optional, upcoming });
    };

    const openCreateModal = () => {
        setEditingHoliday(null);
        setFormData({
            date: '',
            name: '',
            description: '',
            isOptional: false
        });
        setShowModal(true);
    };

    const openEditModal = (holiday) => {
        setEditingHoliday(holiday);
        const dateObj = new Date(holiday.date);
        const dateStr = dateObj.toISOString().split('T')[0];
        setFormData({
            date: dateStr,
            name: holiday.name,
            description: holiday.description || '',
            isOptional: holiday.isOptional || false
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.date || !formData.name.trim()) {
            toast.error('Date and Holiday name are required');
            return;
        }
        
        setSubmitting(true);
        
        try {
            const payload = {
                date: formData.date,
                name: formData.name.trim(),
                description: formData.description.trim(),
                isOptional: formData.isOptional
            };
            
            let response;
            if (editingHoliday) {
                response = await axios.put(
                    `${API_BASE_URL}/api/holidays/${editingHoliday._id}`,
                    payload,
                    authHeader
                );
                toast.success('Holiday updated successfully');
            } else {
                response = await axios.post(
                    `${API_BASE_URL}/api/holidays`,
                    payload,
                    authHeader
                );
                toast.success('Holiday added successfully');
            }
            
            setShowModal(false);
            fetchHolidays();
            
        } catch (error) {
            console.error('Error saving holiday:', error);
            const errorMessage = error.response?.data?.error || 'Failed to save holiday';
            toast.error(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingHoliday) return;
        
        try {
            await axios.delete(
                `${API_BASE_URL}/api/holidays/${deletingHoliday._id}`,
                authHeader
            );
            toast.success('Holiday deleted successfully');
            setShowDeleteModal(false);
            setDeletingHoliday(null);
            fetchHolidays();
        } catch (error) {
            console.error('Error deleting holiday:', error);
            toast.error('Failed to delete holiday');
        }
    };

    const navigateMonth = (direction) => {
        if (direction === 'prev') {
            if (selectedMonth === 1) {
                setSelectedMonth(12);
                setSelectedYear(selectedYear - 1);
            } else {
                setSelectedMonth(selectedMonth - 1);
            }
        } else {
            if (selectedMonth === 12) {
                setSelectedMonth(1);
                setSelectedYear(selectedYear + 1);
            } else {
                setSelectedMonth(selectedMonth + 1);
            }
        }
    };

    const goToCurrentMonth = () => {
        const now = new Date();
        setSelectedMonth(now.getMonth() + 1);
        setSelectedYear(now.getFullYear());
    };

    const getWeekdayName = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    };

    const formatDateDisplay = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const isToday = (dateStr) => {
        const today = new Date();
        const date = new Date(dateStr);
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    };

    const isPast = (dateStr) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const date = new Date(dateStr);
        return date < today;
    };

    const filteredHolidays = holidays.filter(holiday =>
        holiday.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        holiday.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className={`min-h-screen bg-slate-50 flex items-center justify-center ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
                <div className="text-center">
                    <Loader2 size={48} className="text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Loading holidays...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen bg-slate-50 p-4 md:p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                        Holiday List
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Manage public and optional holidays</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm"
                >
                    <Plus size={18} />
                    Add Holiday
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <CalendarDays size={16} className="text-blue-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Holidays</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Info size={16} className="text-purple-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Optional Holidays</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.optional}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <Clock size={16} className="text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Upcoming</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.upcoming}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Month Navigation */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={goToCurrentMonth}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all"
                        >
                            Today
                        </button>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => navigateMonth('prev')}
                                className="p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                            >
                                <ChevronLeft size={18} className="text-slate-500" />
                            </button>
                            <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center">
                                {monthNames[selectedMonth - 1]} {selectedYear}
                            </span>
                            <button
                                onClick={() => navigateMonth('next')}
                                className="p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                            >
                                <ChevronRight size={18} className="text-slate-500" />
                            </button>
                        </div>
                    </div>
                    
                    <div className="relative w-full md:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search holidays..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 bg-slate-50"
                        />
                    </div>
                </div>
            </div>

            {/* Holiday List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {filteredHolidays.length === 0 ? (
                    <div className="p-12 text-center">
                        <CalendarDays size={48} className="text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No holidays found</p>
                        <p className="text-xs text-slate-400 mt-1">
                            {searchTerm ? 'Try adjusting your search' : 'Add a new holiday to get started'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px]">
                            <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</th>
                                    <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Day</th>
                                    <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Holiday Name</th>
                                    <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Type</th>
                                    <th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredHolidays.map((holiday) => {
                                    const isPastDate = isPast(holiday.date);
                                    const isTodayDate = isToday(holiday.date);
                                    const weekday = getWeekdayName(holiday.date);
                                    const displayDate = formatDateDisplay(holiday.date);
                                    
                                    return (
                                        <tr key={holiday._id} className={`hover:bg-slate-50/60 transition-all ${isTodayDate ? 'bg-blue-50/30' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-bold ${isTodayDate ? 'text-blue-600' : isPastDate ? 'text-slate-400' : 'text-slate-800'}`}>
                                                        {displayDate}
                                                    </span>
                                                    {isTodayDate && (
                                                        <span className="text-[8px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Today</span>
                                                    )}
                                                    {isPastDate && (
                                                        <span className="text-[8px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">Past</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-medium text-slate-600">{weekday}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{holiday.name}</p>
                                                    {holiday.description && (
                                                        <p className="text-xs text-slate-400">{holiday.description}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold ${holiday.isOptional ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {holiday.isOptional ? 'Optional' : 'Public'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openEditModal(holiday)}
                                                        className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setDeletingHoliday(holiday);
                                                            setShowDeleteModal(true);
                                                        }}
                                                        className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-2xl">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {editingHoliday ? 'Update holiday details' : 'Add a new holiday to the calendar'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                                    Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-sm focus:border-blue-400 transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                                    Holiday Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g., Republic Day"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-sm focus:border-blue-400 transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                                    Description (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Additional details about this holiday..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-sm focus:border-blue-400 transition-all resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <input
                                    type="checkbox"
                                    id="isOptional"
                                    checked={formData.isOptional}
                                    onChange={(e) => setFormData({ ...formData, isOptional: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="isOptional" className="text-sm font-medium text-slate-700 cursor-pointer">
                                    Optional Holiday (employees can choose to take it off)
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={18} />
                                        {editingHoliday ? 'Update Holiday' : 'Add Holiday'}
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && deletingHoliday && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                                <AlertCircle size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">Delete Holiday?</h2>
                            <p className="text-sm text-slate-500 mt-2">
                                Are you sure you want to delete "<strong>{deletingHoliday.name}</strong>" on {formatDateDisplay(deletingHoliday.date)}?
                            </p>
                            <p className="text-xs text-slate-400 mt-1">This action cannot be undone.</p>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setDeletingHoliday(null);
                                    }}
                                    className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HolidayList;