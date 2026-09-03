import { useState } from 'react';

const PANEL_LABELS: Record<string, string> = {
  on_tampon:         'Ön Tampon',
  on_kaput:          'Motor Kaputu',
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
  original: '#eef2f7',
  painted:  '#2563eb',
  changed:  '#ef4444',
};
const STROKE: Record<PanelState, string> = {
  original: '#cbd5e1',
  painted:  '#1d4ed8',
  changed:  '#dc2626',
};

/** Üstten görünüm. Paneller aralarında boşluk kalacak şekilde ayrı çizilir. */
type Panel = { id: string; x: number; y: number; w: number; h: number; rx: number };

const PANELS: Panel[] = [
  { id: 'on_tampon',         x: 68,  y: 14,  w: 104, h: 26, rx: 12 },
  { id: 'sol_on_camurluk',   x: 46,  y: 46,  w: 22,  h: 72, rx: 9  },
  { id: 'on_kaput',          x: 72,  y: 46,  w: 96,  h: 72, rx: 10 },
  { id: 'sag_on_camurluk',   x: 172, y: 46,  w: 22,  h: 72, rx: 9  },

  { id: 'sol_on_kapi',       x: 46,  y: 124, w: 26,  h: 78, rx: 8  },
  { id: 'tavan',             x: 76,  y: 124, w: 88,  h: 156, rx: 14 },
  { id: 'sag_on_kapi',       x: 168, y: 124, w: 26,  h: 78, rx: 8  },

  { id: 'sol_arka_kapi',     x: 46,  y: 206, w: 26,  h: 74, rx: 8  },
  { id: 'sag_arka_kapi',     x: 168, y: 206, w: 26,  h: 74, rx: 8  },

  { id: 'sol_arka_camurluk', x: 46,  y: 286, w: 22,  h: 72, rx: 9  },
  { id: 'bagaj',             x: 72,  y: 286, w: 96,  h: 72, rx: 10 },
  { id: 'sag_arka_camurluk', x: 172, y: 286, w: 22,  h: 72, rx: 9  },

  { id: 'arka_tampon',       x: 68,  y: 364, w: 104, h: 26, rx: 12 },
];

const WHEELS = [
  { cx: 30, cy: 92 }, { cx: 210, cy: 92 },
  { cx: 30, cy: 322 }, { cx: 210, cy: 322 },
];

function PartList({ title, color, parts }: { title: string; color: 'blue' | 'red'; parts: string[] }) {
  if (parts.length === 0) return null;
  const swatch = color === 'blue' ? 'bg-blue-600' : 'bg-red-500';
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        <span className={`inline-block h-3 w-3 rounded-sm ${swatch}`} />
        {title}
        <span className="text-xs font-semibold text-slate-400">({parts.length})</span>
      </p>
      <ul className="mt-1.5 space-y-1">
        {parts.map((part) => (
          <li key={part} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span className="text-slate-300 dark:text-slate-600">•</span>
            {PANEL_LABELS[part] ?? part}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function VehicleBodyDiagram({ paintedParts, changedParts, onPaintedChange, onChangedChange }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const editable = !!(onPaintedChange && onChangedChange);

  function handleClick(id: string) {
    if (!editable) return;
    const state = panelState(id, paintedParts, changedParts);
    if (state === 'original') {
      onPaintedChange!([...paintedParts, id]);
    } else if (state === 'painted') {
      onPaintedChange!(paintedParts.filter((part) => part !== id));
      onChangedChange!([...changedParts, id]);
    } else {
      onChangedChange!(changedParts.filter((part) => part !== id));
    }
  }

  const affected = paintedParts.length > 0 || changedParts.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="mx-auto shrink-0 sm:mx-0">
          <svg
            viewBox="0 0 240 404"
            xmlns="http://www.w3.org/2000/svg"
            className="h-auto w-48 sm:w-56"
            style={{ cursor: editable ? 'pointer' : 'default' }}
            role="img"
            aria-label="Araç kaporta şeması"
          >
            <text x="120" y="9" textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="700" letterSpacing="1.5">ÖN</text>

            {WHEELS.map((wheel, index) => (
              <circle key={index} cx={wheel.cx} cy={wheel.cy} r="15" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
            ))}

            {PANELS.map(({ id, x, y, w, h, rx }) => {
              const state = panelState(id, paintedParts, changedParts);
              const isHovered = hovered === id;
              return (
                <rect
                  key={id}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={rx}
                  fill={FILL[state]}
                  stroke={STROKE[state]}
                  strokeWidth="1.5"
                  opacity={isHovered && editable ? 0.75 : 1}
                  onClick={() => handleClick(id)}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ transition: 'fill 120ms ease, opacity 120ms ease' }}
                >
                  <title>{PANEL_LABELS[id]}</title>
                </rect>
              );
            })}

            {/* Ön ve arka cam çizgileri — panel değil, yön belli olsun diye */}
            <rect x="84" y="128" width="72" height="20" rx="6" fill="#ffffff" opacity="0.55" pointerEvents="none" />
            <rect x="84" y="256" width="72" height="20" rx="6" fill="#ffffff" opacity="0.55" pointerEvents="none" />

            <text x="120" y="400" textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="700" letterSpacing="1.5">ARKA</text>
          </svg>

          {editable && (
            <p className="mt-2 max-w-56 text-center text-[11px] leading-4 text-slate-400">
              Parçaya tıkla: orijinal → boyalı → değişen
            </p>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          {affected ? (
            <>
              <PartList title="Boyalı" color="blue" parts={paintedParts} />
              <PartList title="Değişen" color="red" parts={changedParts} />
              {editable && (
                <button
                  type="button"
                  onClick={() => { onPaintedChange!([]); onChangedChange!([]); }}
                  className="text-xs font-semibold text-slate-400 transition-colors hover:text-red-500"
                >
                  Tümünü sıfırla
                </button>
              )}
            </>
          ) : (
            <div className="rounded-lg bg-emerald-50 px-4 py-3 dark:bg-emerald-900/20">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Tamamı orijinal</p>
              <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                {editable
                  ? 'Boyalı veya değişen parça varsa şemadan işaretle.'
                  : 'Satıcı boyalı veya değişen parça bildirmedi.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
