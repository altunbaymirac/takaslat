import { useEffect, useRef, useState } from 'react';
import { showToast } from './Toast';

interface Props {
  url:   string;
  title: string;
}

export default function ShareMenu({ url, title }: Props) {
  const [open,   setOpen]   = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        setOpen(false);
      } catch { /* user canceled */ }
    } else {
      setOpen((v) => !v);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link kopyalandı', 'success');
      setOpen(false);
    } catch {
      showToast('Kopyalanamadı', 'error');
    }
  }

  const shareText = encodeURIComponent(`${title} - Takaslat'ta gör`);
  const encUrl    = encodeURIComponent(url);

  const items = [
    {
      label: 'Linki Kopyala',
      icon:  '🔗',
      action: copyLink,
    },
    {
      label: 'QR Kod',
      icon:  '📱',
      action: () => { setQrOpen(true); setOpen(false); },
    },
    {
      label: 'X (Twitter)',
      icon:  '🐦',
      href:  `https://twitter.com/intent/tweet?text=${shareText}&url=${encUrl}`,
    },
    {
      label: 'Telegram',
      icon:  '✈️',
      href:  `https://t.me/share/url?url=${encUrl}&text=${shareText}`,
    },
    {
      label: 'Email',
      icon:  '✉️',
      href:  `mailto:?subject=${shareText}&body=${encUrl}`,
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleNativeShare}
        className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors"
        title="Paylaş"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      </button>

      {/* QR Code Modal */}
      {qrOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 modal-overlay" onClick={() => setQrOpen(false)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>📱</span> QR ile Paylaş
              </h3>
              <button onClick={() => setQrOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-white p-4 rounded-xl flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(url)}`}
                alt="QR Code"
                className="w-full max-w-[280px] h-auto"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-3 line-clamp-1">
              🔗 {url}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-2">
              Telefonunun kamerasıyla okutarak ilana ulaşabilirsin
            </p>
            <button
              onClick={copyLink}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl"
            >
              Linki Kopyala
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-50">
          {items.map((it) => (
            it.href ? (
              <a
                key={it.label}
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="text-base">{it.icon}</span>
                {it.label}
              </a>
            ) : (
              <button
                key={it.label}
                onClick={it.action}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="text-base">{it.icon}</span>
                {it.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}
