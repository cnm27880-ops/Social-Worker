import { useEffect, useRef, useState } from 'react';
import SnapshotMenu from './SnapshotMenu';

const fmtTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
};

/**
 * 案件列：切換／新增／改名／刪除／匯出／匯入／時間軸快照。
 *
 * 案件名稱預設是化名（案主 A、案主 B…），點一下就能改。
 * 快照收在這一列的 🕰️ 底下 —— 快照本來就是跟著案件走的資料。
 */
const CaseBar = ({
  cases, activeCaseId, activeCase,
  switchCase, createCase, renameCase, deleteCase, exportCase, importCase,
  snapshots, takeSnapshot, restoreSnapshot, removeSnapshot,
}) => {
  const [open, setOpen] = useState(false);          // 案件切換選單
  const [snapOpen, setSnapOpen] = useState(false);  // 時間軸快照
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const wrapRef = useRef(null);
  const fileRef = useRef(null);

  /* 點外面就把這一列開著的東西都收起來。兩個彈窗都放在案件列底下，
   * 位置會重疊，所以由這裡統一管，開一個就關掉另一個。 */
  useEffect(() => {
    if (!open && !snapOpen) return;
    const onDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
      setSnapOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, snapOpen]);

  const startEdit = () => {
    setDraft(activeCase?.name || '');
    setEditing(true);
    setOpen(false);
    setSnapOpen(false);
  };

  const commitEdit = () => {
    if (activeCase && draft.trim()) renameCase(activeCase.id, draft);
    setEditing(false);
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';           // 選同一個檔案也要能再次觸發
    if (!file) return;
    setError('');
    try {
      await importCase(file);
    } catch (err) {
      setError(err.message || '匯入失敗。');
    }
  };

  const confirmDelete = (c) => {
    const only = cases.length === 1;
    const msg = only
      ? `確定刪除「${c.name}」？這是最後一份案件，刪除後會開一份空白案件。`
      : `確定刪除「${c.name}」？此動作無法復原。`;
    if (window.confirm(msg)) deleteCase(c.id);
  };

  return (
    <div className="case-bar" ref={wrapRef}>
      <div className="case-bar-main">
        <span className="case-bar-icon" aria-hidden="true">🗂️</span>

        {editing ? (
          <input
            className="case-name-input"
            value={draft}
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <button className="case-name" onClick={startEdit} title="點擊可改名">
            {activeCase?.name || '未命名案件'}
          </button>
        )}

        <button
          className={`case-caret ${open ? 'open' : ''}`}
          onClick={() => { setOpen(o => !o); setSnapOpen(false); }}
          title="切換案件"
          aria-label="切換案件"
          aria-expanded={open}
        >▾</button>

        <span className="case-bar-spacer" />

        <SnapshotMenu
          snapshots={snapshots} takeSnapshot={takeSnapshot}
          restoreSnapshot={restoreSnapshot} removeSnapshot={removeSnapshot}
          open={snapOpen}
          onToggle={() => { setSnapOpen(o => !o); setOpen(false); }}
          onClose={() => setSnapOpen(false)}
        />
        <button className="case-tool" onClick={createCase} title="新增案件">＋</button>
        <button className="case-tool" onClick={exportCase} title="匯出成 .json 檔">⤓</button>
        <button className="case-tool" onClick={() => fileRef.current?.click()} title="從 .json 檔匯入">⤒</button>
        <input
          ref={fileRef} type="file" accept="application/json,.json"
          onChange={onPickFile} style={{ display: 'none' }}
        />
      </div>

      {error && (
        <div className="case-error">
          {error}
          <button onClick={() => setError('')} aria-label="關閉">×</button>
        </div>
      )}

      {open && (
        <ul className="case-menu">
          {cases.map(c => (
            <li key={c.id} className={c.id === activeCaseId ? 'active' : ''}>
              <button className="case-menu-pick" onClick={() => { switchCase(c.id); setOpen(false); }}>
                <span className="case-menu-name">{c.name}</span>
                <span className="case-menu-time">{fmtTime(c.updatedAt)}</span>
              </button>
              <button
                className="case-menu-del"
                onClick={() => confirmDelete(c)}
                title={`刪除「${c.name}」`}
                aria-label={`刪除「${c.name}」`}
              >×</button>
            </li>
          ))}
          <li className="case-menu-foot">
            <button onClick={() => { createCase(); setOpen(false); }}>＋ 新增案件</button>
          </li>
        </ul>
      )}
    </div>
  );
};

export default CaseBar;
