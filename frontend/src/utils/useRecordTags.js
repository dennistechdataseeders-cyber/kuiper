// frontend/src/utils/useRecordTags.js
//
// Zoho-style tags for one sales module ('Leads' | 'Contacts' | 'Accounts' | 'Deals').
// Talks to backend/routes/tagRoutes.js (/api/tags).
//
//   const tags = useRecordTags('Accounts');
//   tags.tagsOf(recordId)          -> [{ _id, name, color }]
//   tags.namesOf(recordId)         -> ['Hot Lead', ...]   (use as getValue for filters/sort)
//   tags.assign(ids, add, remove)  -> add = tag ids or new names, remove = tag ids
//
// Also exports useRowSelection() for the row checkboxes.
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const apiErr = (err, fallback) => err.response?.data?.error || err.response?.data?.message || fallback;

export default function useRecordTags(module) {
  const [tags, setTags] = useState([]);              // all tags of this module
  const [assignments, setAssignments] = useState({}); // { recordId: [tagId] }
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!module) { setLoading(false); return; } // module = null → hook is a no-op
    try {
      const res = await axios.get(`${API_BASE_URL}/api/tags?module=${module}`, auth());
      setTags(res.data?.tags || []);
      setAssignments(res.data?.assignments || {});
    } catch (err) {
      // Tags are an add-on: never block the page if they fail to load
      console.error('Failed to load tags', err);
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => { reload(); }, [reload]);

  const byId = useMemo(() => new Map(tags.map((t) => [String(t._id), t])), [tags]);

  const tagsOf = useCallback(
    (recordId) =>
      (assignments[String(recordId)] || [])
        .map((id) => byId.get(String(id)))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [assignments, byId]
  );

  const namesOf = useCallback((recordId) => tagsOf(recordId).map((t) => t.name), [tagsOf]);

  const tagNames = useMemo(() => tags.map((t) => t.name).sort((a, b) => a.localeCompare(b)), [tags]);

  // Changes whenever tags/assignments change → pass to memos / useColumnTable depsKey
  const version = useMemo(
    () => `${tags.map((t) => `${t._id}:${t.name}`).join(',')}|${JSON.stringify(assignments)}`,
    [tags, assignments]
  );

  // add: tag ids or brand-new names, remove: tag ids
  const assign = useCallback(async (recordIds, add = [], remove = []) => {
    const ids = (recordIds || []).map(String).filter(Boolean);
    if (ids.length === 0) return false;
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/tags/assign`,
        { module, recordIds: ids, add, remove },
        auth()
      );
      const created = res.data?.tags || [];
      if (created.length) {
        setTags((prev) => {
          const have = new Set(prev.map((t) => String(t._id)));
          return [...prev, ...created.filter((t) => !have.has(String(t._id)))];
        });
      }
      setAssignments((prev) => ({ ...prev, ...(res.data?.assignments || {}) }));
      return true;
    } catch (err) {
      toast.error(apiErr(err, 'Failed to update tags'));
      return false;
    }
  }, [module]);

  const removeOne = useCallback((recordId, tagId) => assign([recordId], [], [tagId]), [assign]);

  const updateTag = useCallback(async (id, patch) => {
    try {
      const res = await axios.patch(`${API_BASE_URL}/api/tags/${id}`, patch, auth());
      const saved = res.data?.data;
      setTags((prev) => prev.map((t) => (String(t._id) === String(id) ? { ...t, ...saved } : t)));
      return true;
    } catch (err) {
      toast.error(apiErr(err, 'Failed to update tag'));
      return false;
    }
  }, []);

  const deleteTag = useCallback(async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/tags/${id}`, auth());
      setTags((prev) => prev.filter((t) => String(t._id) !== String(id)));
      setAssignments((prev) =>
        Object.fromEntries(Object.entries(prev).map(([rid, list]) => [rid, list.filter((x) => String(x) !== String(id))]))
      );
      return true;
    } catch (err) {
      toast.error(apiErr(err, 'Failed to delete tag'));
      return false;
    }
  }, []);

  return {
    module, tags, tagNames, assignments, loading, version,
    tagsOf, namesOf, assign, removeOne, updateTag, deleteTag, reload,
  };
}

// ------------------------------------------------------------------
// Row checkboxes (selection survives paging / sorting / filtering)
// ------------------------------------------------------------------
export function useRowSelection() {
  const [selected, setSelected] = useState(() => new Set());

  const isSelected = useCallback((id) => selected.has(String(id)), [selected]);

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = String(id);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  // tick / untick every id in `ids` (e.g. the current page)
  const setMany = useCallback((ids, on) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(String(id)) : next.delete(String(id))));
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  return { selected, ids: [...selected], count: selected.size, isSelected, toggle, setMany, clear };
}
