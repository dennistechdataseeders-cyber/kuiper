// path: frontend/src/components/ContactDetailPanel.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  X, Mail, Phone, Smartphone, Building2, Briefcase, Star, Calendar,
  Link as LinkIcon, Tag, StickyNote, ExternalLink
} from 'lucide-react';

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

function Section({ title, children }) {
  return (
    <section className="px-6 py-4 border-b border-slate-100">
      <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">{title}</h3>
      {children}
    </section>
  );
}

/**
 * contact:      row built by Contacts.jsx
 * customFields: field definitions from useCustomFields('Contacts')
 * onViewAccount(accountId): jump to /sales/contacts?accountId=<id>
 */
export default function ContactDetailPanel({ contact, customFields = [], onClose, onViewAccount }) {
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

  if (!contact) return null;

  const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '—';
  const initials = `${contact.firstName?.charAt(0) || ''}${contact.lastName?.charAt(0) || ''}`.toUpperCase() || '?';

  // Definitions first (so empty fields still show), then any saved values whose definition was removed
  const defRows = customFields.map((f) => ({
    key: f.fieldKey,
    label: f.label,
    value: contact.custom?.[f.fieldKey]
  }));
  const defKeys = new Set(defRows.map((d) => d.key));
  const extraRows = (contact.customList || [])
    .filter((f) => !defKeys.has(f.fieldKey))
    .map((f) => ({ key: f.fieldKey, label: f.label || f.fieldKey, value: f.value }));
  const customRows = [...defRows, ...extraRows];

  const linkedinHref = contact.linkedin
    ? (contact.linkedin.startsWith('http') ? contact.linkedin : `https://${contact.linkedin}`)
    : null;

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
        aria-label="Contact details"
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
          shown ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-base font-black shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-800 truncate">{fullName}</h2>
                <p className="text-xs font-semibold text-slate-500 truncate">
                  {[contact.title, contact.companyName].filter(Boolean).join(' · ') || '—'}
                </p>
                {contact.isPrimary && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    <Star size={8} fill="currentColor" /> Primary
                  </span>
                )}
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
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
              >
                <Mail size={12} /> Email
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
              >
                <Phone size={12} /> Call
              </a>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <Section title="Contact Information">
            <div className="divide-y divide-slate-50">
              <InfoRow icon={Mail} label="Email">
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a>
                ) : '—'}
              </InfoRow>
              <InfoRow icon={Phone} label="Phone">
                {contact.pocPhone ? (
                  <a href={`tel:${contact.pocPhone}`} className="hover:text-blue-600">{contact.pocPhone}</a>
                ) : '—'}
              </InfoRow>
              <InfoRow icon={Smartphone} label="Mobile">
                {contact.mobile ? (
                  <a href={`tel:${contact.mobile}`} className="hover:text-blue-600">{contact.mobile}</a>
                ) : '—'}
              </InfoRow>
              <InfoRow icon={Briefcase} label="Title">{formatValue(contact.title)}</InfoRow>
              <InfoRow icon={Tag} label="Department">{formatValue(contact.department)}</InfoRow>
              <InfoRow icon={LinkIcon} label="LinkedIn">
                {linkedinHref ? (
                  <a
                    href={linkedinHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    {contact.linkedin} <ExternalLink size={11} />
                  </a>
                ) : '—'}
              </InfoRow>
              <InfoRow icon={Calendar} label="Added">{formatDate(contact.addedAt)}</InfoRow>
            </div>
          </Section>

          <Section title="Account">
            <button
              onClick={() => onViewAccount?.(contact.leadId)}
              className="w-full flex items-center justify-between gap-3 mt-2 p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition text-left"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Building2 size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-800 truncate">{contact.companyName || '—'}</span>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                    View all contacts
                  </span>
                </span>
              </span>
              <ExternalLink size={14} className="text-slate-400 shrink-0" />
            </button>
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

          {contact.notes && (
            <Section title="Notes">
              <div className="flex items-start gap-2.5 mt-2 p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                <StickyNote size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{contact.notes}</p>
              </div>
            </Section>
          )}
        </div>
      </aside>
    </div>
  );
}