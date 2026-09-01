import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import type { ListingQA } from '../types';
import { answerListingQuestion, createListingQuestion, deleteListingQuestion, fetchListingQuestions } from '../services/api';
import { showToast } from './Toast';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)    return 'az önce';
  if (m < 60)   return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h} sa önce`;
  return new Date(iso).toLocaleDateString('tr-TR');
}

interface Props {
  listingId: string;
  ownerId:   string;
}

export default function ListingQASection({ listingId, ownerId }: Props) {
  const { currentUser, currentUserId } = useAppStore();

  const [question, setQuestion] = useState('');
  const [answerTo, setAnswerTo] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [qas, setQAs] = useState<ListingQA[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const isOwner = currentUserId === ownerId;

  async function loadQuestions() {
    setLoading(true);
    setLoadError('');
    try {
      setQAs(await fetchListingQuestions(listingId));
    } catch {
      setLoadError('Sorular şu anda yüklenemiyor');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchListingQuestions(listingId)
      .then((items) => {
        if (!cancelled) setQAs(items);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Sorular şu anda yüklenemiyor');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [listingId]);

  async function handleAsk(e: FormEvent) {
    e.preventDefault();
    if (!currentUser) { showToast('Soru sormak için giriş yap', 'error'); return; }
    if (isOwner) { showToast('Kendi ilanınıza soru soramazsınız', 'error'); return; }
    if (question.trim().length < 5 || question.trim().length > 500) {
      showToast('Soru 5 ile 500 karakter arasında olmalı', 'error');
      return;
    }
    setSaving(true);
    try {
      await createListingQuestion(listingId, question);
      setQuestion('');
      await loadQuestions();
      showToast('Sorunuz yayınlandı', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Soru gönderilemedi', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleAnswer(qaId: string, e: FormEvent) {
    e.preventDefault();
    if (!isOwner || answerText.trim().length < 2 || answerText.trim().length > 1000 || saving) return;
    setSaving(true);
    try {
      await answerListingQuestion(qaId, answerText);
      setAnswerText('');
      setAnswerTo(null);
      await loadQuestions();
      showToast('Yanıt kaydedildi', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Yanıt kaydedilemedi', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(qaId: string) {
    if (saving) return;
    setSaving(true);
    try {
      await deleteListingQuestion(qaId);
      setQAs((current) => current.filter((qa) => qa.id !== qaId));
      showToast('Soru silindi', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Soru silinemedi', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
        Soru-Cevap
        {qas.length > 0 && (
          <span className="text-xs font-normal bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
            {qas.length}
          </span>
        )}
      </h2>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
        İlan hakkında merak ettiklerini sor — ilan sahibi cevaplayacak
      </p>

      {/* Soru sorma formu */}
      {!isOwner && currentUser && (
        <form onSubmit={handleAsk} className="mb-5 flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            placeholder="Sorunu yaz... örn: Tüm bakımlar yetkili serviste mi yapıldı?"
            className="flex-1 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!question.trim() || saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
          >
            Sor
          </button>
        </form>
      )}

      {!currentUser && (
        <div className="mb-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-xl px-4 py-3 text-sm">
          <Link to="/login" className="text-blue-700 dark:text-blue-300 font-semibold hover:underline">
            Giriş yap →
          </Link>
          <span className="text-blue-600 dark:text-blue-400 ml-1">soru sorabilmek için</span>
        </div>
      )}

      {/* Sorular */}
      {loadError ? (
        <div className="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-500" role="status">
          {loadError}
        </div>
      ) : loading ? (
        <p className="py-6 text-center text-sm text-slate-400">Sorular yükleniyor...</p>
      ) : qas.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-slate-500 dark:text-slate-400">Henüz soru yok — ilk soruyu sen sor!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {qas.map((qa) => (
            <div key={qa.id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-4 space-y-3">
              {/* Soru */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-600 dark:text-slate-300">
                  {qa.userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{qa.userName}</p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{timeAgo(qa.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{qa.question}</p>
                </div>
                {qa.userId === currentUserId && (
                  <button
                    onClick={() => void handleDelete(qa.id)}
                    title="Sil"
                    className="text-slate-300 hover:text-red-500"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Yanıt */}
              {qa.answer ? (
                <div className="ml-10 flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-300">İlan Sahibi</span>
                      <span className="text-[10px] text-blue-500 dark:text-blue-400">{timeAgo(qa.answeredAt!)}</span>
                    </div>
                    <p className="text-sm text-blue-900 dark:text-blue-200">{qa.answer}</p>
                  </div>
                </div>
              ) : isOwner ? (
                <div className="ml-10">
                  {answerTo === qa.id ? (
                    <form onSubmit={(e) => handleAnswer(qa.id, e)} className="flex gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        maxLength={1000}
                        placeholder="Yanıtın..."
                        className="flex-1 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 rounded-lg">Yanıtla</button>
                      <button type="button" onClick={() => setAnswerTo(null)} className="text-xs text-slate-500 px-2">İptal</button>
                    </form>
                  ) : (
                    <button
                      onClick={() => { setAnswerTo(qa.id); setAnswerText(''); }}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Bu soruyu yanıtla
                    </button>
                  )}
                </div>
              ) : (
                <p className="ml-10 text-xs text-slate-400 dark:text-slate-500 italic">Yanıt bekleniyor…</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
