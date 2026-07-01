import { useState } from 'react';

export const PANEL_LABELS: Record<string, string> = {
  on_tampon:         'Ön Tampon',
  on_kaput:          'Ön Kaput',
  sol_on_camurluk:   'Sol Ön Çamurluk',
  sag_on_camurluk:   'Sağ Ön Çamurluk',
  tavan:             'Tavan',
  sol_on_kapi:       'Sol Ön Kapı',
  sag_on_kapi:       'Sağ Ön Kapı',
  sol_arka_kapi:     'Sol Arka Kapı',
  sag_arka_kapi:     'Sağ Arka Kapı',
  sol_arka_camurluk: 'Sol Arka Çamurluk',
  sag_arka_camurluk: 'Sağ Arka Çamurluk',
  bagaj:             'Bagaj Kapağı',
  arka_tampon:       'Arka Tampon',
};

type PanelState = 'original' | 'painted' | 'changed';

interface Props {
  paintedParts: string[];
  changedParts: string[];
  onPaintedChange?: (parts: string[]) => void;
  onChangedChange?: (parts: string[]) => void;
}

function panelState(id: string, painted: string[], changed: string[]): PanelState {
  if (changed.includes(id)) return 'changed';
  if (painted.includes(id)) return 'painted';
  return 'original';
}

const FILL: Record<PanelState, string> = {
  original: '#e2e8f0',
  painted:  '#fbbf24',
  changed:  '#f87171',
};
const STROKE: Record<PanelState, string> = {
  original: '#94a3b8',
  painted:  '#d97706',
  changed:  '#dc2626',
};
const HOVER_FILL: Record<PanelState, string> = {
  original: '#dbeafe',
  painted:  '#fca5a5',
  changed:  '#e2e8f0',
};

// ViewBox: 0 0 160 360 — araç üstten görünüm (yuvarlak burun/kuyruk, tekerlekli)
const PANELS: Array<{ id: string; d: string; lx: number; ly: number }> = [
  {
    id: 'on_tampon',
    d: 'M80,10 C94,10 104,17 106,27 L106,36 L54,36 L54,27 C56,17 66,10 80,10 Z',
    lx: 80, ly: 24,
  },
  {
    id: 'on_kaput',
    d: 'M96,36 L64,36 L64,140 L96,140 Z',
    lx: 80, ly: 88,
  },
  {
    id: 'sol_on_camurluk',
    d: 'M64,36 L52,36 L52,140 L64,140 Z',
    lx: 58, ly: 88,
  },
  {
    id: 'sag_on_camurluk',
    d: 'M96,36 L108,36 L108,140 L96,140 Z',
    lx: 102, ly: 88,
  },
  {
    id: 'tavan',
    d: 'M64,140 L96,140 L96,224 L64,224 Z',
    lx: 80, ly: 182,
  },
  {
    id: 'sol_on_kapi',
    d: 'M52,140 L64,140 L64,182 L52,182 Z',
    lx: 58, ly: 161,
  },
  {
    id: 'sag_on_kapi',
    d: 'M108,140 L96,140 L96,182 L108,182 Z',
    lx: 102, ly: 161,
  },
  {
    id: 'sol_arka_kapi',
    d: 'M52,182 L64,182 L64,224 L52,224 Z',
    lx: 58, ly: 203,
  },
  {
    id: 'sag_arka_kapi',
    d: 'M108,182 L96,182 L96,224 L108,224 Z',
    lx: 102, ly: 203,
  },
  {
    id: 'sol_arka_camurluk',
    d: 'M64,224 L52,224 L52,328 L64,328 Z',
    lx: 58, ly: 276,
  },
  {
    id: 'sag_arka_camurluk',
    d: 'M96,224 L108,224 L108,328 L96,328 Z',
    lx: 102, ly: 276,
  },
  {
    id: 'bagaj',
    d: 'M96,224 L64,224 L64,328 L96,328 Z',
    lx: 80, ly: 276,
  },
  {
    id: 'arka_tampon',
    d: 'M54,328 L106,328 L106,337 C104,347 94,354 80,354 C66,354 56,347 54,337 Z',
    lx: 80, ly: 344,
  },
];

// Tekerlekler — dekoratif, gövde kenarından hafif taşan
const WHEELS: Array<{ x: number; y: number }> = [
  { x: 44, y: 68 }, { x: 106, y: 68 },
  { x: 44, y: 252 }, { x: 106, y: 252 },
];

