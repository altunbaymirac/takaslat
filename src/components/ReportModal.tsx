import { useState, type FormEvent } from 'react';
import { useAppStore } from '../store/useAppStore';
import { showToast } from './Toast';

const REASONS = [
  { id: 'fake',        label: 'Sahte ilan',           icon: '🚫' },
  { id: 'misleading',  label: 'Yanıltıcı bilgi',      icon: '⚠️' },
  { id: 'spam',        label: 'Spam / Tekrar eden',   icon: '🔁' },
  { id: 'inappropriate', label: 'Uygunsuz içerik',    icon: '🔞' },
  { id: 'scam',        label: 'Dolandırıcılık şüphesi', icon: '💀' },
  { id: 'other',       label: 'Diğer',                icon: '❓' },
];

interface Props {
  listingId:    string;
  listingTitle: string;
  onClose:      () => void;
}

export default function ReportModal({ listingId, listingTitle, onClose }: Props) {
  const addReport = useAppStore((s) => s.addReport);
  const [reason,  setReason]  = useState<string>('');
  const [details, setDetails] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason) return;
    addReport(listingId, reason, details || undefined);
    showToast('Şikayetiniz alındı — inceleme başlatıldı', 'success');
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>🚩</span> İlanı Şikayet Et
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate max-w-xs">
              {listingTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">
              Bu ilan hangi nedenle uygunsuz?
            </p>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                    reason === r.id
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={(e) => setReason(e.target.value)}
                    className="sr-only"
                  />
                  <span className="text-xl">{r.icon}</span>
                  <span className={`text-sm font-medium ${
                    reason === r.id ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'
                  }`}>
                    {r.label}
                  </span>
                  {reason === r.id && (
                    <svg className="w-4 h-4 ml-auto text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
              Detay <span className="text-slate-400 font-normal">(isteğe bağlı)</span>
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Olayı kısaca açıklayın..."
              className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={!reason}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              Şikayet Et
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
