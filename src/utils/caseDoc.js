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

import { migrateBgPatch } from './bgImage';

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

  /* --- 主家系開關 ---
   * false 時，整組自動產生的主家系（第一代夫妻、第二代、第三代與它們的線）
   * 都不畫，畫布上只剩自由擴充區、文字方塊、圈選與底圖。
   *
   * 為什麼需要這個開關：第一代那兩個符號是寫死進畫布的，沒有「空白畫布」
   * 這個狀態。匯入舊圖修補時，它們一定壓在別人畫好的圖上，而且刪不掉。
   * 而舊圖上的人物本來就該用自由擴充區一個一個加 —— 主家系是「填表自動
   * 排版」，跟「在既有的圖上加註」是相反的操作方式，硬要並存只會互相打架。
   *
   * 關掉不會銷毀 gen2Cfg 等資料，切回來整組都在。 */
  mainFamily: true,

  /* --- 關係線畫法與線寬 ---
   * 見 utils/helpers.js 的 marriageGeom：家系圖的畫線沒有唯一規範，
   * 舊圖修補時要能配合原圖，新疊上去的線才不會跟底下那張圖是兩套文法。 */
  lineStyle: 'center',
  lineWidth: 2,

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
   * { src: dataURL, w, h, x, y, scale, baseX, baseY, baseScale, opacity, fromApp, v }
   * src 存 dataURL 而不是 File／blob URL：blob URL 重新整理就失效，
   * 而底圖必須跟著案件一起存進案件庫、一起匯出成 .json。
   * 上傳時會先縮圖再轉 dataURL（見 utils/bgImage.js），避免把
   * 一張幾 MB 的掃描圖塞爆 localStorage 配額。 */
  bgImage: null,

  /* --- 底圖橡皮擦筆跡 ---
   * [{ id, w, pts: [[x, y], ...] }]，座標與筆寬都是「圖片自身的像素」，
   * 不是畫布座標 —— 底圖被拖動或縮放時，擦掉的地方才會跟著一起走。
   * 底圖是點陣圖，「擦掉」的做法是拿這些筆跡組成 SVG mask 把該處挖成透明，
   * 而不是在上面塗白色 —— 塗白在去背 PNG 匯出時會留下白色筆跡。 */
  bgErase: [],

  /* --- 個案紀錄產生器的填寫內容 ---
   * 這兩塊原本是 RecordTab 自己的 useState，不在文件裡，於是「重置」碰不到
   * 它們、Ctrl+Z 管不到、切換案件時上一份的內容還會留在欄位上。搬進文件之後
   * 這三件事一次解決，也會跟著案件一起存檔與匯出。
   * famExtras 的 key 是家屬代號（第二代用索引，第三代用 'c0k1' 這類字串）。 */
  subjInfo: {
    identity: '一般民眾', job: '', edu: '', lang: '',
    religion: '', disability: '無身心障礙手冊', note: '',
  },
  famExtras: {},

  /* 使用者手動改過的紀錄全文。空字串＝沒改過，預覽就照家系圖即時重新產生；
     一旦有內容就以這份為準，家系圖再變動也不會覆蓋掉手寫的字。
     用 '' 而不是 null 當「沒改過」：migrateDoc 會比對 typeof，fallback 是
     null 的話存回來的字串會被判定型別不符而丟掉。 */
  recordEdit: '',

  /* --- 影響輸出結果的繪圖選項 --- */
  cohabMode: 'auto',
  cohabSolid: false,
  ipStyle: 'filled',
  textDirection: 'horizontal',
  extColorMode: 'black',
  /* showAgeMode 已移除：年齡改成填了就一直畫在節點上，沒有隱藏狀態。
     舊案件檔裡殘留的這個 key 不會被讀到，載入時安靜忽略即可。 */
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
 * 清掉單一節點身上的所有標記（死亡／身障／慢性病可以疊在同一個節點上，
 * 要靠 toggleAttr 一個一個取消很麻煩）。「清除」模式用這個。
 * 本來就沒有標記時回傳原物件，避免產生無意義的一筆復原紀錄。
 */
export const clearAttrs = (nodeAttrs, id) => {
  if (!nodeAttrs[id]) return nodeAttrs;
  const next = { ...nodeAttrs };
  delete next[id];
  return next;
};

