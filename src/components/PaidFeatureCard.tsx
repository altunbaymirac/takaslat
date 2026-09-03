import { FEATURE_LABELS, type PaidFeature } from '../lib/entitlements';

/**
 * Henüz satın alınamayan bir özelliğin yerini tutar. Ödeme akışı bağlandığında
 * `onUpgrade` verilerek doğrudan satın alma ekranına bağlanabilir.
 */
export default function PaidFeatureCard({
  feature,
  onUpgrade,
}: {
  feature: PaidFeature;
  onUpgrade?: () => void;
}) {
  const { title, description } = FEATURE_LABELS[feature];

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
      <button
        type="button"
        onClick={onUpgrade}
        disabled={!onUpgrade}
        className="mt-3 w-full rounded-lg border border-slate-300 bg-white py-2 text-xs font-bold text-slate-500 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
      >
        {onUpgrade ? 'Paketi görüntüle' : 'Yakında'}
      </button>
    </div>
  );
}
