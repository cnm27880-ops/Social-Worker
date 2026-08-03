import { useState } from 'react';
import { CATEGORIES, SYMBOLS, halfPath } from '../utils/symbols';

const RECENT_KEY = 'genogram-recent-symbols';
const RECENT_MAX = 4;

export const loadRecent = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(raw) ? raw.filter(k => SYMBOLS.some(s => s.key === k)) : [];
  } catch { return []; }
};

export const pushRecent = (key) => {
  const next = [key, ...loadRecent().filter(k => k !== key)].slice(0, RECENT_MAX);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* 忽略 */ }
  return next;
};

/* 工具箱裡的小預覽圖：一律用方形（男性）示意，24×24 */
export const SymbolPreview = ({ symbol, size = 24 }) => {
  const r = size / 2 - 2;
  const hatchId = `tb-hatch-${symbol.key}`;
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} aria-hidden="true">
      <defs>
        <pattern id={hatchId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="#334155" strokeWidth="1.6" />
        </pattern>
      </defs>

      {symbol.kind === 'kinship' ? (
        <>
          <line x1="0" y1={-r - 1} x2="0" y2="0" stroke="#334155" strokeWidth="1.6"
                strokeDasharray={symbol.dash} />
          <rect x={-r + 2} y="0" width={(r - 2) * 2} height={r - 2} fill="#fff" stroke="#334155" strokeWidth="1.6" />
        </>
      ) : (
        <>
          <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="#fff" stroke="#334155" strokeWidth="1.8" />
          {symbol.half && <path d={halfPath('M', symbol.half, r)} fill={`url(#${hatchId})`} />}
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
 */
const SymbolToolbox = ({ onPickUp, recent, activeKey }) => {
  const [openCat, setOpenCat] = useState('common');

  const recentSymbols = recent
    .map(k => SYMBOLS.find(s => s.key === k))
    .filter(Boolean);

  const Chip = ({ s }) => (
    <button
      className={`sym-chip ${activeKey === s.key ? 'dragging' : ''}`}
      title={`${s.label}：${s.desc}`}
      onPointerDown={e => onPickUp(e, s.key)}
    >
      <SymbolPreview symbol={s} />
      <span className="sym-chip-label">{s.label}</span>
    </button>
  );

  return (
    <div className="section sym-toolbox">
      <label>積木工具箱</label>
      <p className="sym-hint">拖曳符號到人物上放開即可標記；再拖一次可取消。</p>

      {recentSymbols.length > 0 && (
        <div className="sym-recent">
          <span className="sym-recent-title">最近使用</span>
          <div className="sym-grid">
            {recentSymbols.map(s => <Chip key={s.key} s={s} />)}
          </div>
        </div>
      )}

      {CATEGORIES.map(cat => {
        const items = SYMBOLS.filter(s => s.category === cat.key);
        if (!items.length) return null;
        const open = openCat === cat.key;
        return (
          <div className="sym-cat" key={cat.key}>
            <button
              className={`sym-cat-head ${open ? 'open' : ''}`}
              onClick={() => setOpenCat(open ? null : cat.key)}
              aria-expanded={open}
            >
              <span>{cat.label}</span>
              <span className="sym-cat-count">{items.length}</span>
              <span className="sym-cat-caret">▾</span>
            </button>
            {open && (
              <div className="sym-grid">
                {items.map(s => <Chip key={s.key} s={s} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SymbolToolbox;
