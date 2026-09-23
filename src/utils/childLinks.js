/* ===========================================================================
 * 自由擴充的成員「掛到某條婚姻線底下」成為子女
 *
 * 主家系與擴充連線的子代都是「填表 → 自動排版」產生的；舊圖修補或像
 * 「外公外婆 + 三個阿姨舅舅」這種第二個原生家庭，成員通常是自由擴充區
 * 一個一個擺上去的，位置由使用者自己決定。這裡補上缺的那一塊：把已經
 * 擺好的人拖到一對夫妻的婚姻線上放開，他就成為那對夫妻的子女，親子線
 * 自動接上，而且跟那對夫妻原有的子女（如果有）共用同一條手足橫線。
 *
 * 資料形狀：doc.childLinks = [{ id, lineId, childId }]
 *   lineId  — 婚姻線 id（'ml-g1'、'ml-c0'、擴充連線的 id…，見 GenogramTab）
 *   childId — 自由擴充區的節點 id
 * 一個人只會有一對父母：再拖到別條線上就是改掛過去。
 * =========================================================================== */

/** 把 childLinks 併進已經算好的線條清單（不改動傳入的陣列）。 */
export const mergeChildLinks = (lines, customLinks = [], childLinks = []) => {
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

  childLinks.forEach(cl => {
    const pair = ends.get(cl.lineId);
    if (!pair) return;                                   // 婚姻線已經不在了
    const [a, b] = pair;
    if (cl.childId === a || cl.childId === b) return;    // 不能當自己的子女
    let pc = out.find(ln => ln.type === 'pc' && samePair(ln, a, b));
    if (!pc) {
      pc = { id: `pcx-${cl.lineId}`, type: 'pc', pa: a, pb: b, kids: [], isExt: true };
      out.push(pc);
    }
    if (!pc.kids.includes(cl.childId)) pc.kids.push(cl.childId);
  });
  return out;
};

/** 設定某人的父母（婚姻線）；原本掛在別條線上的會被取代。 */
export const setChildLink = (childLinks = [], childId, lineId, id) => [
  ...childLinks.filter(cl => cl.childId !== childId),
  { id, lineId, childId },
];

/** 某人被刪掉，或某條線被刪掉：一起清掉相關的親子關係。沒有就回傳原陣列。 */
export const dropChildLinks = (childLinks = [], { childId, lineId } = {}) => {
  const next = childLinks.filter(cl => cl.childId !== childId && cl.lineId !== lineId);
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
