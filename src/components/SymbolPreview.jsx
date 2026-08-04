import {
  halfPath, divisionSegments, quarterPath, quarterBoundary,
  CLINICAL_FILL, CLINICAL_STROKE,
  trianglePath, triangleCrossLines,
  zigzagPoints, gapSegments, doubleLineSegments, hatchSegments, DISTANT_DASH,
} from '../utils/symbols';

const USAGE_KEY = 'genogram-symbol-usage';
const LEGACY_RECENT_KEY = 'genogram-recent-symbols';

/**
 * 每個符號用過幾次：{ [key]: count }。用來決定快捷列表裡符號的排列順序
 * ——常用的自然浮到前面。
 */
export const loadUsage = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY));
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
    // 舊版的「最近使用」是陣列，愈前面代表愈近期；換算成次數，別讓習慣歸零
    const legacy = JSON.parse(localStorage.getItem(LEGACY_RECENT_KEY));
    if (Array.isArray(legacy)) {
      const seed = {};
      legacy.forEach((k, i) => { seed[k] = legacy.length - i; });
      return seed;
    }
  } catch { /* 壞掉的紀錄就當沒有 */ }
  return {};
};

export const bumpUsage = (key) => {
  const cur = loadUsage();
  const next = { ...cur, [key]: (cur[key] || 0) + 1 };
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(next)); } catch { /* 忽略 */ }
  return next;
};

/**
 * 符號的小預覽圖：快捷列表的圖示、拖曳中跟著游標的分身、說明書的符號
 * 對照表都共用同一個畫法，一律用方形（男性）示意。
 */
export const SymbolPreview = ({ symbol, size = 24 }) => {
  const r = size / 2 - 2;
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} aria-hidden="true">
      {symbol.kind === 'kinship' ? (
        <>
          <line x1="0" y1={-r - 1} x2="0" y2="0" stroke="#334155" strokeWidth="1.6"
                strokeDasharray={symbol.dash} />
          <rect x={-r + 2} y="0" width={(r - 2) * 2} height={r - 2} fill="#fff" stroke="#334155" strokeWidth="1.6" />
        </>
      ) : symbol.kind === 'standalone' ? (
        <>
          <path d={trianglePath(r)} fill="#fff" stroke="#334155" strokeWidth="1.8" />
          {symbol.cross && triangleCrossLines(r).map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#334155" strokeWidth="1.4" />
          ))}
        </>
      ) : symbol.kind === 'relLine' ? (
        <>
          {symbol.lineStyle === 'dashed' && (
            <line x1={-r} y1="0" x2={r} y2="0" stroke="#334155" strokeWidth="1.8" strokeDasharray={DISTANT_DASH} />
          )}
          {(symbol.lineStyle === 'zigzag' || symbol.lineStyle === 'zigzagRed') && (
            <polyline
              points={zigzagPoints(-r, 0, r, 0, symbol.lineStyle === 'zigzagRed' ? 4 : 3.5, 6)}
              fill="none" stroke={symbol.lineStyle === 'zigzagRed' ? '#dc2626' : '#334155'} strokeWidth="1.8" />
          )}
          {symbol.lineStyle === 'gap' && gapSegments(-r, 0, r, 0).map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#334155" strokeWidth="1.8" />
          ))}
          {symbol.lineStyle === 'double' && doubleLineSegments(-r, 0, r, 0, 2.4).map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#334155" strokeWidth="1.6" />
          ))}
          {symbol.lineStyle === 'hatch' && (
            <>
              <line x1={-r} y1="0" x2={r} y2="0" stroke="#334155" strokeWidth="1.8" />
              {hatchSegments(-r, 0, r, 0, 3, 6).map(([x1, y1, x2, y2], i) => (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#334155" strokeWidth="1.6" />
              ))}
            </>
          )}
        </>
      ) : (
        <>
          <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="#fff" stroke="#334155" strokeWidth="1.8" />
          {symbol.half && (
            <>
              <path d={halfPath('M', symbol.half, r)} fill={CLINICAL_FILL} />
              {divisionSegments([symbol.half], r).map(([x1, y1, x2, y2], i) => (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={CLINICAL_STROKE} strokeWidth="1.6" />
              ))}
            </>
          )}
          {symbol.quarter && (
            <>
              <path d={quarterPath('M', r)} fill={CLINICAL_FILL} />
              {quarterBoundary(r).map(([x1, y1, x2, y2], i) => (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={CLINICAL_STROKE} strokeWidth="1.6" />
              ))}
            </>
          )}
          {symbol.key === 'disabled' && <path d={halfPath('M', 'left', r)} fill="#334155" />}
          {symbol.key === 'deceased' && (
            <>
              <line x1={-r} y1={-r} x2={r} y2={r} stroke="#334155" strokeWidth="1.8" />
              <line x1={r} y1={-r} x2={-r} y2={r} stroke="#334155" strokeWidth="1.8" />
            </>
          )}
        </>
      )}
    </svg>
  );
};
