// frontend/src/components/Pagination.jsx
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Builds [1, '…', 4, 5, 6, '…', 20] style page lists
function getPageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push('…');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push('…');
  items.push(total);
  return items;
}

export default function Pagination({ page, pageSize, totalItems, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const btn =
    'min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold border transition flex items-center justify-center';
  const idle = 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50';
  const disabled = 'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white';

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-t border-slate-200 bg-white">
      <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
        <label className="flex items-center gap-2">
          Rows per page
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 bg-white"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <span>
          {from}–{to} of {totalItems}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={`${btn} ${idle} ${disabled}`}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        {getPageItems(page, totalPages).map((item, i) =>
          item === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-slate-400 text-xs">…</span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
              className={`${btn} ${
                item === page
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : idle
              }`}
            >
              {item}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={`${btn} ${idle} ${disabled}`}
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}