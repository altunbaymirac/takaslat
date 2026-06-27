import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useSEO } from '../hooks/useSEO';
import { checkRateLimit, resetRateLimit, getRemainingAttempts } from '../lib/rateLimit';
import { checkPasswordStrength } from '../lib/sanitize';
import { signInWithGoogle } from '../services/api';
import { showToast } from '../components/Toast';
import { CITIES_81 } from '../data/cities';

export default function Register() {
  useSEO({ title: 'Kayıt Ol', description: 'Takaslat\'a ücretsiz kayıt ol ve araç takasına hemen başla.' });

  const navigate = useNavigate();
  const registerUser = useAppStore((s) => s.registerUser);

  const { acceptTerms } = useAppStore();
  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [city,         setCity]         = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsOpen,    setTermsOpen]    = useState(false);
  const pwScore = checkPasswordStrength(password);
  const remaining = getRemainingAttempts('register', 'global');
  const [searchParams] = useSearchParams();
  const refId = searchParams.get('ref');
  const redirectTo = searchParams.get('redirect') || '/';

  useEffect(() => {
    if (refId) {
      // Davet kodunu localStorage'a yaz — register sonrası bonus için
      localStorage.setItem('takaslat-referred-by', refId);
    }
  }, [refId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalı'); return; }
    if (pwScore.score < 1) { setError('Daha güçlü bir şifre seç'); return; }
    setLoading(true);
    try {
      checkRateLimit('register', 'global');
      await registerUser(name, email, password, city || undefined);
      acceptTerms();
      resetRateLimit('register', 'global');
      navigate(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2d6e] via-[#1B4FD8] to-[#1e40af] flex items-center justify-center px-4 py-10">
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
          <h1 className="text-xl font-bold text-slate-900 mb-6">Yeni hesap oluştur</h1>

          {refId && (
            <div className="mb-4 px-4 py-3 bg-pink-50 border border-pink-200 rounded-xl flex items-center gap-2">
              <span className="text-xl">🎁</span>
              <div>
                <p className="text-xs font-bold text-pink-700">Davet ile geliyorsun!</p>
                <p className="text-[11px] text-pink-600">Hoş geldin bonusu kazanacaksın</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ahmet Yılmaz"
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              {password.length > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[0,1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < pwScore.score ? 'bg-current' : 'bg-slate-200'} ${pwScore.color}`} />
                    ))}
                  </div>
                  <span className={`text-xs font-medium ${pwScore.color}`}>{pwScore.label}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Şehir <span className="text-slate-400 font-normal">(isteğe bağlı)</span>
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
              >
                <option value="">Seçin…</option>
                {CITIES_81.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Kullanım koşulları */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsChecked}
                  onChange={e => setTermsChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-blue-600 flex-shrink-0"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  <button
                    type="button"
                    onClick={() => setTermsOpen(v => !v)}
                    className="font-semibold text-blue-600 hover:underline"
                  >Kullanım Koşulları</button>
                  {' '}ve{' '}
                  <button
                    type="button"
                    onClick={() => setTermsOpen(v => !v)}
                    className="font-semibold text-blue-600 hover:underline"
                  >Gizlilik Politikası</button>
                  'nı okudum, takas işlemlerimin yasal yükümlülüklerinden şahsen sorumlu olduğumu kabul ediyorum.
                </span>
              </label>

              {termsOpen && (
                <div className="mt-2 space-y-2 text-xs text-slate-600 border-t border-slate-200 pt-2">
                  <p><strong>Platform:</strong> Takaslat bir aracı platformdur; takas işlemlerinin tarafı değildir.</p>
                  <p className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-800">
                    <strong>⚠️ Vergi Uyarısı:</strong> Takas işlemleri Türk vergi mevzuatı kapsamında gelir vergisi veya KDV'ye konu olabilir. Takaslat bu yükümlülüklerden sorumlu tutulamaz.
                  </p>
                  <p><strong>Güvenli takas:</strong> Araç devri noterden yapılmalı, kapora öncesi aracı yerinde görün.</p>
                  <p><strong>Yasak:</strong> Sahte ilan, dolandırıcılık ve yasadışı ürün listeleme hesap kapatma sebebidir.</p>
                  <p><strong>Gizlilik:</strong> Verileriniz KVKK kapsamında korunur, üçüncü şahıslarla satılmaz.</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || remaining === 0 || !termsChecked}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              {loading ? 'Hesap oluşturuluyor…' : 'Kayıt Ol'}
            </button>
            {remaining <= 1 && remaining > 0 && (
              <p className="text-center text-xs text-amber-600">⚠️ Son kayıt denemesi</p>
            )}
            {remaining === 0 && (
              <p className="text-center text-xs text-red-600 font-medium">🔒 Çok fazla deneme — bir süre bekle</p>
            )}
          </form>

          <div className="my-5 flex items-center gap-3">
            <hr className="flex-1 border-slate-200" />
            <span className="text-xs text-slate-400">ya da hızlıca</span>
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
            Google ile Kayıt Ol
          </button>

          <p className="mt-6 text-center text-sm text-slate-500">
            Zaten hesabın var mı?{' '}
            <Link to={redirectTo !== '/' ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'} className="text-blue-600 font-medium hover:underline">
              Giriş yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
