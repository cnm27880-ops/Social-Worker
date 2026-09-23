/* ===========================================================================
 * 自由擴充的成員「掛到某條婚姻線底下」成為子女
 *
 * 主家系與擴充連線的子代都是「填表 → 自動排版」產生的；舊圖修補或像
 * 「外公外婆 + 三個阿姨舅舅」這種第二個原生家庭，成員通常是自由擴充區
 * 一個一個擺上去的，位置由使用者自己決定。這裡補上缺的那一塊：把已經
 * 擺好的人拖到一對夫妻的婚姻線上放開，他就成為那對夫妻的子女，親子線
 * 自動接上，而且跟那對夫妻原有的子女（如果有）共用同一條手足橫線。
 *
 * 資料形狀：doc.childLinks = [{ id, lineId?, parentId?, childId }]
 *   lineId   — 父母雙方：婚姻線 id（'ml-g1'、'ml-c0'、擴充連線的 id…）
 *   parentId — 單親：只有一位家長時，直接記那個人的 id
 *   childId  — 自由擴充區的節點 id
 * 兩者擇一。一個人只會有一組父母：再放到別的子女區就是改掛過去。
 *
 * 操作方式是「子女放置區」：拖著人經過夫妻（婚姻線中點下方）或單身者
 * （符號正下方）時，會出現「↓子女」的小區塊，放進去就成立。見 dropZones()。
 * =========================================================================== */

/** 把 childLinks 併進已經算好的線條清單（不改動傳入的陣列）。 */
export const mergeChildLinks = (lines, customLinks = [], childLinks = [], nodeIds = []) => {
  if (!childLinks.length) return lines;

  // 所有婚姻線的兩端：主家系算好的 marry 線，加上自由擴充的配偶連線
  const ends = new Map();
  lines.forEach(ln => { if (ln.type === 'marry') ends.set(ln.id, [ln.a, ln.b]); });
  customLinks.forEach(l => {
    if (l.type === 'eco' || l.type === 'annotation') return;
    ends.set(l.id, [l.sourceId, l.targetId]);
  });

  const out = lines.map(ln => (ln.type === 'pc' ? { ...ln, kids: [...ln.kids] } : ln));
  const samePair = (ln, a, b) => (ln.pa === a && ln.pb === b) || (ln.pa === b && ln.pb === a);

  const exists = new Set(nodeIds);
  childLinks.forEach(cl => {
    // 單親：pa、pb 都是同一個人，畫法上親子線直接從他的符號往下
    const pair = cl.parentId
      ? (exists.has(cl.parentId) ? [cl.parentId, cl.parentId] : null)
      : ends.get(cl.lineId);
    if (!pair) return;                                   // 婚姻線／家長已經不在了
    const [a, b] = pair;
    if (cl.childId === a || cl.childId === b) return;    // 不能當自己的子女
    let pc = out.find(ln => ln.type === 'pc' && samePair(ln, a, b));
    if (!pc) {
      pc = { id: `pcx-${cl.lineId || cl.parentId}`, type: 'pc', pa: a, pb: b, kids: [], isExt: true, single: a === b };
      out.push(pc);
    }
    if (!pc.kids.includes(cl.childId)) pc.kids.push(cl.childId);
  });
  return out;
};

/**
 * 設定某人的父母；原本掛在別處的會被取代。
 * target = { lineId } 父母雙方，或 { parentId } 單親。
 */
export const setChildLink = (childLinks = [], childId, target, id) => [
  ...childLinks.filter(cl => cl.childId !== childId),
  { id, childId, ...(target.parentId ? { parentId: target.parentId } : { lineId: target.lineId }) },
];

/** 某人被刪掉，或某條線被刪掉：一起清掉相關的親子關係。沒有就回傳原陣列。 */
export const dropChildLinks = (childLinks = [], { childId, lineId, parentId } = {}) => {
  const next = childLinks.filter(cl =>
    cl.childId !== childId
    && !(lineId && cl.lineId === lineId)
    && !(parentId && cl.parentId === parentId));
  return next.length === childLinks.length ? childLinks : next;
};

/**
 * 掛上去之後，這個人該回到哪裡。
 * 拖曳的起點如果本來就在婚姻線下方（通常就是使用者先擺好的位置），
 * 直接放回起點——「拖上去連線、放開就回原位」，不打亂已經排好的版面。
 * 起點在線的上方或太貼近的話，才改放到婚姻線下方一個世代的距離；
 * 已經有兄弟姊妹的話，對齊他們那一排的高度。
 */
export const childRestPos = ({ start, dropX, barY, siblingYs = [], radius, genGap = 80 }) => {
  if (start && start.y - radius > barY + 20) return { x: start.x, y: start.y };
  const y = siblingYs.length ? Math.max(...siblingYs) : barY + genGap;
  return { x: dropX, y };
};

/* ===========================================================================
 * 子女放置區
 * =========================================================================== */

/** 放置區中心在符號（或婚姻線）下方多遠、多大範圍內算放進去。 */
export const ZONE_DY = 30;
export const ZONE_HIT = 18;

/**
 * 算出拖曳某個人時可以放的子女區。
 *   couples — [{ id: 婚姻線 id, a, b }]，posOf(id) 回傳座標
 *   singles — 可以當單親的人的 id（沒有任何婚姻連線的人）
 *   barYOf(couple) — 那對夫妻的子女豎線從哪個高度接下去
 * 拖著的人自己，以及自己當中一員的夫妻，都不會出現放置區。
 * blocked 是拖著的人的子孫：放進子孫的子女區會變成自己的祖先，一律不給。
 * 回傳 [{ key, x, y, target: { lineId } | { parentId } }]。
 */
export const dropZones = ({ draggedId, couples = [], singles = [], posOf, barYOf, radius, blocked = new Set() }) => {
  const zones = [];
  couples.forEach(c => {
    if (c.a === draggedId || c.b === draggedId) return;
    if (blocked.has(c.a) || blocked.has(c.b)) return;
    const pa = posOf(c.a), pb = posOf(c.b);
    const y = Math.max(barYOf(c), Math.max(pa.y, pb.y) + radius) + ZONE_DY - radius / 2;
    zones.push({ key: `l:${c.id}`, x: (pa.x + pb.x) / 2, y, target: { lineId: c.id } });
  });
  singles.forEach(id => {
    if (id === draggedId || blocked.has(id)) return;
    const p = posOf(id);
    zones.push({ key: `p:${id}`, x: p.x, y: p.y + radius + ZONE_DY - radius / 2, target: { parentId: id } });
  });
  return zones;
};

/** 游標（被拖的人的中心）落在哪一個放置區裡；沒有回傳 null。 */
export const hitZone = (zones, pt, hit = ZONE_HIT) => {
  let best = null, bestD = hit;
  for (const z of zones) {
    const d = Math.hypot(pt.x - z.x, pt.y - z.y);
    if (d < bestD) { bestD = d; best = z; }
  }
  return best;
};

/** 某人的所有子孫（沿親子線往下）。 */
export const descendantsOf = (lines, id) => {
  const out = new Set();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    lines.forEach(ln => {
      if (ln.type !== 'pc' || (ln.pa !== cur && ln.pb !== cur)) return;
      ln.kids.forEach(k => { if (!out.has(k)) { out.add(k); stack.push(k); } });
    });
  }
  return out;
};
