interface Props {
  url: string;
}

/**
 * YouTube URL'sinden video ID'sini çıkarır:
 * - https://youtube.com/watch?v=ABC123
 * - https://youtu.be/ABC123
 * - https://youtube.com/embed/ABC123
 */
function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.slice(1).split('?')[0] || null;
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null;
      const v = u.searchParams.get('v');
      if (v) return v;
    }
  } catch { /* invalid url */ }
  return null;
}

export default function VideoEmbed({ url }: Props) {
  const ytId = getYouTubeId(url);

  if (ytId) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Video Tanıtım</h2>
        </div>
        <div className="relative w-full pb-[56.25%]">
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${ytId}`}
            title="İlan videosu"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // Fallback: doğrudan video tag (mp4 vs.)
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Video Tanıtım</h2>
        </div>
        <video controls className="w-full" preload="metadata">
          <source src={url} />
          Tarayıcınız video oynatmayı desteklemiyor.
        </video>
      </div>
    );
  }

  // Geçersiz URL — sadece link göster
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">Video Tanıtım</h2>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
      >
        {url}
      </a>
    </div>
  );
}
