import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Plus,
  X,
  Globe,
  Phone,
  User,
  Mail,
  Pencil,
  Trash2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUpDown,
  Filter,
  Target,
  Loader2,
  AlertCircle,
  Users,
  UserPlus
} from 'lucide-react';

import API_BASE_URL from '../config';
import { useSidebar } from '../context/SidebarContext';

const Organizations = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isCollapsed } = useSidebar();

  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [expandedRow, setExpandedRow] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Search and Sort States
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('companyName');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Convert to Lead States
  const [convertToLead, setConvertToLead] = useState(false);
  const [converting, setConverting] = useState(false);

  // Company Search/Duplicate Detection
  const [similarCompanies, setSimilarCompanies] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);

  // POC Management
  const [pointsOfContact, setPointsOfContact] = useState([]);
  const [showPOCModal, setShowPOCModal] = useState(false);
  const [editingPOCIndex, setEditingPOCIndex] = useState(null);
  const [pocForm, setPocForm] = useState({
    pocName: '',
    pocEmail: '',
    pocPhone: '',
    linkedin: '',
    isPrimary: false,
    department: 'Other'
  });

  // ROLE
  const userRole = localStorage.getItem('role');
  const canModify =
    userRole === 'Admin' ||
    userRole === 'Sales Manager' ||
    userRole === 'Sales';

  const [formData, setFormData] = useState({
    companyName: '',
    website: '',
    address: ''
  });

  useEffect(() => {
    if (location.state?.convertedLead) {
      const data = location.state.convertedLead;
      setFormData({
        companyName: data.companyName || '',
        website: data.website || '',
        address: data.address || ''
      });
      setPointsOfContact([{
        pocName: data.pocName || '',
        pocEmail: data.pocEmail || '',
        pocPhone: data.pocPhone || '',
        linkedin: data.linkedin || '',
        isPrimary: true,
        department: 'Other'
      }]);
      setIsModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    fetchOrgs();
  }, []);

  const fetchOrgs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/orgs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = Array.isArray(res.data) ? res.data : res.data.leads || [];
      setOrgs(data);
    } catch (err) {
      console.error('Error fetching organizations:', err);
      toast.error('Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  // Check if company already exists and get suggestions
  const checkExistingCompany = async (companyName) => {
    if (!companyName.trim() || companyName.length < 2) {
      setSimilarCompanies([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/orgs/check-existing?companyName=${encodeURIComponent(companyName)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.exists && res.data.suggestions && res.data.suggestions.length > 0) {
        setSimilarCompanies(res.data.suggestions);
        setShowSuggestions(true);
      } else {
        setSimilarCompanies([]);
        setShowSuggestions(false);
      }
    } catch (err) {
      console.error('Company check error:', err);
      setSimilarCompanies([]);
      setShowSuggestions(false);
    }
  };

  const handleCompanyNameChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, companyName: value });
    
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      checkExistingCompany(value);
    }, 500);
    setSearchTimeout(timeout);
  };

  const selectExistingCompany = (company) => {
    setFormData({
      companyName: company.companyName,
      website: company.website || '',
      address: company.address || ''
    });
    setPointsOfContact(company.pointsOfContact || []);
    setEditingId(company._id);
    setShowSuggestions(false);
    setSimilarCompanies([]);
    toast.success(`Loaded existing company: ${company.companyName}`);
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const openEditModal = (org) => {
    setEditingId(org._id);
    setConvertToLead(false);
    setSimilarCompanies([]);
    setShowSuggestions(false);
    setFormData({
      companyName: org.companyName || '',
      website: org.website || '',
      address: org.address || ''
    });
    setPointsOfContact(org.pointsOfContact || []);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingId(null);
    setConvertToLead(false);
    setConverting(false);
    setSimilarCompanies([]);
    setShowSuggestions(false);
    setPointsOfContact([]);
    setFormData({
      companyName: '',
      website: '',
      address: ''
    });
    setShowPOCModal(false);
    setEditingPOCIndex(null);
    if (searchTimeout) clearTimeout(searchTimeout);
    setIsModalOpen(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this organization?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/orgs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Organization deleted successfully');
      fetchOrgs();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete organization');
    }
  };

  // POC Management Functions
  const openPOCModal = (index = null) => {
    if (index !== null) {
      setEditingPOCIndex(index);
      setPocForm(pointsOfContact[index]);
    } else {
      setEditingPOCIndex(null);
      setPocForm({
        pocName: '',
        pocEmail: '',
        pocPhone: '',
        linkedin: '',
        isPrimary: pointsOfContact.length === 0,
        department: 'Other'
      });
    }
    setShowPOCModal(true);
  };

  const savePOC = () => {
    if (!pocForm.pocName.trim()) {
      toast.error('POC Name is required');
      return;
    }

    let newPOCs = [...pointsOfContact];
    
    if (editingPOCIndex !== null) {
      newPOCs[editingPOCIndex] = pocForm;
    } else {
      newPOCs.push(pocForm);
    }

    // Ensure only one primary POC
    let hasPrimary = false;
    newPOCs = newPOCs.map(poc => {
      if (poc.isPrimary) {
        if (hasPrimary) {
          return { ...poc, isPrimary: false };
        }
        hasPrimary = true;
        return poc;
      }
      return poc;
    });

    // If no primary was set and we're adding a new POC with isPrimary true
    if (pocForm.isPrimary && !hasPrimary) {
      // Already handled above
    } else if (!hasPrimary && newPOCs.length > 0) {
      // Set first POC as primary if none exists
      newPOCs[0].isPrimary = true;
    }

    setPointsOfContact(newPOCs);
    setShowPOCModal(false);
    setEditingPOCIndex(null);
    setPocForm({
      pocName: '',
      pocEmail: '',
      pocPhone: '',
      linkedin: '',
      isPrimary: false,
      department: 'Other'
    });
    toast.success('Contact saved successfully');
  };

  const removePOC = (index) => {
    if (window.confirm('Remove this contact?')) {
      const newPOCs = pointsOfContact.filter((_, i) => i !== index);
      setPointsOfContact(newPOCs);
      toast.success('Contact removed');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.companyName.trim()) {
      toast.error('Company Name is required');
      return;
    }

    if (pointsOfContact.length === 0) {
      toast.error('Please add at least one Point of Contact');
      return;
    }

    try {
      setConverting(true);
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const payload = {
        companyName: formData.companyName,
        website: formData.website,
        address: formData.address,
        pointsOfContact: pointsOfContact
      };

      let savedOrg;
      
      if (editingId) {
        await axios.put(`${API_BASE_URL}/api/orgs/${editingId}`, payload, config);
        savedOrg = { ...payload, _id: editingId };
        toast.success('Organization updated successfully');
      } else {
        const response = await axios.post(`${API_BASE_URL}/api/orgs`, payload, config);
        savedOrg = response.data;
        toast.success('Organization created successfully');
      }

      fetchOrgs();

      if (convertToLead && savedOrg && !editingId) {
        const primaryPOC = pointsOfContact.find(p => p.isPrimary) || pointsOfContact[0];
        const leadPayload = {
          leadType: 'Inbound',
          organizationId: savedOrg._id,
          pocName: primaryPOC.pocName,
          pocPhone: primaryPOC.pocPhone,
          pocEmail: primaryPOC.pocEmail,
          referredBy: ''
        };
        
        try {
          await axios.post(`${API_BASE_URL}/api/lead-generation`, leadPayload, config);
          toast.success('Lead generated successfully!');
          closeModal();
          navigate('/sales/lead-generation');
        } catch (leadErr) {
          console.error('Lead generation failed:', leadErr);
          toast.error('Organization saved but lead generation failed');
          closeModal();
        }
      } else {
        closeModal();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error saving organization');
    } finally {
      setConverting(false);
    }
  };

  // Search and Sort Logic
  const filteredAndSortedOrgs = useMemo(() => {
    let result = [...orgs];

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(org =>
        org.companyName?.toLowerCase().includes(search) ||
        org.pointsOfContact?.some(p => p.pocName?.toLowerCase().includes(search)) ||
        org.pointsOfContact?.some(p => p.pocEmail?.toLowerCase().includes(search))
      );
    }

    result.sort((a, b) => {
      let aVal = a.companyName || '';
      let bVal = b.companyName || '';a

      if (sortOrder === 'asc') {
        return aVal.toString().localeCompare(bVal.toString());
      } else {
        return bVal.toString().localeCompare(aVal.toString());
      }
    });

    return result;
  }, [orgs, searchTerm, sortField, sortOrder]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentOrgs = filteredAndSortedOrgs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAndSortedOrgs.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setShowSortDropdown(false);
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-slate-400" />;
    return sortOrder === 'asc' ? <ChevronUp size={12} className="text-blue-600" /> : <ChevronDown size={12} className="text-blue-600" />;
  };

  const getDepartmentColor = (dept) => {
    switch(dept) {
      case 'CEO': return 'bg-purple-100 text-purple-700';
      case 'CTO': return 'bg-blue-100 text-blue-700';
      case 'Sales': return 'bg-emerald-100 text-emerald-700';
      case 'Marketing': return 'bg-pink-100 text-pink-700';
      case 'Support': return 'bg-amber-100 text-amber-700';
      case 'Developer': return 'bg-blue-500 text-white';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
      <div className="p-6 md:p-8">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Organizations
            </h1>
            <p className="text-slate-500 font-medium mt-1 flex items-center gap-2">
              <CheckCircle size={16} className="text-blue-500" />
              {filteredAndSortedOrgs.length} Registered Entities
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by company or contact..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-11 pr-4 py-3 bg-white rounded-xl border border-slate-200 outline-none font-medium text-sm text-slate-700 focus:border-blue-400 transition-colors"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-5 py-3 bg-white rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-all"
              >
                <Filter size={16} />
                Sort by: {sortField === 'companyName' ? 'Organization' : 'Contact'}
                {getSortIcon(sortField)}
              </button>
              
              {showSortDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={() => handleSort('companyName')}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50 flex items-center justify-between"
                  >
                    Sort by Organization
                    {getSortIcon('companyName')}
                  </button>
                  <button
                    onClick={() => handleSort('pocName')}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50 flex items-center justify-between border-t border-slate-100"
                  >
                    Sort by Contact
                    {getSortIcon('pocName')}
                  </button>
                </div>
              )}
            </div>

            {canModify && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-wider text-[10px] shadow-lg shadow-blue-100 transition-all active:scale-95"
              >
                <Plus size={16} strokeWidth={3} />
                New Entry
              </button>
            )}
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white/80 rounded-2xl shadow-xl border border-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Primary Contact
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Contacts
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Website
                  </th>
                  {canModify && (
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={canModify ? 5 : 4} className="px-6 py-20 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    </td>
                  </tr>
                ) : currentOrgs.length === 0 ? (
                  <tr>
                    <td colSpan={canModify ? 5 : 4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                          <Building2 size={28} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-bold text-slate-500">No organizations found</p>
                        <p className="text-[10px] text-slate-400 mt-1">Try adjusting your search</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentOrgs.map((org) => {
                    const primaryPOC = org.pointsOfContact?.find(p => p.isPrimary) || org.pointsOfContact?.[0];
                    return (
                      <React.Fragment key={org._id}>
                        <tr
                          className={`group transition-all cursor-pointer ${expandedRow === org._id ? 'bg-blue-50/80' : 'hover:bg-blue-50/30'}`}
                          onClick={() => toggleRow(org._id)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div>
                                {expandedRow === org._id ? <ChevronUp size={14} className="text-blue-600" /> : <ChevronDown size={14} className="text-slate-400" />}
                              </div>
                              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                                <Building2 size={16} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-sm">{org.companyName}</p>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Organization</span>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {primaryPOC ? (
                              <div>
                                <p className="text-sm font-bold text-slate-700">{primaryPOC.pocName}</p>
                                <p className="text-[10px] text-slate-400">{primaryPOC.pocEmail}</p>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">No contact</span>
                            )}
                           </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <Users size={14} className="text-slate-400" />
                              <span className="text-sm font-bold text-slate-700">{org.pointsOfContact?.length || 0}</span>
                            </div>
                           </td>

                          <td className="px-6 py-4">
                            {org.website ? (
                              <a href={org.website} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-600 hover:underline">
                                {org.website.length > 40 ? org.website.substring(0, 40) + '...' : org.website}
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-300">No Website</span>
                            )}
                           </td>

                          {canModify && (
                            <td className="px-6 py-4">
                              <div className="flex justify-end gap-2">
                                <button onClick={(e) => { e.stopPropagation(); openEditModal(org); }} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(org._id); }} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                             </td>
                          )}
                        </tr>

                        {/* EXPANDED SECTION - Show all POCs */}
                        {expandedRow === org._id && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={canModify ? 5 : 4} className="px-6 py-4">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-white rounded-xl border border-slate-100 p-4">
                                  <h4 className="text-xs font-black text-slate-700 mb-3 flex items-center gap-2">
                                    <Building2 size={14} className="text-blue-600" />
                                    Company Details
                                  </h4>
                                  <div className="space-y-2">
                                    {org.website && (
                                      <div className="flex items-center gap-2">
                                        <Globe size={12} className="text-slate-400" />
                                        <span className="text-xs text-slate-600">{org.website}</span>
                                      </div>
                                    )}
                                    {org.address && (
                                      <div className="flex items-center gap-2">
                                        <MapPin size={12} className="text-slate-400" />
                                        <span className="text-xs text-slate-600">{org.address}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-100 p-4">
                                  <h4 className="text-xs font-black text-slate-700 mb-3 flex items-center gap-2">
                                    <Users size={14} className="text-blue-600" />
                                    Points of Contact ({org.pointsOfContact?.length || 0})
                                  </h4>
                                  <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {org.pointsOfContact?.map((poc, idx) => (
                                      <div key={idx} className="p-2 rounded-lg bg-slate-50">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-sm font-bold text-slate-800">{poc.pocName}</span>
                                          {poc.isPrimary && (
                                            <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Primary</span>
                                          )}
                                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${getDepartmentColor(poc.department)}`}>
                                            {poc.department}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1">{poc.pocEmail}</p>
                                        <p className="text-[9px] text-slate-400">{poc.pocPhone}</p>
                                        {poc.linkedin && (
                                          <a href={poc.linkedin} target="_blank" rel="noreferrer" className="text-[8px] text-blue-500 hover:underline">LinkedIn</a>
                                        )}
                                      </div>
                                    ))}
                                    {(!org.pointsOfContact || org.pointsOfContact.length === 0) && (
                                      <p className="text-xs text-slate-400 text-center py-4">No contacts added</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                             </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 bg-white rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition-all">
              <ChevronLeft size={16} />
            </button>
            <div className="flex gap-1">
              {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                let pageNum = i + 1;
                return (
                  <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 bg-white rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition-all">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* MAIN MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 relative max-h-[95vh] overflow-y-auto border border-slate-100">
            <button onClick={closeModal} className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-all">
              <X size={20} />
            </button>
            
            <div className="mb-5">
              <h2 className="text-xl font-black text-slate-800">{editingId ? 'Modify Organization' : 'Add Organization'}</h2>
              <p className="text-slate-400 text-xs">Capture business and contact details</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Company Name with Suggestions Dropdown */}
              <div className="relative">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 ml-1">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter company name..."
                  value={formData.companyName}
                  onChange={handleCompanyNameChange}
                  onFocus={() => formData.companyName.length >= 2 && checkExistingCompany(formData.companyName)}
                  className="w-full p-3 bg-slate-50 rounded-xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                />
                
                {/* Suggestions Dropdown */}
               {/* Suggestions Dropdown */}
{showSuggestions && similarCompanies.length > 0 && (
  <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg max-h-64 overflow-y-auto">
    <div className="p-2 border-b border-slate-100 bg-slate-50">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
        Similar companies found:
      </p>
    </div>
    {similarCompanies.map((company) => (
      <div
        key={company._id}
        onClick={() => selectExistingCompany(company)}
        className="w-full p-3 text-left hover:bg-blue-50 transition-all border-b border-slate-50 last:border-0 cursor-pointer flex items-center justify-between group"
      >
        <div>
          <p className="text-sm font-bold text-slate-800">{company.companyName}</p>
          {company.pointsOfContact && company.pointsOfContact.length > 0 && (
            <p className="text-[9px] text-slate-500 mt-0.5">
              {company.pointsOfContact.length} contact(s) • 
              Primary: {company.pointsOfContact.find(p => p.isPrimary)?.pocName || 'None'}
            </p>
          )}
        </div>
        <span className="px-2 py-1 bg-blue-600 text-white rounded-lg text-[8px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
          Select
        </span>
      </div>
    ))}
    <div className="p-2 border-t border-slate-100 bg-slate-50">
      <button
        type="button"
        onClick={() => setShowSuggestions(false)}
        className="w-full text-center text-[9px] font-bold text-slate-500 hover:text-slate-700"
      >
        Create new company instead
      </button>
    </div>
  </div>
)}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Website"
                  className="w-full p-3 bg-slate-50 rounded-xl border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none text-sm"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
                <input
                  placeholder="Address"
                  className="w-full p-3 bg-slate-50 rounded-xl border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none text-sm"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              {/* Points of Contact Section */}
              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Points of Contact *</label>
                  <button
                    type="button"
                    onClick={() => openPOCModal()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-blue-700 transition-all"
                  >
                    <UserPlus size={12} />
                    Add Contact
                  </button>
                </div>

                {pointsOfContact.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">No contacts added. Click "Add Contact" to add.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pointsOfContact.map((poc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-800">{poc.pocName}</span>
                            {poc.isPrimary && <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Primary</span>}
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${getDepartmentColor(poc.department)}`}>
                              {poc.department}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500">{poc.pocEmail}</p>
                          <p className="text-[9px] text-slate-400">{poc.pocPhone}</p>
                        </div>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => openPOCModal(idx)} className="p-1.5 rounded-lg bg-white text-blue-600 hover:bg-blue-50 transition-all">
                            <Pencil size={12} />
                          </button>
                          <button type="button" onClick={() => removePOC(idx)} className="p-1.5 rounded-lg bg-white text-red-600 hover:bg-red-50 transition-all">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Convert to Lead Checkbox */}
              {!editingId && pointsOfContact.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <input
                    type="checkbox"
                    id="convertToLead"
                    checked={convertToLead}
                    onChange={(e) => setConvertToLead(e.target.checked)}
                    className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="convertToLead" className="flex items-center gap-2 cursor-pointer">
                    <Target size={14} className="text-blue-600" />
                    <span className="text-xs font-bold text-blue-700">Directly convert to Lead</span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={converting || pointsOfContact.length === 0}
                className="w-full bg-slate-900 text-white p-3.5 rounded-xl font-black uppercase tracking-wider text-[10px] hover:bg-blue-600 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {converting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {convertToLead ? 'Creating Lead...' : 'Saving...'}
                  </>
                ) : (
                  editingId ? 'Update Organization' : (convertToLead ? 'Save & Create Lead' : 'Save Organization')
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POC Modal */}
      {showPOCModal && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button onClick={() => setShowPOCModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
            <h3 className="text-lg font-black text-slate-800 mb-4">{editingPOCIndex !== null ? 'Edit Contact' : 'Add New Contact'}</h3>
            
            <div className="space-y-3">
              <input
                required
                placeholder="Contact Name *"
                className="w-full p-2.5 bg-slate-50 rounded-xl border-2 border-transparent focus:border-blue-500 outline-none text-sm"
                value={pocForm.pocName}
                onChange={(e) => setPocForm({ ...pocForm, pocName: e.target.value })}
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full p-2.5 bg-slate-50 rounded-xl border-2 border-transparent focus:border-blue-500 outline-none text-sm"
                value={pocForm.pocEmail}
                onChange={(e) => setPocForm({ ...pocForm, pocEmail: e.target.value })}
              />
              <input
                placeholder="Phone"
                className="w-full p-2.5 bg-slate-50 rounded-xl border-2 border-transparent focus:border-blue-500 outline-none text-sm"
                value={pocForm.pocPhone}
                onChange={(e) => setPocForm({ ...pocForm, pocPhone: e.target.value })}
              />
              <input
                placeholder="LinkedIn URL"
                className="w-full p-2.5 bg-slate-50 rounded-xl border-2 border-transparent focus:border-blue-500 outline-none text-sm"
                value={pocForm.linkedin}
                onChange={(e) => setPocForm({ ...pocForm, linkedin: e.target.value })}
              />
              
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="w-full p-2.5 bg-slate-50 rounded-xl border-2 border-transparent focus:border-blue-500 outline-none text-sm"
                  value={pocForm.department}
                  onChange={(e) => setPocForm({ ...pocForm, department: e.target.value })}
                >
                  <option value="CEO">CEO</option>
                  <option value="CTO">CTO</option>
                  <option value="Sales">Sales</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Support">Support</option>
                  <option value="Developer">Developer</option>
                  <option value="Other">Other</option>
                </select>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pocForm.isPrimary}
                    onChange={(e) => setPocForm({ ...pocForm, isPrimary: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-xs font-semibold text-slate-600">Primary Contact</span>
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPOCModal(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs">Cancel</button>
              <button onClick={savePOC} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all">Save Contact</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Organizations;