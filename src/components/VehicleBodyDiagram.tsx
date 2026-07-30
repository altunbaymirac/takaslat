import { useState } from 'react';

const PANEL_LABELS: Record<string, string> = {
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
  painted:  '#fde68a',
  changed:  '#fecaca',
};

// Üstten görünüm; paneller gerçek otomobil oranlarına yakın ayrı bölgeler olarak çizilir.
const PANELS: Array<{ id: string; d: string; lx: number; ly: number }> = [
  {
    id: 'on_tampon',
    d: 'M78,20 Q110,5 142,20 L160,34 L154,50 L66,50 L60,34 Z',
    lx: 110, ly: 33,
  },
  {
    id: 'on_kaput',
    d: 'M74,50 L146,50 L151,124 L69,124 Z',
    lx: 110, ly: 88,
  },
  {
    id: 'sol_on_camurluk',
    d: 'M66,50 L74,50 L69,124 L56,138 Q46,111 48,78 Q50,60 66,50 Z',
    lx: 58, ly: 91,
  },
  {
    id: 'sag_on_camurluk',
    d: 'M146,50 L154,50 Q170,60 172,78 Q174,111 164,138 L151,124 Z',
    lx: 162, ly: 91,
  },
  {
    id: 'tavan',
    d: 'M76,136 Q110,120 144,136 L147,260 Q110,278 73,260 Z',
    lx: 110, ly: 205,
  },
  {
    id: 'sol_on_kapi',
    d: 'M56,132 L76,136 L75,196 L50,196 L50,154 Z',
    lx: 62, ly: 166,
  },
  {
    id: 'sag_on_kapi',
    d: 'M144,136 L164,132 L170,154 L170,196 L145,196 Z',
    lx: 158, ly: 166,
  },
  {
    id: 'sol_arka_kapi',
    d: 'M50,196 L75,196 L73,260 L54,266 L50,242 Z',
    lx: 62, ly: 229,
  },
  {
    id: 'sag_arka_kapi',
    d: 'M145,196 L170,196 L170,242 L166,266 L147,260 Z',
    lx: 158, ly: 229,
  },
  {
    id: 'sol_arka_camurluk',
    d: 'M54,266 L73,260 L69,350 L62,350 Q48,330 48,294 Z',
    lx: 59, ly: 307,
  },
  {
    id: 'sag_arka_camurluk',
    d: 'M147,260 L166,266 L172,294 Q172,330 158,350 L151,350 Z',
    lx: 161, ly: 307,
  },
  {
    id: 'bagaj',
    d: 'M73,260 Q110,278 147,260 L151,350 L69,350 Z',
    lx: 110, ly: 313,
  },
  {
    id: 'arka_tampon',
    d: 'M69,350 L151,350 L158,366 Q110,390 62,366 Z',
    lx: 110, ly: 368,
  },
];

const WHEELS: Array<{ x: number; y: number }> = [
  { x: 33, y: 72 }, { x: 171, y: 72 },
  { x: 33, y: 282 }, { x: 171, y: 282 },
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

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        {/* SVG schematic */}
        <div className="flex-shrink-0">
          <svg
            viewBox="0 0 220 400"
            xmlns="http://www.w3.org/2000/svg"
            className="h-auto w-44 sm:w-52"
            style={{ cursor: editable ? 'pointer' : 'default' }}
          >
            {/* Direction labels */}
            <text x="110" y="10" textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="700" letterSpacing="1.2">ÖN</text>
            <text x="110" y="397" textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="700" letterSpacing="1.2">ARKA</text>

            {/* Tekerlekler */}
            {WHEELS.map((w, i) => (
              <rect key={i} x={w.x} y={w.y} width="16" height="54" rx="6" fill="#1e293b" />
            ))}

            <path
              d="M78,18 Q110,2 142,18 Q168,27 174,70 L174,320 Q170,360 150,378 Q110,396 70,378 Q50,360 46,320 L46,70 Q52,27 78,18 Z"
              fill="#f8fafc"
              stroke="#64748b"
              strokeWidth="2"
            />

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

            {/* Camlar ve kabin çizgileri */}
            <path d="M78,136 Q110,123 142,136 L139,158 L81,158 Z" fill="#bfdbfe" stroke="#60a5fa" strokeWidth="1" pointerEvents="none" />
            <path d="M81,164 L139,164 L141,232 L79,232 Z" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1" pointerEvents="none" />
            <path d="M79,238 L141,238 L145,258 Q110,271 75,258 Z" fill="#bfdbfe" stroke="#60a5fa" strokeWidth="1" pointerEvents="none" />
            <line x1="110" y1="164" x2="110" y2="232" stroke="#93c5fd" strokeWidth="1" pointerEvents="none" />
            <path d="M51,151 L43,144 L42,158 L50,164 Z M169,151 L177,144 L178,158 L170,164 Z" fill="#64748b" pointerEvents="none" />

            {/* Hover tooltip panel name */}
            {hovered && editable && (
              <g>
                <rect x="8" y="2" width="204" height="13" rx="3" fill="rgba(15,23,42,0.82)" />
                <text x="110" y="11" textAnchor="middle" fontSize="6.5" fill="white" fontWeight="600">
                  {PANEL_LABELS[hovered]}: {panelState(hovered, paintedParts, changedParts) === 'original' ? 'Orijinal → Boyalı' : panelState(hovered, paintedParts, changedParts) === 'painted' ? 'Boyalı → Değişen' : 'Değişen → Orijinal'}
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
