import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { fetchListingByCode } from '../services/api';
import VoiceSearch from './VoiceSearch';

const LISTING_CODE_RE = /^TKS-\d{7}$/i;

/**
 * İlan aramasının tek giriş noktası: serbest metin ve ilan kodu aynı kutudan
 * çalışır. Kod girilirse doğrudan ilana gidilir, aksi halde arama filtresi
 * güncellenir ve adres çubuğuna ?q= olarak yazılır.
 */
export default function ListingSearchBar({ onSearch }: { onSearch?: () => void }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, setFilters, listings } = useAppStore();

  const [draft, setDraft] = useState(filters.searchQuery);
  const [syncedQuery, setSyncedQuery] = useState(filters.searchQuery);
  const [codeSearching, setCodeSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dışarıdan (kayıtlı arama, ?q=, sıfırlama) gelen değişikliği render sırasında yansıt.
  if (filters.searchQuery !== syncedQuery) {
    setSyncedQuery(filters.searchQuery);
    setDraft(filters.searchQuery);
  }

  async function goToListingCode(code: string) {
    const local = listings.find((l) => l.listingCode?.toUpperCase() === code.toUpperCase());
    if (local) {
      navigate(`/listing/${local.id}`);
      return true;
    }
    setCodeSearching(true);
    try {
      const listing = await fetchListingByCode(code);
      if (listing) {
        navigate(`/listing/${listing.id}`);
        return true;
      }
    } catch {
      // Kod bulunamazsa normal aramaya düşer.
    } finally {
      setCodeSearching(false);
    }
    return false;
  }

  async function submit(value: string) {
    const term = value.trim();

    if (LISTING_CODE_RE.test(term) && await goToListingCode(term)) return;

    setFilters({ searchQuery: term });
    const next = new URLSearchParams(searchParams);
    if (term) next.set('q', term);
    else next.delete('q');
    setSearchParams(next, { replace: true });
    onSearch?.();
  }

  function clear() {
    setDraft('');
    void submit('');
    inputRef.current?.focus();
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:ring-blue-900/40">
      <svg className="h-5 w-5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>

      <input
        ref={inputRef}
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void submit(draft); }}
        aria-label="İlan ara"
        placeholder="Marka, model, şehir ya da ilan kodu ara"
        className="h-12 min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 [&::-webkit-search-cancel-button]:hidden"
      />

      {draft && (
        <button
          type="button"
          onClick={clear}
          aria-label="Aramayı temizle"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <VoiceSearch onResult={(text) => { setDraft(text); void submit(text); }} />

      <button
        type="button"
        onClick={() => void submit(draft)}
        disabled={codeSearching}
        className="btn-primary my-2 shrink-0 rounded-md px-4 py-2 text-sm font-bold"
      >
        {codeSearching ? 'Aranıyor…' : 'Ara'}
      </button>
    </div>
  );
}
