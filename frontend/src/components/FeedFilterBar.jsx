// Search and filters above the feeds tables. State comes from utils/useFeedFilters.
import { Search, X } from 'lucide-react';
import DeveloperPicker from './DeveloperPicker';
import { ALL, FEED_PLATFORMS, FEED_TYPES, UNASSIGNED } from '../utils/useFeedFilters';

const UNASSIGNED_OPTION = [{ value: UNASSIGNED, label: 'Unassigned feeds' }];

const FilterSelect = ({ label, value, onChange, allLabel, options, className = '' }) => (
  <select
    aria-label={label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`input cursor-pointer min-w-0 ${className}`}
  >
    <option value={ALL}>{allLabel}</option>
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const asOptions = (values) => values.map((v) => ({ value: v, label: v }));

const FeedFilterBar = ({
  filters, setFilter, clearFilters, isFiltered,
  projects, statuses, developers, feedCounts, knownPeople,
  shown, total, className = '',
}) => (
  <div className={`card !p-3 sm:!p-4 ${className}`}>
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start gap-2 sm:gap-3">
      <div className="relative col-span-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          aria-label="Search feeds"
          placeholder="Search feed, project or developer..."
          value={filters.q}
          onChange={(e) => setFilter('q', e.target.value)}
          className="input pl-9 pr-10"
        />
        {filters.q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setFilter('q', '')}
            className="btn-icon absolute top-1/2 -translate-y-1/2 right-0 md:right-1 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <FilterSelect
        label="Project"
        className="col-span-2 sm:col-span-1"
        value={filters.project}
        onChange={(v) => setFilter('project', v)}
        allLabel="All projects"
        options={projects.map((p) => ({ value: p._id, label: p.projectCustomId || p.name }))}
      />

      <div className="col-span-2 sm:col-span-1 min-w-0">
        <DeveloperPicker
          developers={developers}
          value={filters.devs}
          onChange={(devs) => setFilter('devs', devs)}
          placeholder="All developers"
          feedCounts={feedCounts}
          knownPeople={knownPeople}
          extraOptions={UNASSIGNED_OPTION}
        />
      </div>

      <FilterSelect
        label="Feed type"
        value={filters.type}
        onChange={(v) => setFilter('type', v)}
        allLabel="All types"
        options={asOptions(FEED_TYPES)}
      />
      <FilterSelect
        label="Feed status"
        value={filters.status}
        onChange={(v) => setFilter('status', v)}
        allLabel="All statuses"
        options={asOptions(statuses)}
      />
      <FilterSelect
        label="Platform"
        value={filters.platform}
        onChange={(v) => setFilter('platform', v)}
        allLabel="All platforms"
        options={asOptions(FEED_PLATFORMS)}
      />
    </div>

    <div className="flex flex-wrap items-center justify-between gap-2 mt-2 sm:mt-3">
      <p className="text-xs font-semibold text-slate-500" aria-live="polite">
        Showing {shown} of {total} feeds
      </p>
      <button type="button" onClick={clearFilters} disabled={!isFiltered} className="btn btn-sm btn-ghost">
        <X size={14} />
        Clear filters
      </button>
    </div>
  </div>
);

export default FeedFilterBar;
