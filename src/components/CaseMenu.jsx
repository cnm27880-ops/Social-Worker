import { useMemo, useState } from 'react';
import {
  CASE_SORTS, CASE_SORT_LABELS, filterSortCases, storageUsage,
} from '../utils/caseStore';

/* ===========================================================================
 * 案件清單（案件列 ▾ 打開的那一塊）
 *
 * 一份案件除了名稱，還可以記案號與一行備註，清單上方可以搜尋、排序。
 * 底部是整個案件庫的維護：另存成新案件、一次備份全部、上次備份時間、
 * 本機空間用量。
 *
 * 為什麼特別強調備份：案件只存在這台電腦的這個瀏覽器裡，換電腦、清除
 * 瀏覽器資料、瀏覽器自己清掉很久沒用的網站資料，案件就一起不見了。
 * =========================================================================== */

const DAY = 24 * 60 * 60 * 1000;
/** 超過這麼久沒有完整備份，清單底部與 ▾ 會提醒。 */
export const BACKUP_REMIND_DAYS = 7;

export const needsBackup = (cases, lastBackupAt, now = Date.now()) =>
  cases.length > 0 && (!lastBackupAt || now - lastBackupAt > BACKUP_REMIND_DAYS * DAY);

const fmtTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
};

const backupText = (lastBackupAt) => {
  if (!lastBackupAt) return '還沒有完整備份過';
  const days = Math.floor((Date.now() - lastBackupAt) / DAY);
  if (days <= 0) return '今天已備份';
  return `上次備份：${days} 天前`;
};

const MetaEditor = ({ c, onSave, onCancel }) => {
  const [name, setName] = useState(c.name);
  const [caseNo, setCaseNo] = useState(c.caseNo || '');
  const [note, setNote] = useState(c.note || '');
  const submit = () => onSave({ name, caseNo, note });
  const onKey = (e) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') onCancel();
  };
  return (
    <div className="case-meta-edit">
      <input value={name} onChange={e => setName(e.target.value)} onKeyDown={onKey} placeholder="案件名稱" autoFocus aria-label="案件名稱" />
      <input value={caseNo} onChange={e => setCaseNo(e.target.value)} onKeyDown={onKey} placeholder="案號（選填）" aria-label="案號" />
      <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={onKey} placeholder="備註（選填，例如：高風險、每月訪視）" aria-label="備註" />
      <div className="case-meta-actions">
        <button className="btn-soft tone-dust btn-soft-xs" onClick={submit}>儲存</button>
        <button className="btn-soft btn-soft-xs" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
};

const CaseMenu = ({
  cases, activeCaseId, isSaved, lastBackupAt,
  onPick, onDelete, updateCaseMeta, onDuplicate, onBackupAll,
}) => {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');
  const [editingId, setEditingId] = useState(null);

  const shown = useMemo(() => filterSortCases(cases, query, sort), [cases, query, sort]);
  // 每次打開選單量一次就好：這個數字只在存檔時變，不需要即時
  const usage = useMemo(() => storageUsage(), [cases]);
  const remind = needsBackup(cases, lastBackupAt);
  const pct = Math.round(usage.ratio * 100);

  return (
    <div className="case-menu">
      {cases.length > 3 && (
        <div className="case-menu-head">
          <input
            type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="搜尋名稱、案號、備註" aria-label="搜尋案件"
          />
          <select value={sort} onChange={e => setSort(e.target.value)} aria-label="排序">
            {CASE_SORTS.map(k => <option key={k} value={k}>{CASE_SORT_LABELS[k]}</option>)}
          </select>
        </div>
      )}

      <ul className="case-menu-list">
        {shown.map(c => (
          <li key={c.id} className={c.id === activeCaseId ? 'active' : ''}>
            {editingId === c.id ? (
              <MetaEditor
                c={c}
                onSave={(meta) => { updateCaseMeta(c.id, meta); setEditingId(null); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <button className="case-menu-pick" onClick={() => onPick(c.id)} title={c.note || undefined}>
                  <span className="case-menu-text">
                    <span className="case-menu-name">
                      {c.name}
                      {c.caseNo && <span className="case-menu-no">{c.caseNo}</span>}
                    </span>
                    {c.note && <span className="case-menu-note">{c.note}</span>}
                  </span>
                  <span className="case-menu-time">{fmtTime(c.updatedAt)}</span>
                </button>
                <button className="case-menu-del" onClick={() => setEditingId(c.id)}
                        title={`編輯「${c.name}」的名稱、案號與備註`} aria-label={`編輯「${c.name}」`}>✎</button>
                <button className="case-menu-del" onClick={() => onDelete(c)}
                        title={`刪除「${c.name}」`} aria-label={`刪除「${c.name}」`}>×</button>
              </>
            )}
          </li>
        ))}
        {shown.length === 0 && <li className="case-menu-empty">找不到符合的案件</li>}
      </ul>

      <div className="case-menu-foot">
        {isSaved && (
          <button onClick={onDuplicate} title="把目前的畫面複製成一份新案件並切過去，原本那份不受影響">
            另存成新案件
          </button>
        )}
        <button onClick={onBackupAll} title="所有案件打包成一個 .json 檔；用案件列的「匯入」按鈕就能整包還原">
          備份全部案件（{cases.length} 份）
        </button>
        <div className={`case-menu-status ${remind ? 'warn' : ''}`}>
          {backupText(lastBackupAt)}
          {remind && '，建議現在備份一次'}
        </div>
        <div className={`case-storage ${pct >= 80 ? 'warn' : ''}`}
             title="案件存在這個瀏覽器的本機空間，上限約 5MB（各瀏覽器不同，這裡是估計值）。有匯入舊圖的案件特別佔空間。">
          <span className="case-storage-bar"><span style={{ width: `${Math.max(2, pct)}%` }} /></span>
          本機空間約用了 {usage.used > 0 && pct === 0 ? '不到 1' : pct}%
        </div>
      </div>
    </div>
  );
};

export default CaseMenu;
