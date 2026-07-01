import { useState, type FormEvent } from 'react';
import { useAppStore } from '../store/useAppStore';
import { showToast } from './Toast';
import type { SwapOffer } from '../types';

interface Props {
  offer:   SwapOffer;
  onClose: () => void;
}

export default function MeetingScheduler({ offer, onClose }: Props) {
  const { currentUserId, addMeeting, meetings, updateMeetingStatus } = useAppStore();

  // Bu teklif için mevcut buluşma teklifleri
  const existing = meetings.filter((m) => m.offerId === offer.id);

  const [date,     setDate]     = useState('');
  const [time,     setTime]     = useState('');
  const [location, setLocation] = useState('');
  const [note,     setNote]     = useState('');

  const otherUserId = offer.fromUserId === currentUserId ? offer.toUserId : offer.fromUserId;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!date || !time || !location) return;

    const dateTime = new Date(`${date}T${time}:00`).toISOString();
    addMeeting({
      offerId:    offer.id,
      fromUserId: currentUserId,
      toUserId:   otherUserId,
      date:       dateTime,
      location:   location.trim(),
      note:       note.trim() || undefined,
      status:     'beklemede',
    });
    showToast('Buluşma teklifi gönderildi', 'success');
    setDate(''); setTime(''); setLocation(''); setNote('');
  }

  // Minimum tarih bugün
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto modal-overlay" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg my-8 modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>📅</span> Buluşma Planla
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Takas için bir buluşma zamanı ve yeri öner
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Mevcut buluşmalar */}
          {existing.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Mevcut Teklifler</p>
              <div className="space-y-2">
                {existing.map((m) => {
                  const d = new Date(m.date);
                  const isMine = m.fromUserId === currentUserId;
                  return (
                    <div key={m.id} className={`rounded-xl p-3 border ${
                      m.status === 'kabul'    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/40' :
                      m.status === 'red'      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40' :
                      m.status === 'iptal'    ? 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600' :
                                                'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/40'
                    }`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            📅 {d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            {' · '}
                            🕐 {d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">📍 {m.location}</p>
                          {m.note && <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-1">"{m.note}"</p>}
                        </div>
                        <span className="text-[10px] font-bold uppercase opacity-70">
                          {isMine ? 'Senden' : 'Karşıdan'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-semibold capitalize">
                          {m.status === 'kabul'   && '✓ Kabul edildi'}
                          {m.status === 'red'     && '✕ Reddedildi'}
                          {m.status === 'iptal'   && '⊘ İptal edildi'}
                          {m.status === 'beklemede' && '⏳ Yanıt bekleniyor'}
                        </span>
                        {!isMine && m.status === 'beklemede' && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => updateMeetingStatus(m.id, 'kabul')}
                              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg"
                            >
                              Kabul
                            </button>
                            <button
                              onClick={() => updateMeetingStatus(m.id, 'red')}
                              className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg"
                            >
                              Red
                            </button>
                          </div>
                        )}
                        {isMine && m.status === 'beklemede' && (
                          <button
                            onClick={() => updateMeetingStatus(m.id, 'iptal')}
                            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-500"
                          >
                            İptal
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Yeni teklif formu */}
          <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Yeni Buluşma Önerisi</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">📅 Tarih</label>
                <input
                  type="date"
                  required
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">🕐 Saat</label>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">📍 Buluşma Yeri</label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Örn: Kadıköy Meydan, Kanyon AVM, Akmerkez P1 otopark…"
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">💬 Not (opsiyonel)</label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Belgeleri getirin, otopark ücretsiz vs."
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={!date || !time || !location}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl"
            >
              📤 Buluşma Teklifini Gönder
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
