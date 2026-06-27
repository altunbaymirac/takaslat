import { useState, type FormEvent } from 'react';
import { useAppStore } from '../store/useAppStore';
import { showToast } from './Toast';
import { CITIES_81 } from '../data/cities';

interface Props {
  onClose: () => void;
}

const PRESET_AVATARS = [
  'https://picsum.photos/seed/avatar1/200',
  'https://picsum.photos/seed/avatar2/200',
  'https://picsum.photos/seed/avatar3/200',
  'https://picsum.photos/seed/avatar4/200',
  'https://picsum.photos/seed/avatar5/200',
  'https://picsum.photos/seed/avatar6/200',
];

export default function ProfileEditModal({ onClose }: Props) {
  const { currentUser, updateProfile } = useAppStore();
  const [name,   setName]   = useState(currentUser?.name ?? '');
  const [city,   setCity]   = useState(currentUser?.city ?? '');
  const [avatar, setAvatar] = useState(currentUser?.avatar ?? '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile({ name, city, avatar });
      showToast('Profil güncellendi', 'success');
      onClose();
    } catch (err) {
      showToast((err as Error).message || 'Güncelleme başarısız', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>👤</span> Profili Düzenle
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Avatar preview + seçim */}
          <div className="text-center">
            {avatar ? (
              <img
                src={avatar}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover mx-auto mb-3 border-4 border-blue-100 dark:border-blue-900/40"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-blue-600 text-white text-4xl font-bold mx-auto mb-3 flex items-center justify-center">
                {name.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Avatar Seç</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {PRESET_AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all ${
                    avatar === a ? 'border-blue-500 scale-110' : 'border-transparent hover:border-slate-300'
                  }`}
                >
                  <img src={a} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAvatar('')}
                title="Avatar'ı kaldır"
                className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${
                  avatar === '' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="Veya kendi URL'ni yapıştır…"
              className="mt-3 w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">İsim *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Şehir</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seçin...</option>
              {CITIES_81.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">E-posta</label>
            <input
              type="email"
              disabled
              value={currentUser?.email ?? ''}
              className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-lg px-3 py-2.5 cursor-not-allowed"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">E-posta değiştirilemez (güvenlik)</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium py-2.5 rounded-xl text-sm"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm"
            >
              {loading ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