export default function VehicleBodyDiagram({ paintedParts, changedParts, onPaintedChange, onChangedChange }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const editable = !!(onPaintedChange && onChangedChange);

  function handleClick(id: string) {
    if (!editable) return;
    const s = panelState(id, paintedParts, changedParts);
    if (s === 'original') {
      onPaintedChange!([...paintedParts, id]);
    } else if (s === 'painted') {
      onPaintedChange!(paintedParts.filter(p => p !== id));
      onChangedChange!([...changedParts, id]);
    } else {
      onChangedChange!(changedParts.filter(p => p !== id));
    }
  }

  const affected = paintedParts.length > 0 || changedParts.length > 0;

  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>Parçaya tıklayarak işaretle:</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-400 border border-amber-500" />
            Boyalı
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-400 border border-red-500" />
            Değişen
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-slate-200 border border-slate-400" />
            Orijinal
          </span>
        </div>
      )}

      <div className="flex gap-5 items-start">
        {/* SVG schematic */}
        <div className="flex-shrink-0">
          <svg
            viewBox="0 0 160 360"
            xmlns="http://www.w3.org/2000/svg"
            className="w-36 h-auto"
            style={{ cursor: editable ? 'pointer' : 'default' }}
          >
            {/* Direction labels */}
            <text x="80" y="7" textAnchor="middle" fontSize="6" fill="#94a3b8" fontWeight="600" letterSpacing="1">ÖN</text>
            <text x="80" y="358" textAnchor="middle" fontSize="6" fill="#94a3b8" fontWeight="600" letterSpacing="1">ARKA</text>

            {/* Tekerlekler */}
            {WHEELS.map((w, i) => (
              <rect key={i} x={w.x} y={w.y} width="10" height="40" rx="3" fill="#334155" />
            ))}

            {/* Panels */}
            {PANELS.map(({ id, d, lx, ly }) => {
              const s = panelState(id, paintedParts, changedParts);
              const isHov = hovered === id;
              return (
                <g key={id} onClick={() => handleClick(id)} onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)}>
                  <path
                    d={d}
                    fill={isHov && editable ? HOVER_FILL[s] : FILL[s]}
                    stroke={STROKE[s]}
                    strokeWidth="0.75"
                    style={{ transition: 'fill 0.1s' }}
                  />
                  {s !== 'original' && (
                    <text x={lx} y={ly} textAnchor="middle" fontSize="5" fill={s === 'changed' ? '#7f1d1d' : '#78350f'} pointerEvents="none" fontWeight="600">
                      {s === 'painted' ? 'B' : 'D'}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Ön/arka cam — dekoratif, panel sınırlarının üstünde */}
            <rect x="64" y="128" width="32" height="14" rx="2" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="0.5" pointerEvents="none" />
            <rect x="64" y="210" width="32" height="14" rx="2" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="0.5" pointerEvents="none" />

            {/* Hover tooltip panel name */}
            {hovered && editable && (
              <g>
                <rect x="4" y="1" width="152" height="10" rx="2" fill="rgba(15,23,42,0.75)" />
                <text x="80" y="8.5" textAnchor="middle" fontSize="5.5" fill="white" fontWeight="500">
                  {PANEL_LABELS[hovered]} — {panelState(hovered, paintedParts, changedParts) === 'original' ? 'Orijinal → Boyalı' : panelState(hovered, paintedParts, changedParts) === 'painted' ? 'Boyalı → Değişen' : 'Değişen → Orijinal'}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Affected parts summary */}
        <div className="flex-1 min-w-0 pt-1">
          {affected ? (
            <div className="space-y-2">
              {changedParts.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 mb-1">
                    Değişen parçalar ({changedParts.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {changedParts.map(p => (
                      <span key={p} className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50">
                        {PANEL_LABELS[p]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {paintedParts.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">
                    Boyalı parçalar ({paintedParts.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {paintedParts.map(p => (
                      <span key={p} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                        {PANEL_LABELS[p]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {editable && (
                <button
                  type="button"
                  onClick={() => { onPaintedChange!([]); onChangedChange!([]); }}
                  className="text-[11px] text-slate-400 hover:text-red-500 dark:hover:text-red-400 mt-1"
                >
                  Tümünü sıfırla
                </button>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 dark:text-slate-500 pt-2 leading-relaxed">
              {editable
                ? 'Boyalı veya değiştirilen parça varsa sol şemada ilgili bölgeye tıklayın.\nB = Boya yapılmış, D = Panel değiştirilmiş'
                : 'Boya veya değişen parça bilgisi girilmemiş.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