/** 清掉一條線的關係品質標記。同樣沒有就原封不動回傳。 */
export const clearLineAttr = (lineAttrs, lineId) => {
  if (!(lineId in lineAttrs)) return lineAttrs;
  const next = { ...lineAttrs };
  delete next[lineId];
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
 * 第二代改動時的索引搬遷
 *
 * 節點 id 是從陣列位置算出來的（c0、s0、g0_1、ml-c0…），famExtras 的第二代
 * key 也是純索引。所以「女男男」改成「男女男男」時，同一個索引會突然代表
 * 另一個人——已歿標記、家屬備註、年齡、座標全部留在原位，靜靜地跟錯人。
 *
 * 這裡不改 id 格式（那會讓所有既有存檔都要轉換），而是在子女清單變動的
 * 那一刻，先算出新舊索引的對應，再把所有以索引為 key 的資料一起搬過去。
 * =========================================================================== */

/**
 * 用最長共同子序列對位新舊的性別序列，回傳 newIndex → oldIndex 的陣列
 * （對不到的位置是 -1，代表那是新增的人）。
 * 性別相同才可能對到——插一個男孩進「女男男」的最前面，原本三個人會整批
 * 往後對到 1、2、3，而不是留在原位被當成別人。
 */
export const alignGen2 = (oldGenders = [], newGenders = []) => {
  const n = oldGenders.length, m = newGenders.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = oldGenders[i] === newGenders[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const newToOld = new Array(m).fill(-1);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (oldGenders[i] === newGenders[j]) { newToOld[j] = i; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return newToOld;
};

/**
 * 依對位結果搬移文件裡所有以第二代索引為 key 的資料，回傳可直接餵給
 * patchDoc 的 patch。對不到的舊索引（人被刪掉了）連同資料一起丟棄。
 * 與第二代無關的 key（ml-g1、擴充連線的 id、擴充子代的 famExtras）原樣保留。
 */
export const remapGen2Keys = (doc, newToOld) => {
  const oldToNew = new Map();
  newToOld.forEach((oldIdx, newIdx) => { if (oldIdx >= 0) oldToNew.set(oldIdx, newIdx); });

  const mapId = (id) => {
    if (typeof id !== 'string') return id;
    let m;
    if ((m = /^([cs])(\d+)$/.exec(id))) {
      const to = oldToNew.get(Number(m[2]));
      return to === undefined ? null : `${m[1]}${to}`;
    }
    if ((m = /^g(\d+)_(\d+)$/.exec(id))) {
      const to = oldToNew.get(Number(m[1]));
      return to === undefined ? null : `g${to}_${m[2]}`;
    }
    if ((m = /^ml-c(\d+)$/.exec(id))) {
      const to = oldToNew.get(Number(m[1]));
      return to === undefined ? null : `ml-c${to}`;
    }
    return id;
  };

  const remapObj = (obj) => {
    const next = {};
    for (const [k, v] of Object.entries(obj || {})) {
      const nk = mapId(k);
      if (nk !== null) next[nk] = v;
    }
    return next;
  };

  // famExtras：第二代的 key 是純數字，擴充子代的是 'lnk_c1' 這種字串
  const famExtras = {};
  for (const [k, v] of Object.entries(doc.famExtras || {})) {
    if (/^\d+$/.test(k)) {
      const to = oldToNew.get(Number(k));
      if (to !== undefined) famExtras[to] = v;
    } else {
      famExtras[k] = v;
    }
  }

  return {
    nodeAttrs: remapObj(doc.nodeAttrs),
    positions: remapObj(doc.positions),
    ages: remapObj(doc.ages),
    lineAttrs: remapObj(doc.lineAttrs),
    famExtras,
    cohabMembers: (doc.cohabMembers || []).map(mapId).filter(Boolean),
    indexId: doc.indexId ? mapId(doc.indexId) : null,
  };
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
  // v1 的底圖沒有 x/y，筆跡也還存在畫布座標；換算成目前的格式（見 utils/bgImage.js）
  const bgPatch = migrateBgPatch(doc.bgImage, doc.bgErase);
  doc.bgImage = bgPatch.bgImage;
  doc.bgErase = bgPatch.bgErase;

  return doc;
};
