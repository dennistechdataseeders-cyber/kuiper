// frontend/src/utils/useAlphaPagination.js
import { useMemo, useState } from 'react';

// Same naming rule as the Leads list: primary contact's name, else the company.
export const getActivityLeadName = (item) => {
  const lead = item?.leadId;
  const c = lead?.contacts?.find((x) => x.isPrimary) || lead?.contacts?.[0];
  const person = c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : '';
  return person || lead?.companyName || '—';
};

/**
 * First-letter (A–Z) filter + pagination for a list of items.
 * Keeps the incoming order (newest first); only filters and slices.
 */
export default function useAlphaPagination(items, getName = getActivityLeadName, initialPageSize = 10) {
  const [letter, setLetterState] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const filtered = useMemo(() => {
    if (letter === 'All') return items;
    return items.filter((i) => getName(i).charAt(0).toUpperCase() === letter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, letter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages); // stays valid if items shrink (e.g. task completed)

  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );

  const setLetter = (l) => { setLetterState(l); setPage(1); };
  const setPageSize = (n) => { setPageSizeState(n); setPage(1); };

  return {
    letter, setLetter,
    page: safePage, setPage,
    pageSize, setPageSize,
    paged,
    totalItems: filtered.length,
  };
}