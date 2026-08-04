import { useEffect, useRef, useState } from 'react';
import SnapshotMenu from './SnapshotMenu';
import { nextCaseName } from '../utils/caseStore';

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
 * 案件列：儲存／切換／改名／刪除／匯出／匯入／時間軸快照。
 *
 * 這一列有兩種狀態，差別是「這次的編輯有沒有落地」：
 *
 *   未儲存草稿（isSaved = false）
 *     開啟網頁的預設狀態。畫布是乾淨的，什麼都不寫進本機，也沒有時間軸。
 *     只有「儲存案件」一個入口 —— 按下去要先取個名字。
 *
 *   已儲存案件（isSaved = true）
 *     名稱可點擊改名，後續變更自動存回這一份，時間軸開始記錄，
 *     「儲存」變成「立刻存檔並在時間軸留一個節點」。
 *
 * 刻意沒有「新增空白案件」按鈕：要開新的一份，重新整理或另開分頁就是
 * 一張乾淨畫布，不需要在案件庫先佔一個位子。
 */
const CaseBar = ({
  cases, activeCaseId, activeCase, isSaved,
  switchCase, saveCase, renameCase, deleteCase, exportCase, importCase,
  snapshots, takeSnapshot, restoreSnapshot, removeSnapshot,
}) => {
  /* 第一次儲存時預填的化名（案主 A、案主 B…，跳過已用過的） */
  const suggestedName = nextCaseName(cases);
  const [open, setOpen] = useState(false);          // 案件切換選單
  const [snapOpen, setSnapOpen] = useState(false);  // 時間軸快照
  const [editing, setEditing] = useState(null);     // null | 'rename' | 'save'
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
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

  /* 存檔成功的提示，兩秒後自己消失 */
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 2000);
    return () => clearTimeout(t);
  }, [flash]);

  const closeMenus = () => { setOpen(false); setSnapOpen(false); };

  const startRename = () => {
    if (!isSaved) return;
    setDraft(activeCase?.name || '');
    setEditing('rename');
    closeMenus();
  };

  /** 第一次儲存要先命名；已經儲存過的直接存。 */
  const onSaveClick = () => {
    setError('');
    closeMenus();
    if (!isSaved) {
      setDraft(suggestedName || '');
      setEditing('save');
      return;
    }
    try {
      saveCase();
      setFlash('已存檔');
    } catch (err) {
      setError(err.message || '儲存失敗。');
    }
  };

  const commitEdit = () => {
    const name = draft.trim();
    const mode = editing;
    setEditing(null);
    if (mode === 'rename') {
      if (activeCase && name) renameCase(activeCase.id, name);
      return;
    }
    if (mode === 'save') {
      try {
        saveCase(name || suggestedName);
        setFlash('已建立案件');
      } catch (err) {
        setError(err.message || '儲存失敗。');
      }
    }
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
    const msg = c.id === activeCaseId
      ? `確定刪除「${c.name}」？刪除後會回到空白畫布，此動作無法復原。`
      : `確定刪除「${c.name}」？此動作無法復原。`;
    if (window.confirm(msg)) deleteCase(c.id);
  };

  return (
    <div className="case-bar" ref={wrapRef}>
      <div className="case-bar-main">
        <span className="case-bar-icon" aria-hidden="true">{isSaved ? '🗂️' : '📄'}</span>

        {editing ? (
          <input
            className="case-name-input"
            value={draft}
            autoFocus
            placeholder={editing === 'save' ? '案件名稱' : undefined}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditing(null);
            }}
          />
        ) : isSaved ? (
          <button className="case-name" onClick={startRename} title="點擊可改名">
            {activeCase?.name || '未命名案件'}
          </button>
        ) : (
          <span className="case-draft" title="這次的編輯還沒存進本機；按「儲存案件」才會建立案件與時間軸">
            未儲存草稿
          </span>
        )}

        {cases.length > 0 && (
          <button
            className={`case-caret ${open ? 'open' : ''}`}
            onClick={() => { setOpen(o => !o); setSnapOpen(false); }}
            title="開啟已儲存的案件"
            aria-label="開啟已儲存的案件"
            aria-expanded={open}
          >▾</button>
        )}

        {flash && <span className="case-flash">{flash}</span>}
        <span className="case-bar-spacer" />

        <button
          className={`case-save ${isSaved ? '' : 'primary'}`}
          onClick={onSaveClick}
          title={isSaved ? '存檔並在時間軸留一個節點' : '建立案件：開始記錄時間軸與後續變更'}
        >💾{isSaved ? '' : ' 儲存案件'}</button>

        <SnapshotMenu
          snapshots={snapshots} takeSnapshot={takeSnapshot}
          restoreSnapshot={restoreSnapshot} removeSnapshot={removeSnapshot}
          isSaved={isSaved}
          open={snapOpen}
          onToggle={() => { setSnapOpen(o => !o); setOpen(false); }}
          onClose={() => setSnapOpen(false)}
        />
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
        </ul>
      )}
    </div>
  );
};

export default CaseBar;
