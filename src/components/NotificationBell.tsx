import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { playDing, isSoundEnabled } from '../lib/sound';

const ICONS: Record<string, string> = {
  offer:   '🤝',
  message: '💬',
  status:  '📌',
  system:  '⚙️',
  moderation: '🛡️',
  wishlist: '🎯',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec  = Math.floor(diff / 1000);
  if (sec < 60)        return 'az önce';
  if (sec < 3600)      return `${Math.floor(sec / 60)} dk önce`;
  if (sec < 86_400)    return `${Math.floor(sec / 3600)} sa önce`;
  if (sec < 604_800)   return `${Math.floor(sec / 86_400)} gün önce`;
  return new Date(iso).toLocaleDateString('tr-TR');
}

export default function NotificationBell() {
  const { getNotifications, markNotificationsRead } = useAppStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const notifications = getNotifications();
  const unread = notifications.filter((n) => !n.read).length;

  // Yeni bildirim geldiğinde ses çal (sadece artış varsa)
  const prevUnreadRef = useRef(unread);
  useEffect(() => {
    if (unread > prevUnreadRef.current && isSoundEnabled()) {
      playDing();
    }
    prevUnreadRef.current = unread;
  }, [unread]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleOpen() {
    setOpen((v) => !v);
    if (!open && unread > 0) {
      // Sayfayı açar açmaz read olarak işaretle (UX: ayrı buton zorunlu değil)
      setTimeout(() => markNotificationsRead(), 800);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        title="Bildirimler"
        className="relative w-9 h-9 rounded-xl text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Bildirimler</h3>
            {unread > 0 && (
              <button
                onClick={() => { markNotificationsRead(); }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Tümünü oku
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <div className="text-3xl mb-2">🔕</div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Bildirim yok</p>
              </div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  to={n.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                    !n.read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className="text-lg flex-shrink-0 mt-0.5">{ICONS[n.type]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${
                        !n.read
                          ? 'text-slate-900 dark:text-slate-100'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {n.title}
                      </p>
                      {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {n.body}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      {relativeTime(n.createdAt)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
