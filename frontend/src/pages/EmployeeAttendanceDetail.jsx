// frontend/src/pages/EmployeeAttendanceDetail.jsx
// ✅ Delegates ALL rendering to AttendanceTimeline — identical to
//    AttendanceCombined / Developer / Employee views.

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSidebar } from '../context/SidebarContext';
import { Search, X, Users, Loader2 } from 'lucide-react';
import API_BASE_URL from '../config';
import toast from 'react-hot-toast';
import AttendanceTimeline from '../components/AttendanceTimeline';

const EmployeeAttendanceDetail = () => {
  const { isCollapsed } = useSidebar();
  const token = localStorage.getItem('token');

  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/hr/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) setEmployees(res.data.employees);
    } catch (err) {
      console.error('Error fetching employees:', err);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !selectedEmployee) {
    return (
      <div className={`min-h-screen bg-slate-50 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="text-center">
          <Loader2 size={40} className="text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 p-4 md:p-6 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
          Employee Attendance Detail
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          View detailed attendance timeline for any employee
        </p>
      </div>

      {/* Employee Selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or employee code..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg outline-none text-sm focus:border-blue-400 bg-slate-50"
              />
              {searchTerm && (
                <button onClick={() => { setSearchTerm(''); setShowDropdown(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {showDropdown && filteredEmployees.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {filteredEmployees.map(emp => (
                  <div key={emp._id}
                    className={`px-4 py-2.5 cursor-pointer hover:bg-blue-50 transition-all flex items-center justify-between ${selectedEmployee?._id === emp._id ? 'bg-blue-50' : ''}`}
                    onClick={() => {
                      setSelectedEmployee(emp);
                      setSearchTerm(emp.name);
                      setShowDropdown(false);
                    }}>
                    <div>
                      <p className="font-semibold text-slate-800">{emp.name}</p>
                      <p className="text-xs text-slate-500">{emp.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-slate-400">{emp.employeeCode || 'N/A'}</p>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{emp.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedEmployee && (
            <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200 flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {selectedEmployee.name?.charAt(0) || '?'}
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">{selectedEmployee.name}</p>
                <p className="text-xs text-slate-500">{selectedEmployee.email}</p>
                <p className="text-[10px] font-mono text-slate-400">Code: {selectedEmployee.employeeCode || 'N/A'}</p>
              </div>
              <button onClick={() => { setSelectedEmployee(null); setSearchTerm(''); }}
                className="ml-2 p-1 rounded-lg hover:bg-blue-100 transition-colors">
                <X size={16} className="text-blue-600" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ✅ AttendanceTimeline handles EVERYTHING (month nav, holidays, stats, table) */}
      {selectedEmployee ? (
        <AttendanceTimeline
          userId={selectedEmployee._id}
          token={token}
          isCollapsed={isCollapsed}
          targetUserId={selectedEmployee._id}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Users size={32} className="text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Select an employee</p>
          <p className="text-xs text-slate-400 mt-1">Search and select an employee to view their attendance timeline</p>
        </div>
      )}
    </div>
  );
};

export default EmployeeAttendanceDetail;