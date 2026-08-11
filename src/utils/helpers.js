/* ===== 常數 ===== */
export const SZ = 36;
export const R = SZ / 2;
export const COUPLE_GAP = 64;
export const SIBLING_GAP = 100;
export const GEN_Y = [80, 160, 240];
export const TEXT_FONT = "'Times New Roman', 'DFKai-SB', 'BiauKai', serif";

/* --- 狀態標籤文字對照 --- */
export const G2_STATUSES = ['none', 'married', 'cohab', 'separated', 'divorced'];
export const G2_LABELS = { none: '未婚', married: '已婚', cohab: '同居', separated: '分居', divorced: '離婚' };
export const G1_STATUSES = ['married', 'divorced'];
export const G1_LABELS = { married: '已婚', divorced: '離婚' };
export const TEXT_DIRS = ['horizontal', 'vertical'];
export const TEXT_DIR_LABELS = { horizontal: '橫式排版', vertical: '直式排版' };

/* ===== 工具函數 ===== */

// 支援 1,2 的性別解析器
export function parseGenders(str) {
  if (!str) return [];
  const out = [];
  for (const c of str.trim()) {
    if (c === '男' || c === 'M' || c === 'm' || c === '1') out.push('M');
    else if (c === '女' || c === 'F' || c === 'f' || c === '2') out.push('F');
  }
  return out;
}

// 圓潤平滑曲線魔法
export function getSmoothPath(pts, closed = false) {
  if (pts.length < 2) return '';
  const points = closed ? [...pts, pts[0], pts[1], pts[2] || pts[0]] : pts;
  let d = `M ${points[0].x},${points[0].y} `;
  for (let i = 0; i < (closed ? pts.length : points.length - 1); i++) {
    const p0 = points[i === 0 ? 0 : i - 1], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] || p2;
    const tension = 0.18;
    const cp1x = p1.x + (p2.x - p0.x) * tension, cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension, cp2y = p2.y - (p3.y - p1.y) * tension;
    d += `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y} `;
  }
  return closed ? d + 'Z' : d;
}

// 排行用字：長 / 次 / 三…十 / 么
const RANK_NUMS = ['','','','三','四','五','六','七','八','九','十'];
const rankWord = (rank, total) => {
  if (rank === 1) return '長';
  if (rank === 2) return '次';
  if (rank === total && rank > 2) return '么';
  return RANK_NUMS[rank] || String(rank);
};

// 智慧稱謂計算機 (例如：案長女、案么子)
export const getRelativeTitle = (gender, idx, allGen2) => {
  const sameGender = allGen2.filter(c => c.gender === gender);
  const myRank = allGen2.slice(0, idx).filter(c => c.gender === gender).length + 1;
  const type = gender === 'M' ? '子' : '女';
  if (sameGender.length === 1) return `案長${type}`;
  return `案${rankWord(myRank, sameGender.length)}${type}`;
};

/* ===== 案主視角（案主可能不是第一代，而是第二代其中一人） ===== */

// 案主若是第二代成員，回傳它在 gen2Cfg 中的索引；不是的話回傳 -1
export const getIndexGen2Idx = (indexId, gen2Cfg = []) => {
  if (!indexId || !/^c\d+$/.test(indexId)) return -1;
  const idx = parseInt(indexId.slice(1), 10);
  return Number.isInteger(idx) && idx >= 0 && idx < gen2Cfg.length ? idx : -1;
};

// 手足稱謂：比案主早出生為兄／姊，晚出生為弟／妹，並依同類手足排行
export const getSiblingTitle = (gender, idx, selfIdx, allGen2) => {
  const isElder = idx < selfIdx;
  const type = gender === 'M' ? (isElder ? '兄' : '弟') : (isElder ? '姊' : '妹');
  // 同性別、且與本人同一側（兄姊或弟妹）的手足，依出生序排行
  const group = allGen2
    .map((c, i) => ({ gender: c.gender, i }))
    .filter(c => c.i !== selfIdx && c.gender === gender && (c.i < selfIdx) === isElder);
  if (group.length <= 1) return `案${type}`;
  const rank = group.findIndex(c => c.i === idx) + 1;
  return `案${rankWord(rank, group.length)}${type}`;
};

/* 第二代某位成員在「個案紀錄」中的稱謂：
   - 案主未指定，或案主是第一代（案父／案母）→ 沿用子女稱謂（案長子…）
   - 案主本身是第二代 → 其餘第二代改用手足稱謂（案兄／案姊／案弟／案妹） */
export const getGen2Title = (idx, gen2Cfg, indexId) => {
  const selfIdx = getIndexGen2Idx(indexId, gen2Cfg);
  const gender = gen2Cfg[idx]?.gender;
  if (selfIdx < 0) return getRelativeTitle(gender, idx, gen2Cfg);
  if (idx === selfIdx) return '案主';
  return getSiblingTitle(gender, idx, selfIdx, gen2Cfg);
};

// 子代字串轉化文字 (自動將 1/2 轉回中文男/女)
export const formatKidsText = (str) => {
  if (!str) return '';
  if (str === '無') return '無子嗣';
  const gs = parseGenders(str);
  if (gs.length === 0) return '';
  const m = gs.filter(g => g === 'M').length, f = gs.filter(g => g === 'F').length;
  let res = '育有';
  if (m > 0 && f > 0) res += `${m}子${f}女`;
  else if (m > 0) res += `${m}子`;
  else res += `${f}女`;

  // 將解析出的 M/F 陣列，完美翻譯回中文「男/女」
  const chineseStr = gs.map(g => g === 'M' ? '男' : '女').join('');
  return `${res}(${chineseStr})`;
};
