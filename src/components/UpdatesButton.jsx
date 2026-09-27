import { useEffect, useRef, useState } from 'react';
import { recentUpdates, formatUpdateDate } from '../utils/changelog';

/* ===========================================================================
 * 右上角「更新」按鈕 + 小卡片
 *
 * 刻意做成「想看才點」：沒有紅點、不會自己跳出來、不記錄看過沒有。
 * 卡片掛在按鈕正下方，不蓋住整個畫面；按 ✕、點卡片外面或按 Esc 都會關。
 * 內容在 utils/changelog.js，上線新功能時去那裡加一筆。
 * =========================================================================== */
const UpdatesButton = () => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // 點到卡片與按鈕以外的地方就關掉（pointerdown：滑鼠與觸控都吃得到）
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="updates-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`icon-btn ${open ? 'is-on' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="最近更新"
        aria-label="最近更新"
        aria-expanded={open}
        aria-controls="updates-card"
      >
        {/* 小喇叭：跟旁邊回報按鈕同樣的線條圖示風格 */}
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor"
             strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3.5 8v4h3l5 3.5v-11L6.5 8z" />
          <path d="M14.5 7.5a3.5 3.5 0 0 1 0 5" />
        </svg>
      </button>

      {open && (
        <div id="updates-card" className="updates-card" role="dialog" aria-label="最近更新">
          <div className="updates-head">
            <span>最近更新</span>
            <button type="button" className="updates-close" onClick={() => setOpen(false)} aria-label="關閉">✕</button>
          </div>
          <div className="updates-body">
            {recentUpdates().map(u => (
              <section key={u.date} className="updates-entry">
                <time dateTime={u.date}>{formatUpdateDate(u.date)}</time>
                <ul>{u.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdatesButton;
