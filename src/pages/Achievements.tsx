import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { computeAchievements, tierColor } from '../lib/achievements';
import { useSEO } from '../hooks/useSEO';

const TIER_LABEL: Record<string, string> = {
  bronze:   'Bronz',
  silver:   'Gümüş',
  gold:     'Altın',
  platinum: 'Platin',
};

export default function Achievements() {
  useSEO({ title: 'Başarımlar', description: 'Takas geçmişin ve kazandığın rozetleri gör.' });

  const {
    currentUser, currentUserId, listings, offers, favorites,
    compareList, recentlyViewed, savedSearches, ratings,
  } = useAppStore();

  const achievements = useMemo(
    () => computeAchievements({
      currentUserId,
      listings, offers, favorites, compareList, recentlyViewed,
      savedSearches: savedSearches.length,
      ratings:       ratings.filter((r) => r.fromUserId === currentUserId).length,
    }),
    [currentUserId, listings, offers, favorites, compareList, recentlyViewed, savedSearches, ratings]
  );

  const earned = achievements.filter((a) => a.earned).length;
  const total  = achievements.length;
  const pct    = Math.round((earned / total) * 100);

  if (!currentUser) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-3">🏆</div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Başarımlarını görmek için giriş yap</h2>
        <Link to="/login" className="inline-flex bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium mt-4">Giriş Yap</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>🏆</span> Başarımlar
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Takaslat yolculuğunda kazandığın rozetler — platformu kullandıkça açılır
        </p>
      </header>

      {/* Genel ilerleme barı */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-5 mb-6 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm opacity-90">İlerleme</p>
            <p className="text-3xl font-bold">{earned} <span className="text-base opacity-75">/ {total}</span></p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-bold">{pct}%</p>
            <p className="text-xs opacity-90 mt-1">tamamlandı</p>
          </div>
        </div>
        <div className="bg-white/20 rounded-full h-2 overflow-hidden">
          <div
            className="bg-white h-full transition-all duration-700 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Rozetler ızgarası */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {achievements.map((a) => (
          <div
            key={a.id}
            className={`relative rounded-2xl p-4 border transition-all ${
              a.earned
                ? `bg-gradient-to-br ${tierColor(a.tier)} text-white border-transparent shadow-md hover:shadow-lg hover:scale-105`
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'
            }`}
          >
            <div className={`text-4xl mb-2 ${!a.earned && 'grayscale'}`}>{a.icon}</div>
            <p className={`font-bold text-sm leading-tight mb-1 ${a.earned ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
              {a.name}
            </p>
            <p className={`text-xs leading-snug mb-2 ${a.earned ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`}>
              {a.description}
            </p>

            {/* Progress */}
            {a.progress && (
              <div className="mt-2">
                <div className={`h-1 rounded-full overflow-hidden ${a.earned ? 'bg-white/30' : 'bg-slate-200 dark:bg-slate-700'}`}>
                  <div
                    className={`h-full rounded-full transition-all ${a.earned ? 'bg-white' : 'bg-blue-500'}`}
                    style={{ width: `${(a.progress.current / a.progress.target) * 100}%` }}
                  />
                </div>
                <p className={`text-[10px] mt-1 ${a.earned ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                  {a.progress.current} / {a.progress.target}
                </p>
              </div>
            )}

            {/* Tier badge */}
            <div className="absolute top-2 right-2">
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                a.earned ? 'bg-white/30 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
                {TIER_LABEL[a.tier]}
              </span>
            </div>

            {a.earned && (
              <div className="absolute top-2 left-2 w-5 h-5 bg-white/30 backdrop-blur rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
