/* ===========================================================================
 * 案件庫（Case Store）
 *
 * 一位社工手上不會只有一個案子，所以本機要能同時放多份案件文件。
 *
 * 儲存配置刻意拆成「索引」與「各案內容」兩層：
 *   genogram-cases      → { v, activeId, list: [{ id, name, updatedAt }] }
 *   genogram-case-<id>  → 該案件的文件 JSON
 *
 * 這樣存檔時只需要覆寫「目前這一份」，不必把所有案件重寫一遍。
 *
 * 重要：開啟網頁不會自動建立或開啟任何案件。案件庫只有在使用者主動按下
 * 「儲存案件」（或匯入 .json）時才會多一份，見 openLibrary()。
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
 * 開啟案件庫
 *
 * 只讀不寫，而且**不會開啟任何案件**：activeId 一律是 null，畫布從空白開始。
 * 使用者按下「儲存案件」以前，這一次的編輯完全不落地（無痕畫布）。
 * 已存的案件仍在清單裡，可以從案件選單開回來。
 *
 * 唯一的例外是很早期版本留下的單一存檔：那是使用者的資料，不能因為改了
 * 儲存機制就讓他找不到。所以會一次性把它登記進案件庫（只登記，不開啟），
 * 之後就從清單裡看得到。
 * =========================================================================== */

export const openLibrary = () => {
  const existing = normalizeIndex(readJSON(INDEX_KEY));
  if (existing) return { index: { ...existing, activeId: null } };

  const legacy = migrateDoc(readJSON(LEGACY_DOC_KEY));
  if (!legacy) return { index: emptyIndex() };

  const id = newCaseId();
  const index = {
    v: INDEX_VERSION,
    activeId: null,
    list: [{ id, name: `${nextCaseName([])}（舊版存檔）`, updatedAt: Date.now() }],
  };
  writeCaseDoc(id, legacy);
  writeIndex(index);
  return { index, migratedFromLegacy: true };
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
 * 刪除案件。刪掉的若是目前開著的那一份，就回到未儲存的空白畫布
 * （activeId = null）—— 不自動跳到別人的案件，避免以為還在看剛才那一份。
 */
export const removeCase = (index, id) => {
  const list = index.list.filter(c => c.id !== id);
  removeCaseDoc(id);
  if (!list.length) return { index: emptyIndex(), closedActive: true };

  const closedActive = index.activeId === id;
  return {
    index: { ...index, activeId: closedActive ? null : index.activeId, list },
    closedActive,
  };
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
