// frontend/src/components/AlphabetFilter.jsx
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const ALPHABETS = ['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

export default function AlphabetFilter({ value, onChange, label = 'Lead Name' }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
      >
        <span className="text-xs uppercase tracking-wider text-slate-400">{label}</span>
        <span className="w-8 h-8 rounded-md bg-blue-50 text-blue-700 font-black flex items-center justify-center">
          {value === 'All' ? 'A–Z' : value}
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl p-2 w-64">
            <div className="grid grid-cols-7 gap-1">
              {ALPHABETS.map((letter) => (
                <button
                  key={letter}
                  onClick={() => { onChange(letter); setOpen(false); }}
                  className={`h-8 rounded-md text-xs font-black transition-all ${
                    value === letter ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  } ${letter === 'All' ? 'col-span-7 bg-slate-50' : ''}`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}