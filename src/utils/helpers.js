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

/* --- 關係線的兩種畫法 ---
 * 家系圖沒有唯一的畫線規範：本站原本一律把婚姻線拉在兩人符號的正中央
 * （中線式），而 McGoldrick 一系的教科書多半是從兩人符號的下緣各垂一小段、
 * 在下方接成一條橫線，子女再從那條橫線往下（下緣式）。兩種都通行，但混在
 * 同一張圖上會很明顯 —— 舊圖修補時尤其需要跟原圖對齊，不然新疊上去的線
 * 跟底下那張圖就是兩套文法。 */
export const LINE_STYLES = ['center', 'below'];
export const LINE_STYLE_LABELS = { center: '中線式', below: '下緣式' };

/** 下緣式：從符號下緣再往下這麼多，才拉那條橫線。 */
export const MARRY_DROP = 22;

/** 線寬選項。舊圖掃出來的線條通常比預設粗，對得起來才不會像貼上去的。 */
export const LINE_WIDTHS = [1.5, 2, 2.5, 3];

/**
 * 婚姻線的幾何。
 *
 * 兩種畫法都回傳同一組欄位，讓「繪製」「命中判定」「關係品質記號的落點」
 * 三件事共用同一份計算 —— 各自算的話，一切換畫法就會出現「線畫在這裡、
 * 但要拖到那裡才貼得上」這種對不起來的狀況。
 *
 *   segs — 要畫的線段 [[x1, y1, x2, y2], ...]
 *   hit  — 命中判定用的那一段（點選關係線、拖符號上去都用它）
 *   mid  — 離婚／分居斜線的中心點
 *   barY — 子女豎線該從哪個高度接下去
 */
export const marriageGeom = (a, b, style = 'center') => {
  const [l, r] = a.x <= b.x ? [a, b] : [b, a];
  if (style === 'below') {
    const barY = Math.max(a.y, b.y) + R + MARRY_DROP;
    return {
      segs: [
        [l.x, l.y + R, l.x, barY],
        [l.x, barY, r.x, barY],
        [r.x, r.y + R, r.x, barY],
      ],
      hit: [l.x, barY, r.x, barY],
      mid: { x: (l.x + r.x) / 2, y: barY },
      barY,
    };
  }
  return {
    segs: [[l.x + R, l.y, r.x - R, r.y]],
    hit: [l.x + R, l.y, r.x - R, r.y],
    mid: { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 },
    barY: Math.max(l.y, r.y),
  };
};

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

/* 主家系（第一代夫妻＋第二代子女）的自動排版幾何。
   畫布的版面計算與「父母置中」共用這一份，兩邊才不會各算各的中心點。 */
export function computeMainLayout(gen2Cfg = []) {
  const units = gen2Cfg.map((c, i) => {
    const isMarried = c.partner !== 'none';
    const g3 = isMarried ? parseGenders(c.g3Str) : [];
    const w = !isMarried ? SIBLING_GAP
      : Math.max(COUPLE_GAP + SZ, g3.length > 0 ? (g3.length - 1) * SIBLING_GAP + SZ : 0) + 50;
    return { ...c, idx: i, g3, w, isMarried };
  });
  const totalW = units.reduce((s, u) => s + u.w, 0) || 200;
  const originX = Math.max(120, 420 - totalW / 2);
  const fX = originX + totalW / 2 - COUPLE_GAP / 2;
  const mX = originX + totalW / 2 + COUPLE_GAP / 2;
  const parentMidX = (fX + mX) / 2;
  let cx = originX;
  const placed = units.map(u => {
    const midU = cx + u.w / 2;
    const x = u.isMarried ? (units.length === 1 ? parentMidX : midU - COUPLE_GAP / 2) : midU;
    const spouseX = !u.isMarried ? null
      : (units.length === 1 ? parentMidX + COUPLE_GAP : midU + COUPLE_GAP / 2);
    cx += u.w;
    return { ...u, x, spouseX, midU };
  });
  return { units: placed, totalW, originX, fX, mX, parentMidX };
}

/* 第一代夫妻置中：把父母的中點對回「整排第二代子女」的中點，並讓兩人回到
   同一個高度（婚姻線才不會是斜的）。夫妻間距沿用使用者自己拉過的寬度；
   子女若被手動搬過，父母也跟著同樣的位移，不會被拉回預設欄位。
   已經是置中狀態（或還沒有第二代）就回傳 null，呼叫端不必寫入。 */
export function centeredG1(positions = {}, gen2Cfg = []) {
  if (gen2Cfg.length === 0) return null;
  const { units, fX, mX, parentMidX } = computeMainLayout(gen2Cfg);
  const spanMid = (xs) => (Math.min(...xs) + Math.max(...xs)) / 2;
  const defMid = spanMid(units.map(u => u.x));
  const actMid = spanMid(units.map((u, i) => positions[`c${i}`]?.x ?? u.x));
  const targetMid = parentMidX + (actMid - defMid);

  const faP = positions.fa, moP = positions.mo;
  const gap = (faP && moP && moP.x - faP.x > 0) ? moP.x - faP.x : (mX - fX);
  /* 高度取捨：兩人都被搬過 → 取平均，尊重使用者自己安排的高度；
     只有一個被拉歪 → 對回另一個人所在的那一列（也就是預設的 G1 高度）。 */
  const y = (faP && moP) ? Math.round((faP.y + moP.y) / 2) : GEN_Y[0];
  const next = {
    fa: { x: targetMid - gap / 2, y },
    mo: { x: targetMid + gap / 2, y },
  };
  const same = (a, b) => !!a && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
  // 父母都還在自動位置上，而且新算出來的也一樣 → 不必把座標寫死進 positions
  if (!faP && !moP
      && same({ x: fX, y: GEN_Y[0] }, next.fa)
      && same({ x: mX, y: GEN_Y[0] }, next.mo)) return null;
  if (same(faP, next.fa) && same(moP, next.mo)) return null;
  return next;
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
