// path: frontend/src/components/AccountDetailPanel.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  X, Building2, Globe, Phone, Mail, MapPin, Users, User, Star, Calendar,
  Hash, Tag, UserPlus, ExternalLink
} from 'lucide-react';

// Industry codes saved by AddAccountModal → readable labels
export const INDUSTRY_LABELS = {
  ECOM: 'E-Commerce',
  IT: 'IT / Software',
  FOOD: 'Food & Beverage',
  FNC: 'Finance'
};
export const industryLabel = (v) => (v ? INDUSTRY_LABELS[v] || v : '');

const formatValue = (v) => {
  if (v === undefined || v === null || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ') || '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
};

const formatDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const humanize = (key) =>
  String(key).replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').replace(/^./, (s) => s.toUpperCase()).trim();

const STATUS_STYLES = {
  New: 'bg-blue-50 text-blue-700 border-blue-100',
  Contacted: 'bg-amber-50 text-amber-700 border-amber-100',
  Converted: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Inactive: 'bg-slate-100 text-slate-500 border-slate-200'
};

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center shrink-0">
        <Icon size={13} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        <div className="text-sm font-semibold text-slate-800 break-words">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, right, children }) {
  return (
    <section className="px-6 py-4 border-b border-slate-100">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

/**
 * account:      organization document from GET /api/orgs
 * customFields: field definitions from useCustomFields('Accounts')
 */
export default function AccountDetailPanel({
  account,
  customFields = [],
  onClose,
  onAddContact,
  onViewContacts
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = useCallback(() => {
    setShown(false);
    setTimeout(() => onClose?.(), 200);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  if (!account) return null;

  const pocs = account.pointsOfContact || [];
  const primary = pocs.find((p) => p.isPrimary) || pocs[0];
  const websiteHref = account.website
    ? (account.website.startsWith('http') ? account.website : `https://${account.website}`)
    : null;

  // Address: free-text string + optional structured details
  const addressDetails =
    account.addressDetails && typeof account.addressDetails === 'object' && !Array.isArray(account.addressDetails)
      ? Object.entries(account.addressDetails).filter(
          ([, v]) => v !== undefined && v !== null && v !== '' && typeof v !== 'object'
        )
      : [];

  // Custom fields: definitions first, then orphaned saved values
  const saved = Object.fromEntries((account.customFields || []).map((f) => [f.fieldKey, f.value]));
  const defRows = customFields.map((f) => ({ key: f.fieldKey, label: f.label, value: saved[f.fieldKey] }));
  const defKeys = new Set(defRows.map((d) => d.key));
  const extraRows = (account.customFields || [])
    .filter((f) => !defKeys.has(f.fieldKey))
    .map((f) => ({ key: f.fieldKey, label: f.label || f.fieldKey, value: f.value }));
  const customRows = [...defRows, ...extraRows];

  return (
    <div className="fixed inset-0 z-[90]">
      <div
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] transition-opacity duration-200 ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={close}
      />

      <aside
        role="dialog"
        aria-label="Account details"
        className={`absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
          shown ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Building2 size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-800 truncate">{account.companyName}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {account.status && (
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        STATUS_STYLES[account.status] || STATUS_STYLES.Inactive
                      }`}
                    >
                      {account.status}
                    </span>
                  )}
                  {account.industry && (
                    <span className="text-xs font-semibold text-slate-500">{industryLabel(account.industry)}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={close}
              aria-label="Close"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => onAddContact?.(account._id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
            >
              <UserPlus size={12} /> Add Contact
            </button>
            <button
              onClick={() => onViewContacts?.(account._id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
            >
              View Contacts <ExternalLink size={12} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <Section title="Account Information">
            <div className="divide-y divide-slate-50">
              <InfoRow icon={Building2} label="Company">{formatValue(account.companyName)}</InfoRow>
              <InfoRow icon={Globe} label="Website">
                {websiteHref ? (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    {account.website} <ExternalLink size={11} />
                  </a>
                ) : '—'}
              </InfoRow>
              <InfoRow icon={Phone} label="Phone">
                {account.phone || primary?.pocPhone ? (
                  <a href={`tel:${account.phone || primary?.pocPhone}`} className="hover:text-blue-600">
                    {account.phone || primary?.pocPhone}
                  </a>
                ) : '—'}
              </InfoRow>
              <InfoRow icon={Tag} label="Industry">{formatValue(industryLabel(account.industry))}</InfoRow>
              <InfoRow icon={Hash} label="No. of Employees">{formatValue(account.noOfEmployees)}</InfoRow>
              <InfoRow icon={User} label="Sales Rep">{formatValue(account.salesRepId?.name)}</InfoRow>
              <InfoRow icon={Calendar} label="Created">{formatDate(account.createdAt)}</InfoRow>
              <InfoRow icon={Calendar} label="Last Updated">{formatDate(account.updatedAt)}</InfoRow>
            </div>
          </Section>

          <Section title="Address">
            <div className="divide-y divide-slate-50">
              <InfoRow icon={MapPin} label="Address">{formatValue(account.address)}</InfoRow>
              {addressDetails.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 py-2.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 pt-0.5">{humanize(k)}</span>
                  <span className="text-sm font-semibold text-slate-800 text-right break-words">{formatValue(v)}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title={`Points of Contact (${pocs.length})`}
            right={<Users size={13} className="text-slate-400" />}
          >
            {pocs.length === 0 ? (
              <p className="py-3 text-sm text-slate-400">No contacts added yet.</p>
            ) : (
              <div className="space-y-2 mt-2">
                {pocs.map((p) => (
                  <div
                    key={p._id || p.pocName}
                    className="p-3 rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {(p.pocName || '?').trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800 truncate">{p.pocName}</span>
                          {p.isPrimary && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
                              <Star size={8} fill="currentColor" /> Primary
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-500 truncate">
                          {[p.title, p.department && p.department !== 'Other' ? p.department : null]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <Mail size={12} className="text-slate-400 shrink-0" />
                        {p.pocEmail ? (
                          <a href={`mailto:${p.pocEmail}`} className="truncate hover:text-blue-600">{p.pocEmail}</a>
                        ) : '—'}
                      </span>
                      <span className="flex items-center gap-1.5 min-w-0">
                        <Phone size={12} className="text-slate-400 shrink-0" />
                        {p.pocPhone || p.mobile ? (
                          <a href={`tel:${p.pocPhone || p.mobile}`} className="truncate hover:text-blue-600">
                            {p.pocPhone || p.mobile}
                          </a>
                        ) : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {customRows.length > 0 && (
            <Section title="Custom Fields">
              <div className="divide-y divide-slate-50">
                {customRows.map((r) => (
                  <div key={r.key} className="flex items-start justify-between gap-4 py-2.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 pt-0.5">{r.label}</span>
                    <span className="text-sm font-semibold text-slate-800 text-right break-words">{formatValue(r.value)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </aside>
    </div>
  );
}