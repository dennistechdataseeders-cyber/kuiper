// frontend/src/components/DashboardFilterBanner.jsx
// Small "you came from the dashboard" chip: shows what is being filtered and lets the user clear it.
import React from 'react';
import { Filter, X } from 'lucide-react';

const DashboardFilterBanner = ({ filter, label, className = '' }) => {
  if (!filter?.active) return null;
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 ${className}`}
    >
      <Filter size={12} />
      <span>
        {filter.repName || (filter.rep ? 'Selected sales person' : 'Whole team')}
        {label ? ` · ${label}` : ''}
      </span>
      <button
        onClick={filter.clear}
        title="Clear filter"
        className="ml-1 rounded-full p-0.5 hover:bg-blue-100"
      >
        <X size={12} />
      </button>
    </div>
  );
};

export default DashboardFilterBanner;