// frontend/src/pages/HolidayList.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
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

    useEffect(() => {
        fetchHolidays();
    }, [selectedYear]);

    const fetchHolidays = async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `${API_BASE_URL}/api/holidays?year=${selectedYear}`,
                authHeader
            );
            
            if (res.data.success) {
                // Sort by date
                const sortedData = res.data.data.sort((a, b) => new Date(a.date) - new Date(b.date));
                setHolidays(sortedData);
                calculateStats(sortedData);
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
            
            if (editingHoliday) {
                await axios.put(
                    `${API_BASE_URL}/api/holidays/${editingHoliday._id}`,
                    payload,
                    authHeader
                );
                toast.success('Holiday updated successfully');
            } else {
                await axios.post(
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

    const goToCurrentYear = () => {
        const now = new Date();
        setSelectedYear(now.getFullYear());
        setCurrentPage(1);
    };

    const navigateYear = (direction) => {
        if (direction === 'prev') {
            setSelectedYear(selectedYear - 1);
        } else {
            setSelectedYear(selectedYear + 1);
        }
        setCurrentPage(1);
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

    // Pagination
    const totalPages = Math.ceil(filteredHolidays.length / itemsPerPage);
    const currentHolidays = filteredHolidays.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset to first page when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    if (loading) {
        return (
            <div className="page bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={48} className="text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Loading holidays...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page bg-slate-50">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 sm:mb-6">
                <div>
                    <h1 className="page-title">
                        Holiday List
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Manage public and optional holidays</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="btn btn-md bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                >
                    <Plus size={18} />
                    Add Holiday
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3 mb-4 sm:mb-6 gap-3 sm:gap-4">
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <CalendarDays size={16} className="text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Holidays</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Info size={16} className="text-purple-600" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Optional Holidays</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.optional}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <Clock size={16} className="text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Upcoming</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.upcoming}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Year Navigation & Search */}
            <div className="card mb-4 sm:mb-6">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                        <button
                            onClick={goToCurrentYear}
                            className="btn btn-sm bg-blue-50 text-blue-600 hover:bg-blue-100"
                        >
                            Current Year
                        </button>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => navigateYear('prev')}
                                className="btn-icon hover:bg-slate-100"
                            >
                                <ChevronLeft size={18} className="text-slate-500" />
                            </button>
                            <span className="text-sm font-bold text-slate-700 min-w-[80px] text-center">
                                {selectedYear}
                            </span>
                            <button
                                onClick={() => navigateYear('next')}
                                className="btn-icon hover:bg-slate-100"
                            >
                                <ChevronRight size={18} className="text-slate-500" />
                            </button>
                        </div>
                        <span className="text-xs text-slate-400 sm:ml-2">
                            {holidays.length} holidays
                        </span>
                    </div>
                    
                    <div className="relative w-full lg:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search holidays..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input pl-10 bg-slate-50"
                        />
                    </div>
                </div>
            </div>

            {/* Holiday List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {currentHolidays.length === 0 ? (
                    <div className="p-12 text-center">
                        <CalendarDays size={48} className="text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No holidays found</p>
                        <p className="text-xs text-slate-400 mt-1">
                            {searchTerm ? 'Try adjusting your search' : 'Add a new holiday to get started'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="table-scroll overflow-x-auto">
                            <table className="w-full min-w-[600px]">
                                <thead className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                                    <tr>
                                        <th className="th">#</th>
                                        <th className="th">Date</th>
                                        <th className="th">Day</th>
                                        <th className="th">Holiday Name</th>
                                        <th className="th">Type</th>
                                        <th className="th text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {currentHolidays.map((holiday, index) => {
                                        const isPastDate = isPast(holiday.date);
                                        const isTodayDate = isToday(holiday.date);
                                        const weekday = getWeekdayName(holiday.date);
                                        const displayDate = formatDateDisplay(holiday.date);
                                        const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
                                        
                                        return (
                                            <tr key={holiday._id} className={`hover:bg-slate-50/60 transition-all ${isTodayDate ? 'bg-blue-50/30' : ''}`}>
                                                <td className="td">
                                                    <span className="text-sm font-semibold text-slate-400">{serialNumber}</span>
                                                </td>
                                                <td className="td">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-bold whitespace-nowrap ${isTodayDate ? 'text-blue-600' : isPastDate ? 'text-slate-400' : 'text-slate-800'}`}>
                                                            {displayDate}
                                                        </span>
                                                        {isTodayDate && (
                                                            <span className="badge rounded-full bg-blue-100 text-blue-600">Today</span>
                                                        )}
                                                        {isPastDate && (
                                                            <span className="badge rounded-full bg-slate-100 text-slate-400">Past</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="td">
                                                    <span className="text-sm font-medium text-slate-600">{weekday}</span>
                                                </td>
                                                <td className="td">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800">{holiday.name}</p>
                                                        {holiday.description && (
                                                            <p className="text-xs text-slate-400">{holiday.description}</p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="td">
                                                    <span className={`badge rounded-full ${holiday.isOptional ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {holiday.isOptional ? 'Optional' : 'Public'}
                                                    </span>
                                                </td>
                                                <td className="td">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => openEditModal(holiday)}
                                                            className="btn-icon bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white"
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setDeletingHoliday(holiday);
                                                                setShowDeleteModal(true);
                                                            }}
                                                            className="btn-icon bg-red-50 text-red-600 hover:bg-red-600 hover:text-white"
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
                        
                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs text-slate-500">
                                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredHolidays.length)} of {filteredHolidays.length} holidays
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="btn-icon border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    <span className="text-xs font-semibold text-slate-600 flex items-center px-2">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="btn-icon border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-backdrop">
                    <div className="modal-panel max-w-md">
                        <div className="modal-header">
                            <div>
                                <h2 className="section-title">
                                    {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {editingHoliday ? 'Update holiday details' : 'Add a new holiday to the calendar'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="btn-icon bg-slate-100 hover:bg-slate-200"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-body space-y-4">
                            <div>
                                <label className="label block mb-1.5">
                                    Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="input bg-slate-50"
                                />
                            </div>

                            <div>
                                <label className="label block mb-1.5">
                                    Holiday Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g., Republic Day"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="input bg-slate-50"
                                />
                            </div>

                            <div>
                                <label className="label block mb-1.5">
                                    Description (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Additional details about this holiday..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="input bg-slate-50 resize-none"
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
                                className="btn btn-md w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg disabled:opacity-50"
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
                <div className="modal-backdrop">
                    <div className="modal-panel !overflow-y-auto max-w-sm p-4 sm:p-5">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 shrink-0">
                                <AlertCircle size={32} />
                            </div>
                            <h2 className="section-title">Delete Holiday?</h2>
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
                                    className="btn btn-md flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="btn btn-md flex-1 bg-red-600 text-white hover:bg-red-700"
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