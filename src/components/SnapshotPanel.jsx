import { useState } from 'react';

const fmtTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * 時間軸快照：手動存一份「這個時間點的家系圖」，之後可以隨時跳回去看、
 * 或還原成目前的編輯內容。跟復原/重做不同——快照不會因為重新整理就消失，
 * 但也不會自動記錄每一步，只在使用者按下「建立快照」時存一份。
 *
 * 還原走跟一般編輯一樣的歷史紀錄，所以還原錯了可以再用 Ctrl+Z 復原。
 */
const SnapshotPanel = ({ snapshots, takeSnapshot, restoreSnapshot, removeSnapshot }) => {
  const [draft, setDraft] = useState('');

  const handleTake = () => {
    takeSnapshot(draft);
    setDraft('');
  };

  const handleRestore = (snap) => {
    if (!window.confirm(`確定要還原到「${snap.name}」這個時間點嗎？(還原後可用「復原」還原這次動作)`)) return;
    restoreSnapshot(snap.id);
  };

  const handleDelete = (snap) => {
    if (!window.confirm(`確定要刪除快照「${snap.name}」嗎？此動作無法復原。`)) return;
    removeSnapshot(snap.id);
  };

  return (
    <div className="section">
      <label>🕰️ 時間軸快照</label>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleTake(); }}
          placeholder="快照名稱（留空自動用時間命名）"
          style={{ flex: 1 }}
        />
        <button
          onClick={handleTake}
          style={{ padding: '5px 10px', fontSize: '12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}
        >📸 建立</button>
      </div>
      <div className="hint">存一份現在的家系圖，之後可以跳回來看或還原。不會取代自動儲存與復原/重做。</div>

      {snapshots.length > 0 && (
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
      )}
    </div>
  );
};

export default SnapshotPanel;
