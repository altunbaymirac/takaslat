import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/api';
import { showToast } from '../components/Toast';
import { useSEO } from '../hooks/useSEO';

export default function ResetPassword() {
  useSEO({ title: 'Yeni Şifre Belirle' });

  const navigate  = useNavigate();
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [tokenOk,   setTokenOk]   = useState(false);

  // Supabase, URL fragment'taki access_token'ı otomatik alır.
  // onAuthStateChange ile session hazır olunca tokenOk = true yaparız.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setTokenOk(true);
    });
    // Sayfa zaten SESSION var mı kontrol et (link daha önce açıldıysa)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setTokenOk(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Şifreler eşleşmiyor'); return; }
    if (password.length < 6)  { setError('Şifre en az 6 karakter olmalı'); return; }
    setError('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw new Error(err.message);
      showToast('Şifren güncellendi, giriş yapabilirsin', 'success');
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncelleme başarısız');
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
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Yeni şifre belirle</h1>

          {!tokenOk ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-500">Bağlantı doğrulanıyor…</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl banner-enter">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Yeni Şifre</label>
                  <input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="En az 6 karakter" minLength={6} required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Şifre Tekrar</label>
                  <input
                    type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Şifreni tekrar gir" minLength={6} required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
                <button
                  type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  {loading ? '…' : 'Şifremi Güncelle'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
