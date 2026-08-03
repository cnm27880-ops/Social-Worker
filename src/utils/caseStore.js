/* ===========================================================================
 * 案件庫（Case Store）
 *
 * 一位社工手上不會只有一個案子，所以本機要能同時放多份案件文件。
 *
 * 儲存配置刻意拆成「索引」與「各案內容」兩層：
 *   genogram-cases      → { v, activeId, list: [{ id, name, updatedAt }] }
 *   genogram-case-<id>  → 該案件的文件 JSON
 *
 * 這樣自動存檔時只需要覆寫「目前這一份」，不必把所有案件重寫一遍。
 * =========================================================================== */

import { INITIAL_DOC, migrateDoc, STORAGE_KEY as LEGACY_DOC_KEY } from './caseDoc';

export const INDEX_KEY = 'genogram-cases';
export const CASE_PREFIX = 'genogram-case-';
const INDEX_VERSION = 1;

const caseKey = (id) => `${CASE_PREFIX}${id}`;

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

export const newCaseId = () =>
  `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ===========================================================================
 * 預設化名
 * 依序給 A、B、…、Z、AA、AB…，避開已存在的名稱。
 * =========================================================================== */

const letterAt = (n) => {
  let s = '';
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
};

export const nextCaseName = (list) => {
  const used = new Set(list.map(c => c.name));
  for (let i = 0; ; i++) {
    const name = `案主 ${letterAt(i)}`;
    if (!used.has(name)) return name;
  }
};

/* ===========================================================================
 * 索引
 * =========================================================================== */

const emptyIndex = () => ({ v: INDEX_VERSION, activeId: null, list: [] });

const normalizeIndex = (raw) => {
  if (!raw || !Array.isArray(raw.list)) return null;
  const list = raw.list
    .filter(c => c && typeof c.id === 'string')
    .map(c => ({
      id: c.id,
      name: typeof c.name === 'string' && c.name.trim() ? c.name : '未命名案件',
      updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : 0,
    }));
  if (!list.length) return null;
  const activeId = list.some(c => c.id === raw.activeId) ? raw.activeId : list[0].id;
  return { v: INDEX_VERSION, activeId, list };
};

export const readIndex = () => normalizeIndex(readJSON(INDEX_KEY)) || emptyIndex();
export const writeIndex = (index) => writeJSON(INDEX_KEY, index);

/* ===========================================================================
 * 讀寫單一案件
 * =========================================================================== */

export const readCaseDoc = (id) => {
  const doc = migrateDoc(readJSON(caseKey(id)));
  return doc || { ...INITIAL_DOC };
};

export const writeCaseDoc = (id, doc) => writeJSON(caseKey(id), doc);

const removeCaseDoc = (id) => {
  try { localStorage.removeItem(caseKey(id)); } catch { /* 忽略 */ }
};

/* ===========================================================================
 * 初始化
 *
 * 三種情況：
 *   1. 已有案件庫        → 直接用
 *   2. 只有舊的單一存檔  → 轉成第一個案件
 *   3. 全新使用者        → 開一個空案件
 * =========================================================================== */

export const initLibrary = () => {
  const existing = normalizeIndex(readJSON(INDEX_KEY));
  if (existing) {
    return { index: existing, doc: readCaseDoc(existing.activeId) };
  }

  const legacy = migrateDoc(readJSON(LEGACY_DOC_KEY));
  const id = newCaseId();
  const doc = legacy || { ...INITIAL_DOC };
  const index = {
    v: INDEX_VERSION,
    activeId: id,
    list: [{ id, name: nextCaseName([]), updatedAt: Date.now() }],
  };

  writeCaseDoc(id, doc);
  writeIndex(index);
  return { index, doc, migratedFromLegacy: !!legacy };
};

/* ===========================================================================
 * 索引異動
 * =========================================================================== */

export const touchCase = (index, id, at = Date.now()) => ({
  ...index,
  list: index.list.map(c => (c.id === id ? { ...c, updatedAt: at } : c)),
});

export const addCase = (index, name) => {
  const id = newCaseId();
  const entry = { id, name: name || nextCaseName(index.list), updatedAt: Date.now() };
  return { index: { ...index, activeId: id, list: [...index.list, entry] }, id };
};

export const renameCaseIn = (index, id, name) => ({
  ...index,
  list: index.list.map(c => (c.id === id ? { ...c, name: name.trim() || c.name } : c)),
});

/**
 * 刪除案件。若刪掉的是目前開啟的案件，會自動切到清單中的下一份；
 * 刪到一份都不剩時回傳 needsNewCase，由呼叫端建立空案件。
 */
export const removeCase = (index, id) => {
  const list = index.list.filter(c => c.id !== id);
  removeCaseDoc(id);
  if (!list.length) return { index: emptyIndex(), needsNewCase: true };

  const activeId = index.activeId === id ? list[0].id : index.activeId;
  return { index: { ...index, activeId, list }, needsNewCase: false };
};

/* ===========================================================================
 * 檔案匯出 / 匯入
 * =========================================================================== */

export const FILE_KIND = 'geno-link-case';
export const FILE_VERSION = 1;

export const buildExport = (name, doc) => ({
  kind: FILE_KIND,
  v: FILE_VERSION,
  name,
  exportedAt: new Date().toISOString(),
  doc,
});

/** 檔名去掉不能用在檔案系統的字元。 */
const safeFileName = (name) => name.replace(/[\\/:*?"<>|]/g, '_').trim() || '案件';

export const downloadCaseFile = (name, doc) => {
  const payload = buildExport(name, doc);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${safeFileName(name)}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  // 立刻 revoke 會讓下載在檔名還沒定下來前就失去來源（存成 "download"），
  // 所以延後清理。
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
};

/**
 * 解析匯入的檔案內容。
 * 回傳 { name, doc } 或在格式不對時丟出帶中文訊息的錯誤。
 */
export const parseCaseFile = (text) => {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('這不是有效的 JSON 檔案。');
  }

  // 也接受直接丟一份文件進來（例如手動從 localStorage 複製出來的）
  const source = raw && raw.kind === FILE_KIND ? raw.doc : raw;
  const doc = migrateDoc(source);
  if (!doc) throw new Error('檔案內容不是家系圖案件。');

  const name = typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim() : null;
  return { name, doc };
};
