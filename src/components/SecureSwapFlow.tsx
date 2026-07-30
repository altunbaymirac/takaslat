import type { SwapOffer } from '../types';
import { SWAP_PROCESS_STEPS } from '../lib/swapIntelligence';
import { useAppStore } from '../store/useAppStore';

export default function SecureSwapFlow({ offer }: { offer: SwapOffer }) {
  const process = useAppStore((state) => state.swapProcesses[offer.id]);
  const toggleStep = useAppStore((state) => state.toggleSwapProcessStep);
  const completed = process?.completedSteps ?? [];
  const progress = Math.round(completed.length / SWAP_PROCESS_STEPS.length * 100);
  const isAvailable = offer.status === 'Onaylandı' || offer.status === 'Tamamlandı';

  return (
    <section className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Güvenli Takas</p>
          <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">Tekliften devire işlem planı</h3>
        </div>
        <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">%{progress}</span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {!isAvailable && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          Kontrol listesi, teklif iki tarafça onaylandıktan sonra açılır.
        </p>
      )}

      <div className="mt-3 space-y-2">
        {SWAP_PROCESS_STEPS.map((step, index) => {
          const done = completed.includes(step.id);
          return (
            <button
              key={step.id}
              type="button"
              disabled={!isAvailable || offer.status === 'Tamamlandı'}
              onClick={() => toggleStep(offer.id, step.id)}
              className="flex w-full items-start gap-3 rounded-lg border border-emerald-100 bg-white p-3 text-left transition-colors hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/30 dark:bg-slate-900"
            >
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-700'
              }`}>
                {done ? '✓' : index + 1}
              </span>
              <span>
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">{step.label}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{step.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
        Bu kontrol listesi resmi kurum doğrulaması değildir. Entegrasyon tamamlandığında EİDS, ekspertiz, güvenli ödeme ve noter kayıtları otomatik işaretlenecektir.
      </p>
    </section>
  );
}
