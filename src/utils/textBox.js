/* ===========================================================================
 * 文字方塊的幾何：尺寸估算、直式排版、吸附到人物節點
 *
 * 文字方塊的資料形狀：
 *   { id, x, y, text, fontSize, vertical, anchor? }
 *   anchor = { id: 節點 id, side: 'top' | 'bottom' | 'left' | 'right' }
 *
 * 綁定（anchor）存在時，x / y 由節點座標即時算出，節點搬到哪標籤就跟到哪；
 * 存著的 x / y 只是「節點不見了（被刪掉、子女數改少、主家系關掉）」時的
 * 退路，讓標籤停在最後吸附的位置，而不是跳回左上角。
 *
 * 座標慣例（沿用原本的畫法，舊存檔不會跑位）：
 *   - 橫式：(x, y) 是第一行的基線左端，方塊頂端在 y − fontSize
 *   - 直式：(x, y) 是方塊的左上角
 *
 * 尺寸全部用估算而不是瀏覽器量測（getBBox）：匯出裁切、吸附位置、單元測試
 * 都要用同一份數字，而量測只有在畫面上真的畫出來之後才拿得到。
 * =========================================================================== */

export const TEXT_SIDES = ['top', 'right', 'bottom', 'left'];

/** 標籤跟節點邊緣的距離。 */
export const ANCHOR_GAP = 6;

const LINE_H = 1.3;   // 橫式行高（em）
const CELL_H = 1.15;  // 直式每格高度（em）
const COL_W = 1.35;   // 直式每欄寬度（em）

/** 半形字（英數、半形標點）大約佔半個字寬，其餘（中文、全形）佔一個字寬。 */
const isNarrow = (ch) => ch.charCodeAt(0) < 0x2E80;
const charW = (ch) => (isNarrow(ch) ? 0.55 : 1);
const lineW = (line) => [...line].reduce((s, ch) => s + charW(ch), 0);

/**
 * 直式排版的「格」：每格畫一個直立的字。
 * 連續 1～2 個半形英數字併成一格橫著放（縱中橫），像「12」「3F」不會變成
 * 兩個疊起來的數字；3 個以上（年份、電話）就一個字一格往下排，否則會擠
 * 到超出欄寬。
 * 不用瀏覽器的 writing-mode：它會把數字整串躺平，而且 Word 開 SVG、
 * 部分舊瀏覽器轉 PNG 時的表現不一致。自己排，每個環境結果都一樣。
 */
export const verticalCells = (line) => {
  const cells = [];
  const re = /[0-9A-Za-z]+|[^0-9A-Za-z]/gu;
  let m;
  while ((m = re.exec(line))) {
    const tok = m[0];
    if (/^[0-9A-Za-z]+$/.test(tok) && tok.length <= 2) cells.push(tok);
    else cells.push(...tok);
  }
  return cells;
};

/**
 * 方塊的外框，相對於 (t.x, t.y)。vertical 可以覆寫（吸在左右兩側時一律直式）。
 * 回傳 { left, top, w, h }。
 */
export const textBoxSize = (t, vertical = t.vertical) => {
  const fs = t.fontSize || 16;
  const lines = (t.text || '').split('\n');
  if (vertical) {
    const maxCells = Math.max(1, ...lines.map(l => verticalCells(l).length));
    return { left: 0, top: 0, w: lines.length * fs * COL_W, h: maxCells * fs * CELL_H };
  }
  const maxW = Math.max(1, ...lines.map(lineW));
  return { left: 0, top: -fs, w: maxW * fs, h: lines.length * fs * LINE_H };
};

/** 吸在左右兩側的標籤用直式，上下兩側照方塊本身的設定。 */
export const effectiveVertical = (t) =>
  t.anchor && (t.anchor.side === 'left' || t.anchor.side === 'right') ? true : !!t.vertical;

/**
 * 吸附在節點某一側時，方塊的 (x, y) 該放哪。
 * nodePos 是節點中心，radius 是節點外緣到中心的距離。
 */
export const anchoredXY = (t, nodePos, side, radius) => {
  const vertical = side === 'left' || side === 'right' ? true : !!t.vertical;
  const { left, top, w, h } = textBoxSize(t, vertical);
  const reach = radius + ANCHOR_GAP;
  let bx, by;   // 方塊左上角
  if (side === 'top')         { bx = nodePos.x - w / 2; by = nodePos.y - reach - h; }
  else if (side === 'bottom') { bx = nodePos.x - w / 2; by = nodePos.y + reach; }
  else if (side === 'left')   { bx = nodePos.x - reach - w; by = nodePos.y - h / 2; }
  else                        { bx = nodePos.x + reach; by = nodePos.y - h / 2; }
  return { x: bx - left, y: by - top };
};

/**
 * 算出畫面上實際要畫的方塊：有綁定而且節點還在的，換成吸附位置。
 * posOf(id) 回傳節點中心，找不到回傳 null。
 */
