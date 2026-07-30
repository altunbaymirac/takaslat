import type { Listing, VerificationState } from '../types';
import { getVehiclePassport } from '../lib/swapIntelligence';

const stateLabel: Record<VerificationState, string> = {
  verified: 'Doğrulandı',
  pending: 'Kontrol bekliyor',
  not_started: 'Henüz yok',
};

const stateClass: Record<VerificationState, string> = {
  verified: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300',
  pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300',
  not_started: 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
};

export default function VehiclePassport({ listing }: { listing: Listing }) {
  const passport = getVehiclePassport(listing);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Araç Pasaportu
          </p>
          <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
            Beyan ve doğrulama durumu
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Doğrulanmış kayıtlar ile satıcının girdiği bilgiler ayrı gösterilir.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">%{passport.score}</p>
            <p className="text-[11px] font-semibold text-slate-400">{passport.label}</p>
          </div>
          <div
            className="h-12 w-12 rounded-full p-1"
            style={{ background: `conic-gradient(#10b981 ${passport.score * 3.6}deg, #e2e8f0 0deg)` }}
            aria-label={`Pasaport puanı yüzde ${passport.score}`}
          >
            <div className="h-full w-full rounded-full bg-white dark:bg-slate-800" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {passport.items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-700">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.label}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.detail}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${stateClass[item.state]}`}>
              {stateLabel[item.state]}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
        Pasaport puanı karar desteğidir. Ekspertiz, EİDS, noter ve resmi kayıt kontrollerinin yerine geçmez.
      </p>
    </section>
  );
}
