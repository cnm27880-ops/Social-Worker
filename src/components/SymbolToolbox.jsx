import InfoTip from './InfoTip';
import {
  TOOLBOX_CATEGORIES, TOOLBOX_SYMBOLS, halfPath, divisionSegments,
  CLINICAL_FILL, CLINICAL_STROKE,
  trianglePath, triangleCrossLines, zigzagPoints, gapSegments, DISTANT_DASH,
} from '../utils/symbols';

const USAGE_KEY = 'genogram-symbol-usage';
const LEGACY_RECENT_KEY = 'genogram-recent-symbols';

const inToolbox = (key) => TOOLBOX_SYMBOLS.some(s => s.key === key);

/**
 * 每個符號用過幾次：{ [key]: count }。
 *
 * 原本是「最近使用」清單，在分類上方再列四個 chip —— 但那等於同一個符號
 * 在工具箱裡出現兩次。改成只記次數，用來決定各分類內部的排列順序：
 * 常用的自然浮到前面，不必多一區重複顯示。
 */
export const loadUsage = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY));
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return Object.fromEntries(
        Object.entries(raw).filter(([k, v]) => inToolbox(k) && Number.isFinite(v))
      );
    }
    // 舊版的「最近使用」是陣列，愈前面代表愈近期；換算成次數，別讓習慣歸零
    const legacy = JSON.parse(localStorage.getItem(LEGACY_RECENT_KEY));
    if (Array.isArray(legacy)) {
      const seed = {};
      legacy.filter(inToolbox).forEach((k, i) => { seed[k] = legacy.length - i; });
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

/* 工具箱裡的小預覽圖：一律用方形（男性）示意，24×24 */
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

/**
 * 積木工具箱。
 *
 * 只負責「拿起」：按住某個符號後把它交給畫布，實際要不要貼上、貼到誰身上
 * 由畫布在放開的那一刻決定（見 GenogramTab 的 symbolDrag）。
 * 拖曳過程中經過的節點不會被觸發，只有放開的位置算數。
 *
 * 所有分類一律展開，不再收合：符號本來就只有 12 個，全部攤開一眼就看得到
 * 哪裡有什麼，比每次點兩下（先展開分類、再拖符號）快。快捷工具列已經提供的
 * 「死亡／身心障礙」不收在這裡（見 TOOLBOX_SYMBOLS）。
 *
 * 面板上只留符號本身，名稱與用法改成滑過才浮出來 —— 12 個名稱常駐等於
 * 12 行文字，而使用者認得符號之後就不需要再讀名稱了。
 *
 * 分類內部依使用次數排序：常用的自己浮上來，不另設「最近使用」區重複顯示。
 * sort 是穩定的，沒用過的維持符號表原順序，不會每次開啟都跳來跳去。
 */
const SymbolToolbox = ({ onPickUp, usage, activeKey }) => {
  const byUsage = (items) =>
    [...items].sort((a, b) => (usage[b.key] || 0) - (usage[a.key] || 0));

  /* 提示氣泡掛在分類容器上（left/right 都是 0），不是掛在 chip 上：
   * 面板只有 350px 寬又會裁切溢出內容，掛在 chip 上時最左／最右那顆的
   * 氣泡一定會被切掉。 */
  const Chip = ({ s }) => (
    <button
      className={`sym-chip ${activeKey === s.key ? 'dragging' : ''}`}
      aria-label={`${s.label}：${s.desc}`}
      onPointerDown={e => onPickUp(e, s.key)}
    >
      <SymbolPreview symbol={s} />
      <span className="sym-tip" aria-hidden="true">
        <b>{s.label}</b>{s.desc}
      </span>
    </button>
  );

  return (
    <div className="sym-toolbox">
      <div className="section-title-row">
        <label>🧱 積木工具箱</label>
        <InfoTip text="進階臨床標記。滑過符號可看名稱與用法。拖曳符號到人物上放開即可標記；拖到婚姻線上是關係品質，拖到空白處新增獨立個體。再拖一次可取消。案主／身障／死亡請用上方快捷工具列。" />
        <span className="sym-total">{TOOLBOX_SYMBOLS.length}</span>
      </div>

      {TOOLBOX_CATEGORIES.map(cat => {
        const items = byUsage(TOOLBOX_SYMBOLS.filter(s => s.category === cat.key));
        if (!items.length) return null;
        return (
          <div className="sym-cat" key={cat.key}>
            <div className="sym-cat-head">
              <span className="sym-cat-name">{cat.label}</span>
              <span className="sym-cat-count">{items.length}</span>
            </div>
            <div className="sym-grid">
              {items.map(s => <Chip key={s.key} s={s} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SymbolToolbox;
