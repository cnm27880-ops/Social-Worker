/* ===========================================================================
 * 案件文件（Case Document）
 *
 * 這裡定義「一份家系圖案件」的完整資料形狀。凡是畫布上看得到、
 * 使用者會希望復原或下次打開還在的東西，都屬於這份文件；純粹的
 * UI 暫態（拖曳中的座標、目前選到哪個節點、正在編輯哪一格）則不屬於，
 * 留在元件內部的 useState 即可。
 *
 * 這個界線很重要：文件 = 可序列化 + 進 undo + 進自動存檔，三件事共用
 * 同一份資料，所以只需要維護一種格式。
 * =========================================================================== */

/** 文件格式版本。日後改變資料形狀時 +1，並在 migrateDoc 補上轉換。 */
export const DOC_VERSION = 1;

/** 舊版的單一存檔鍵。保留給 caseStore 做一次性轉換用。 */
export const STORAGE_KEY = 'genogram-doc';

export const INITIAL_DOC = {
  v: DOC_VERSION,

  /* --- 家庭結構 --- */
  gen2Str: '',
  gen2Cfg: [],
  indexId: null,
  g1Status: 'married',
  cohabMembers: [],

  /* --- 節點標記 ---
   * { [nodeId]: ['deceased', 'disabled', ...] }
   * 取代原本 deceasedIds / disabledIds 兩個平行陣列：之後積木工具箱要加
   * 收養、寄養、雙胞胎等冷門標記時，不需要再開新的 state，也不需要動
   * 存檔格式。 */
  nodeAttrs: {},

  /* --- 自由擴充區 --- */
  freeNodes: [],
  customLinks: [],

  /* --- 關係線標記 ---
   * { [lineId]: 'conflict' | 'distant' | 'cutoff' | 'violence' }
   * 單一值而非陣列：一條線一次只呈現一種關係品質，拖曳別的符號上去
   * 是直接取代，不是疊加。lineId 是 GenogramTab 算出來的穩定字串
   * （'ml-g1'、'ml-c0'…或 customLinks 自己的 id），同一份資料每次
   * 重新算 nodes/lines 都會得到同樣的 id，所以可以放進案件文件裡。 */
  lineAttrs: {},

  /* --- 畫布內容 --- */
  positions: {},
  polygons: [],
  texts: [],
  ages: {},

  /* --- 舊圖修補（Image Overlay） ---
   * 匯入一張既有的家系圖當底圖，在上面疊符號、關係線與文字方塊。
   * { src: dataURL, w, h, opacity, scale }
   * src 存 dataURL 而不是 File／blob URL：blob URL 重新整理就失效，
   * 而底圖必須跟著案件一起存進案件庫、一起匯出成 .json。
   * 上傳時會先縮圖再轉 dataURL（見 utils/bgImage.js），避免把
   * 一張幾 MB 的掃描圖塞爆 localStorage 配額。 */
  bgImage: null,

  /* --- 底圖橡皮擦筆跡 ---
   * [{ id, w, pts: [[x, y], ...] }]
   * 底圖是點陣圖，「擦掉」的做法是拿這些筆跡組成 SVG mask 把該處挖成透明，
   * 而不是在上面塗白色 —— 塗白在去背 PNG 匯出時會留下白色筆跡。 */
  bgErase: [],

  /* --- 影響輸出結果的繪圖選項 --- */
  cohabMode: 'auto',
  cohabSolid: false,
  ipStyle: 'filled',
  textDirection: 'horizontal',
  extColorMode: 'black',
  showAgeMode: false,
};

/** 文件裡所有欄位名稱（不含版本號）。 */
export const DOC_FIELDS = Object.keys(INITIAL_DOC).filter(k => k !== 'v');

/* ===========================================================================
 * 節點標記的讀寫
 * =========================================================================== */

/** 取出帶有某個標記的所有節點 id。 */
export const idsWithAttr = (nodeAttrs, attr) =>
  Object.keys(nodeAttrs).filter(id => nodeAttrs[id]?.includes(attr));

/** 以一份 id 清單覆寫某個標記的歸屬，並順手清掉空陣列避免文件膨脹。 */
export const setAttrIds = (nodeAttrs, attr, ids) => {
  const wanted = new Set(ids);
  const next = {};
  // 先保留其他標記，並移除不再擁有 attr 的節點
  for (const [id, attrs] of Object.entries(nodeAttrs)) {
    const kept = wanted.has(id)
      ? (attrs.includes(attr) ? attrs : [...attrs, attr])
      : attrs.filter(a => a !== attr);
    if (kept.length) next[id] = kept;
  }
  // 再補上原本完全沒有任何標記的新節點
  for (const id of wanted) {
    if (!next[id]) next[id] = [attr];
  }
  return next;
};

/** 切換單一節點的單一標記。積木工具箱拖曳貼附時會用到。 */
export const toggleAttr = (nodeAttrs, id, attr) => {
  const attrs = nodeAttrs[id] || [];
  const kept = attrs.includes(attr) ? attrs.filter(a => a !== attr) : [...attrs, attr];
  const next = { ...nodeAttrs };
  if (kept.length) next[id] = kept; else delete next[id];
  return next;
};

/**
 * 切換一條線的關係品質標記。跟 toggleAttr 不同的是這裡每條線只存單一值：
 * 拖同一個符號到同一條線上是取消，拖別的符號上去是直接取代。
 */
export const toggleLineAttr = (lineAttrs, lineId, key) => {
  const next = { ...lineAttrs };
  if (next[lineId] === key) delete next[lineId];
  else next[lineId] = key;
  return next;
};

/* ===========================================================================
 * 序列化 / 還原
 * =========================================================================== */

/**
 * 把任意來源（localStorage、匯入的 .json）的資料收斂成一份合法文件。
 * 缺少的欄位補預設值、不認得的欄位丟棄 —— 這樣舊版存檔不會讓畫面整個炸掉。
 */
export const migrateDoc = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const doc = { v: DOC_VERSION };
  for (const key of DOC_FIELDS) {
    const fallback = INITIAL_DOC[key];
    const value = raw[key];
    const sameShape =
      value !== undefined &&
      value !== null &&
      Array.isArray(value) === Array.isArray(fallback) &&
      typeof value === typeof fallback;
    doc[key] = sameShape ? value : fallback;
  }

  // v0：舊版用 deceasedIds / disabledIds 兩個陣列，轉成 nodeAttrs
  if (!raw.nodeAttrs && (raw.deceasedIds || raw.disabledIds)) {
    let attrs = {};
    attrs = setAttrIds(attrs, 'deceased', raw.deceasedIds || []);
    attrs = setAttrIds(attrs, 'disabled', raw.disabledIds || []);
    doc.nodeAttrs = attrs;
  }

  // 底圖與橡皮擦筆跡：形狀不對就當沒有。壞掉的一筆不該讓整張畫布打不開
  if (doc.bgImage && typeof doc.bgImage.src !== 'string') doc.bgImage = null;
  doc.bgErase = doc.bgErase.filter(st => st && Array.isArray(st.pts) && st.pts.length > 0);

  return doc;
};