export const resolveText = (t, posOf, radius) => {
  if (!t.anchor) return { ...t, vertical: !!t.vertical };
  const p = posOf(t.anchor.id);
  if (!p) return { ...t, vertical: !!t.vertical, anchor: undefined };
  return { ...t, ...anchoredXY(t, p, t.anchor.side, radius), vertical: effectiveVertical(t) };
};

/**
 * 方塊中心相對節點中心的方向決定吸在哪一側：橫向偏多就左右，否則上下。
 * 已經吸在某一側時要「明顯」偏到另一軸（1.25 倍）才換邊——吸到左右會變成
 * 直式、方塊形狀跟著變，沒有這段黏性的話，拖在斜角附近會一直來回跳。
 */
export const pickSide = (nodePos, pt, current = null) => {
  const dx = pt.x - nodePos.x, dy = pt.y - nodePos.y;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const horizontalNow = current === 'left' || current === 'right';
  const verticalNow = current === 'top' || current === 'bottom';
  let horizontal = ax > ay;
  if (horizontalNow && ay <= ax * 1.25) horizontal = true;
  if (verticalNow && ax <= ay * 1.25) horizontal = false;
  if (horizontal) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'top' : 'bottom';
};

/** 方塊中心要離節點「剛好吸住的位置」多近才吸上去；已經吸著的要拉多遠才放開。 */
const SNAP_IN = 18;
const SNAP_OUT = 45;

/** 方塊中心（畫布座標）。 */
export const textCenter = (t, vertical = effectiveVertical(t)) => {
  const { left, top, w, h } = textBoxSize(t, vertical);
  return { x: t.x + left + w / 2, y: t.y + top + h / 2 };
};

/** 反過來：要讓方塊中心落在 c，(x, y) 該是多少。 */
export const xyForCenter = (t, vertical, c) => {
  const { left, top, w, h } = textBoxSize(t, vertical);
  return { x: c.x - left - w / 2, y: c.y - top - h / 2 };
};

/**
 * 拖曳文字方塊時決定要不要吸附、吸在誰的哪一側。
 *   t          — 被拖的方塊（帶著目前的 anchor）
 *   center     — 游標帶著方塊中心走到哪
 *   candidates — [{ id, x, y }] 可以吸的節點中心
 * 回傳新的 anchor（{ id, side }）或 null（不吸，自由放置）。
 *
 * 用方塊中心而不是游標判斷：抓著長標籤的尾巴拖時，游標可能離節點很遠，
 * 但標籤本身還在節點旁邊。拖曳時也是記「游標到中心」的距離而不是到
 * (x, y)：吸到左右會換成直式，(x, y) 的意義跟著變（見檔頭的座標慣例），
 * 只有中心在兩種排版下都代表同一個點。
 */
export const snapWhileDragging = (t, center, candidates, radius) => {
  const { w, h } = textBoxSize(t, effectiveVertical(t));
  const natural = radius + ANCHOR_GAP + Math.min(w, h) / 2;

  const cur = t.anchor && candidates.find(c => c.id === t.anchor.id);
  if (cur && Math.hypot(center.x - cur.x, center.y - cur.y) < natural + SNAP_OUT) {
    return { id: cur.id, side: pickSide(cur, center, t.anchor.side) };
  }
  let best = null, bestD = natural + SNAP_IN;
  for (const c of candidates) {
    const d = Math.hypot(center.x - c.x, center.y - c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best ? { id: best.id, side: pickSide(best, center) } : null;
};

/**
 * 節點被刪掉前，把綁在它身上的標籤解開，停在目前畫面上的位置。
 * 不解開的話標籤會跳回最早吸附時存的那組座標。
 */
export const detachTextsFrom = (texts, nodeId, posOf, radius) => {
  if (!texts.some(t => t.anchor?.id === nodeId)) return texts;
  return texts.map(t => {
    if (t.anchor?.id !== nodeId) return t;
    const r = resolveText(t, posOf, radius);
    const { anchor, ...rest } = t;
    return { ...rest, x: r.x, y: r.y, vertical: r.vertical };
  });
};

/** 複製一個文字方塊：內容與字級照抄，不帶綁定，位置往右下錯開一點。 */
export const duplicateText = (t, resolved, newId, offset = 20) => {
  const { anchor, ...rest } = t;
  return { ...rest, id: newId, x: resolved.x + offset, y: resolved.y + offset, vertical: resolved.vertical };
};

/**
 * 直式方塊每一格字的落點（相對方塊左上角）。第一行在最右邊，往左換行，
 * 跟中文直書的閱讀順序一致。y 是基線，所以往下再加一點字高。
 */
export const verticalGlyphs = (t) => {
  const fs = t.fontSize || 16;
  const lines = (t.text || '').split('\n');
  const w = lines.length * fs * COL_W;
  const out = [];
  lines.forEach((line, li) => {
    const cx = w - (li + 0.5) * fs * COL_W;
    verticalCells(line).forEach((cell, ci) => {
      out.push({ key: `${li}-${ci}`, text: cell, x: cx, y: ci * fs * CELL_H + fs * 0.9 });
    });
  });
  return out;
};
