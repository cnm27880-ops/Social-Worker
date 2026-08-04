import { useEffect, useState } from 'react';
import InfoTip from './InfoTip';

const fmtTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const TIP = '每次按「儲存案件」都會在這裡留一個節點；也可以自己命名再存一份。之後能隨時還原回那個時間點，重新整理也還在。';

/**
 * 時間軸快照，收在案件列的 🕰️ 按鈕底下。
 *
 * 原本是面板裡一張獨立卡片（輸入框＋說明＋清單），但快照本來就是
 * 「偶爾才用一次」的功能，常駐一張卡片把主線的第一代／第二代擠到更下面。
 * 快照又是跟著案件走的（切換案件會換一份清單），放在案件列語意也對。
 *
 * 快照與復原／重做不同：快照存在 localStorage，重新整理仍在；
 * 還原走一般的文件替換，所以還原錯了可以再用 Ctrl+Z 復原這次還原。
 *
 * 時間軸掛在案件底下，所以案件還沒儲存時整顆按鈕是停用的 —— 沒有案件可掛，
 * 存了也不知道要存到哪裡去。
 */
const SnapshotMenu = ({
  snapshots, takeSnapshot, restoreSnapshot, removeSnapshot, isSaved,
  open, onToggle, onClose,
}) => {
  const [draft, setDraft] = useState('');

  /* 按 Esc 收起來（點外面由 CaseBar 統一處理，它才知道另一個選單開著沒） */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleTake = () => {
    takeSnapshot(draft);
    setDraft('');
  };

  const handleRestore = (snap) => {
    if (!window.confirm(`確定要還原到「${snap.name}」這個時間點嗎？(還原後可用「復原」還原這次動作)`)) return;
    restoreSnapshot(snap.id);
    onClose();
  };

  const handleDelete = (snap) => {
    if (!window.confirm(`確定要刪除快照「${snap.name}」嗎？此動作無法復原。`)) return;
    removeSnapshot(snap.id);
  };

  return (
    <span className="snap-menu-wrap">
      <button
        className={`case-tool ${open ? 'active' : ''}`}
        onClick={onToggle}
        disabled={!isSaved}
        title={isSaved ? '時間軸快照' : '儲存案件後才會開始記錄時間軸'}
        aria-label="時間軸快照"
        aria-expanded={open}
      >
        🕰️
        {snapshots.length > 0 && <span className="snap-count">{snapshots.length}</span>}
      </button>

      {open && (
        <div className="snap-pop" role="dialog" aria-label="時間軸快照">
          <div className="snap-pop-head">
            <span className="snap-pop-title">🕰️ 時間軸快照</span>
            <InfoTip text={TIP} />
          </div>

          <div className="snap-pop-take">
            <input
              type="text"
              value={draft}
              autoFocus
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleTake(); }}
              placeholder="快照名稱（留空自動用時間命名）"
            />
            <button className="btn-soft tone-mauve" onClick={handleTake}>📸 建立</button>
          </div>

          {snapshots.length > 0 ? (
            <ul className="snap-list">
              {snapshots.map(snap => (
                <li key={snap.id}>
                  <span className="snap-name" title={snap.name}>{snap.name}</span>
                  <span className="snap-time">{fmtTime(snap.at)}</span>
                  <button className="snap-btn" onClick={() => handleRestore(snap)} title="還原到這個時間點">還原</button>
                  <button className="snap-btn snap-btn-del" onClick={() => handleDelete(snap)} title="刪除這份快照" aria-label="刪除快照">×</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="snap-empty">還沒有節點。按「儲存案件」或上面的「建立」都會留下一個。</p>
          )}
        </div>
      )}
    </span>
  );
};

export default SnapshotMenu;
