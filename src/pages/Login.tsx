import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { forgotPassword, resetPassword } from '../services/api';
import { showToast } from '../components/Toast';
import { useSEO } from '../hooks/useSEO';
import { checkRateLimit, resetRateLimit, getRemainingAttempts } from '../lib/rateLimit';

type Mode = 'login' | 'forgot' | 'reset';

export default function Login() {
  useSEO({ title: 'Giriş Yap', description: 'Takaslat hesabına giriş yap ve araç takas ilanlarını keşfet.' });

  const navigate = useNavigate();
  const loginUser = useAppStore((s) => s.loginUser);

  const [mode,     setMode]     = useState<Mode>('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetCode, setResetCode]     = useState('');
  const [devCode,   setDevCode]       = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const remaining = getRemainingAttempts(mode === 'forgot' ? 'forgotPassword' : 'login', email || 'global');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        checkRateLimit('login', email);
        await loginUser(email, password, twoFactorCode || undefined);
        resetRateLimit('login', email);
        navigate('/');
      } else if (mode === 'forgot') {
        checkRateLimit('forgotPassword', email);
        const res = await forgotPassword(email);
        setDevCode(res.devCode ?? null);
        setMode('reset');
        showToast('Kod gönderildi', 'success');
      } else {
        await resetPassword(email, resetCode, newPassword);
        showToast('Şifren güncellendi, giriş yapabilirsin', 'success');
        setMode('login');
        setResetCode('');
        setNewPassword('');
        setDevCode(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'İşlem başarısız';
      setError(message);
      if (mode === 'login' && message.toLowerCase().includes('kod')) setNeeds2FA(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2d6e] via-[#1B4FD8] to-[#1e40af] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Takaslat</span>
          </Link>
          <p className="mt-2 text-white/70 text-sm">Takasın en akıllı adresi</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-xl font-bold text-slate-900 mb-1">
            {mode === 'login' ? 'Hesabına giriş yap' : mode === 'forgot' ? 'Şifreni sıfırla' : 'Yeni şifre belirle'}
          </h1>
          {mode !== 'login' && (
            <button onClick={() => { setMode('login'); setError(''); setDevCode(null); }}
              className="text-xs text-blue-600 hover:underline mb-4 block">← Girişe dön</button>
          )}

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* E-posta — tüm modlarda göster */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com" required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Login: şifre */}
            {mode === 'login' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">Şifre</label>
                  <button type="button" onClick={() => { setMode('forgot'); setError(''); }}
                    className="text-xs text-blue-600 hover:underline">Şifremi unuttum</button>
                </div>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            )}

            {/* Login: 2FA */}
            {mode === 'login' && needs2FA && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">2FA Kodu</label>
                <input
                  value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="6 haneli kod" maxLength={6} required
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <p className="mt-1 text-xs text-slate-500">Geliştirme modunda kod server loguna yazılır.</p>
              </div>
            )}

            {/* Reset: kod + yeni şifre */}
            {mode === 'reset' && (
              <>
                {devCode && (
                  <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                    Geliştirme kodu: <strong>{devCode}</strong>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sıfırlama Kodu</label>
                  <input
                    value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6 haneli kod" maxLength={6} required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Yeni Şifre</label>
                  <input
                    type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="En az 6 karakter" minLength={6} required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </>
            )}

            <button type="submit" disabled={loading || remaining === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              {loading ? '…' : mode === 'login' ? 'Giriş Yap' : mode === 'forgot' ? 'Kod Gönder' : 'Şifreyi Güncelle'}
            </button>
            {mode !== 'reset' && remaining <= 2 && remaining > 0 && (
              <p className="text-center text-xs text-amber-600">
                ⚠️ {remaining} deneme hakkın kaldı
              </p>
            )}
            {remaining === 0 && (
              <p className="text-center text-xs text-red-600 font-medium">
                🔒 Çok fazla deneme — bir süre bekle
              </p>
            )}
          </form>

          {/* Demo hint — sadece login modunda */}
          {mode === 'login' && (
            <div className="mt-4 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
              <span className="font-semibold">Demo hesap:</span>{' '}
              <button type="button" className="underline hover:no-underline"
                onClick={() => { setEmail('demo@takaslat.com'); setPassword('demo1234'); }}>
                demo@takaslat.com / demo1234
              </button>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Hesabın yok mu?{' '}
            <Link to="/register" className="text-blue-600 font-medium hover:underline">Kayıt ol</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
