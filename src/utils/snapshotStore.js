/* ===========================================================================
 * 時間軸快照（Timeline Snapshots）
 *
 * 跟案件庫刻意分開存放：快照是「同一份案件在某個時間點的存檔」，不是
 * undo/redo 歷史（那是暫態、重新整理就沒了），也不是另一份案件（不會
 * 出現在案件切換選單裡）。存在 genogram-snapshots-<caseId>，跟著案件走：
 * 案件被刪除時，屬於它的快照也一併清掉，不留孤兒資料。
 *
 * 快照數量上限 MAX_SNAPSHOTS：這是社工自己按下「建立快照」才會累積的
 * 資料，不會無限自動增生，設上限只是避免忘記清理而占用瀏覽器儲存空間。
 * =========================================================================== */

import { migrateDoc } from './caseDoc';

const PREFIX = 'genogram-snapshots-';
const MAX_SNAPSHOTS = 30;

const snapshotKey = (caseId) => `${PREFIX}${caseId}`;

const readJSON = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const newSnapshotId = () =>
  `sn${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** 某案件目前存的所有快照，新到舊排序。格式不對的舊資料直接視為空清單。 */
export const listSnapshots = (caseId) => {
  const raw = readJSON(snapshotKey(caseId));
  if (!Array.isArray(raw)) return [];
  return raw.filter(s => s && typeof s.id === 'string' && s.doc);
};

/** 建一份新快照（存當下這份文件的完整副本），回傳新增的快照物件。 */
export const saveSnapshot = (caseId, name, doc) => {
  const list = listSnapshots(caseId);
  const snap = {
    id: newSnapshotId(),
    name: (name || '').trim() || new Date().toLocaleString('zh-TW', { hour12: false }),
    at: Date.now(),
    doc,
  };
  const next = [snap, ...list].slice(0, MAX_SNAPSHOTS);
  writeJSON(snapshotKey(caseId), next);
  return snap;
};

export const deleteSnapshot = (caseId, snapshotId) => {
  const next = listSnapshots(caseId).filter(s => s.id !== snapshotId);
  writeJSON(snapshotKey(caseId), next);
  return next;
};

/** 讀出某個快照的文件內容，套用跟案件庫一樣的 migrateDoc 防呆。 */
export const readSnapshotDoc = (caseId, snapshotId) => {
  const found = listSnapshots(caseId).find(s => s.id === snapshotId);
  return found ? migrateDoc(found.doc) : null;
};

/** 案件被刪除時一併呼叫，清掉屬於它的快照。 */
export const clearSnapshots = (caseId) => {
  try { localStorage.removeItem(snapshotKey(caseId)); } catch { /* 忽略 */ }
};
