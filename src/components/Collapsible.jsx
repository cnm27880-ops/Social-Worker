import { useState } from 'react';
import InfoTip from './InfoTip';

/**
 * 手風琴卡片。
 *
 * 讓非核心的區塊（積木工具箱、自由擴充區）預設收起來，使用者一眼看到的
 * 就只有第一代／第二代這條主線；需要時再展開。
 *
 * 收合狀態刻意只放在元件內部的 useState，不寫進案件文件 ——
 * 它是使用者「現在想看哪一塊」的暫態，不是案件內容，
 * 進了文件會混進復原歷史，按 Ctrl+Z 變成在展開收合之間跳。
 */
const Collapsible = ({ title, tip, badge, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`section section-fold ${open ? 'open' : ''}`}>
      <div className="section-fold-head">
        <button
          type="button"
          className="section-fold-btn"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
        >
          <span className="section-fold-caret" aria-hidden="true">▾</span>
          <span className="section-fold-title">{title}</span>
          {badge != null && <span className="section-fold-badge">{badge}</span>}
        </button>
        {tip && <InfoTip text={tip} />}
      </div>
      {open && <div className="section-fold-body">{children}</div>}
    </div>
  );
};

export default Collapsible;
