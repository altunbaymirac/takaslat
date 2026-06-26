import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { forgotPassword, signInWithGoogle } from '../services/api';
import { showToast } from '../components/Toast';
import { useSEO } from '../hooks/useSEO';
import { checkRateLimit, resetRateLimit, getRemainingAttempts } from '../lib/rateLimit';

type Mode = 'login' | 'forgot' | 'sent';

export default function Login() {
  useSEO({ title: 'Giriş Yap', description: 'Takaslat hesabına giriş yap ve araç takas ilanlarını keşfet.' });

  const navigate = useNavigate();
  const loginUser = useAppStore((s) => s.loginUser);

  const [mode,          setMode]         = useState<Mode>('login');
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [needs2FA,      setNeeds2FA]      = useState(false);
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);

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
        await forgotPassword(email);
        setMode('sent');
        showToast('E-posta gönderildi', 'success');
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
            {mode === 'login' ? 'Hesabına giriş yap' : mode === 'forgot' ? 'Şifreni sıfırla' : 'E-posta gönderildi'}
          </h1>
          {mode !== 'login' && mode !== 'sent' && (
            <button onClick={() => { setMode('login'); setError(''); }}
              className="text-xs text-blue-600 hover:underline mb-4 block">← Girişe dön</button>
          )}

          {/* E-posta gönderildi ekranı */}
          {mode === 'sent' && (
            <div className="py-4 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-3xl">📬</div>
              <p className="text-sm text-slate-600">
                <strong>{email}</strong> adresine şifre sıfırlama bağlantısı gönderdik.
              </p>
              <p className="text-xs text-slate-400">Gelen kutunu kontrol et — spam klasörünü de!</p>
              <button
                onClick={() => { setMode('login'); setError(''); }}
                className="text-sm text-blue-600 hover:underline"
              >
                ← Girişe dön
              </button>
            </div>
          )}

          {mode !== 'sent' && (
            <>
              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* E-posta */}
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Doğrulama Kodu</label>
                    <input
                      value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)}
                      placeholder="6 haneli kod" maxLength={6} required
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                )}

                <button type="submit" disabled={loading || remaining === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  {loading ? '…' : mode === 'login' ? 'Giriş Yap' : 'Sıfırlama Bağlantısı Gönder'}
                </button>
                {remaining <= 2 && remaining > 0 && (
                  <p className="text-center text-xs text-amber-600">⚠️ {remaining} deneme hakkın kaldı</p>
                )}
                {remaining === 0 && (
                  <p className="text-center text-xs text-red-600 font-medium">🔒 Çok fazla deneme — bir süre bekle</p>
                )}
              </form>
            </>
          )}

          {mode === 'login' && (
            <>
              <div className="my-5 flex items-center gap-3">
                <hr className="flex-1 border-slate-200" />
                <span className="text-xs text-slate-400">ya da</span>
                <hr className="flex-1 border-slate-200" />
              </div>
              <button
                type="button"
                onClick={async () => { try { await signInWithGoogle(); } catch { showToast('Google ile giriş başarısız', 'error'); } }}
                className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google ile Giriş Yap
              </button>
            </>
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
