/* ===========================================================================
 * 從家系圖的連線推算「跟案主的關係」
 *
 * 個案紀錄原本只認得主家系（案父母、第二代、第三代）與「直接連到案主」的
 * 擴充連線。自由擴充區的人（配偶那邊的原生家庭、手足的配偶…）不在固定
 * 的欄位裡，紀錄就寫不到他們。
 *
 * 這裡不要求使用者替每個人標世代或填稱謂，而是直接沿著圖上的線走：
 *   婚姻線（夫妻）、親子線（含「放進子女區」的成員）、同父母（手足）
 * 從案主出發找最短的一條路，每一步翻成一個字再用「之」串起來：
 *   案主 →妻 →父          ＝ 案妻之父
 *   案主 →妻 →兄（手足）   ＝ 案妻之兄
 * 串接寫法一定正確；常見的兩層關係再換成慣用簡稱（案岳父、案姑姑…），
 * 查不到簡稱就維持串接。算得不合意的，使用者直接改紀錄文字就好（預覽
 * 本來就可以直接編輯，見 RecordTab）。
 *
 * 手足長幼：家系圖慣例是同一排手足由左到右、由長到幼，所以比 x 座標——
 * 在左邊的是兄姊。
 * =========================================================================== */

import { formatKidsText } from './helpers';

/** 兩層關係的慣用簡稱。key 是每一步的代號，用 '>' 串起來（見 stepCode）。 */
const SHORT = {
  'S-F>U-M': '案岳父', 'S-F>U-F': '案岳母', 'S-M>U-M': '案公公', 'S-M>U-F': '案婆婆',
  'U-M>U-M': '案祖父', 'U-M>U-F': '案祖母', 'U-F>U-M': '案外祖父', 'U-F>U-F': '案外祖母',
  'U-M>B-M+': '案伯父', 'U-M>B-M-': '案叔叔', 'U-M>B-F+': '案姑姑', 'U-M>B-F-': '案姑姑',
  'U-F>B-M+': '案舅舅', 'U-F>B-M-': '案舅舅', 'U-F>B-F+': '案阿姨', 'U-F>B-F-': '案阿姨',
  'B-M+>D-M': '案姪子', 'B-M->D-M': '案姪子', 'B-M+>D-F': '案姪女', 'B-M->D-F': '案姪女',
  'B-F+>D-M': '案外甥', 'B-F->D-M': '案外甥', 'B-F+>D-F': '案外甥女', 'B-F->D-F': '案外甥女',
  'D-M>D-M': '案孫子', 'D-M>D-F': '案孫女', 'D-F>D-M': '案外孫', 'D-F>D-F': '案外孫女',
  'D-M>S-F': '案媳婦', 'D-F>S-M': '案女婿',
  'B-M+>S-F': '案大嫂', 'B-M->S-F': '案弟媳', 'B-F+>S-M': '案姊夫', 'B-F->S-M': '案妹夫',
};

const MARITAL = { married: '已婚', divorced: '離婚', separated: '分居', cohab: '同居' };

/**
 * 整理出關係圖。
 *   people  — Map id → { gender, x }（只收人物；三角、寵物、生態圖不算）
 *   parents — Map 子女 id → [家長 id…]
 *   kids    — Map 家長 id → [子女 id…]
 *   spouses — Map id → [{ id, status }]
 */
export const buildKinGraph = ({ nodes = [], lines = [], freeNodes = [], customLinks = [], positions = {} }) => {
  const people = new Map();
  nodes.forEach(n => people.set(n.id, { gender: n.gender, x: positions[n.id]?.x ?? n.dx }));
  freeNodes.forEach(fn => {
    if (fn.gender === 'M' || fn.gender === 'F') people.set(fn.id, { gender: fn.gender, x: fn.x });
  });

  const parents = new Map(), kids = new Map(), spouses = new Map();
  const push = (map, k, v) => { if (!map.has(k)) map.set(k, []); if (!map.get(k).includes(v)) map.get(k).push(v); };

  lines.forEach(ln => {
    if (ln.type === 'pc') {
      const ps = ln.pa === ln.pb ? [ln.pa] : [ln.pa, ln.pb];
      ln.kids.forEach(k => {
        if (!people.has(k)) return;
        ps.forEach(p => { if (people.has(p)) { push(parents, k, p); push(kids, p, k); } });
      });
    } else if (ln.type === 'marry') {
      push(spouses, ln.a, { id: ln.b, status: ln.status });
      push(spouses, ln.b, { id: ln.a, status: ln.status });
    }
  });
  customLinks.forEach(l => {
    if (l.type === 'eco' || l.type === 'annotation') return;
    push(spouses, l.sourceId, { id: l.targetId, status: l.status });
    push(spouses, l.targetId, { id: l.sourceId, status: l.status });
  });
  return { people, parents, kids, spouses };
};

/** 一個人的手足：跟他至少有一位共同家長的其他人。 */
const siblingsOf = (g, id) => {
  const out = new Set();
  (g.parents.get(id) || []).forEach(p => (g.kids.get(p) || []).forEach(k => { if (k !== id) out.add(k); }));
  return [...out];
};

/** 每一步的代號與用字。from 是上一個人，to 是這一步走到的人。 */
const describeStep = (g, type, from, to, status) => {
  const t = g.people.get(to), f = g.people.get(from);
  const M = t.gender === 'M';
  if (type === 'U') return { code: `U-${t.gender}`, word: M ? '父' : '母' };
  if (type === 'D') return { code: `D-${t.gender}`, word: M ? '子' : '女' };
  if (type === 'S') {
    if (status === 'divorced') return { code: `X-${t.gender}`, word: M ? '前夫' : '前妻' };
    if (status === 'cohab') return { code: `C-${t.gender}`, word: '同居人' };
    return { code: `S-${t.gender}`, word: M ? '夫' : '妻' };
  }
  // 手足：左邊的是兄姊（家系圖慣例由左到右、由長到幼）
  const elder = t.x < f.x;
  return { code: `B-${t.gender}${elder ? '+' : '-'}`, word: M ? (elder ? '兄' : '弟') : (elder ? '姊' : '妹') };
};

/**
 * 從案主出發，算出每個連得到的人的稱謂。
 * 回傳 Map id → { title, chain, dist }：title 是最後採用的稱謂（有簡稱就用簡稱），
 * chain 是完整的串接寫法。案主自己不在裡面。
 */
export const kinTitles = (g, indexId) => {
  const out = new Map();
  if (!indexId || !g.people.has(indexId)) return out;
  // 廣度優先：步數最少的路先到。同步數時依「配偶 → 手足 → 父母 → 子女」的順序，
  // 例如配偶的哥哥會走「妻 → 兄」而不是「妻 → 父 → 子」。
  const seen = new Set([indexId]);
  let frontier = [{ id: indexId, steps: [] }];
  while (frontier.length) {
    const next = [];
    for (const cur of frontier) {
      const moves = [
        ...(g.spouses.get(cur.id) || []).map(s => ['S', s.id, s.status]),
        ...siblingsOf(g, cur.id).map(id => ['B', id]),
        ...(g.parents.get(cur.id) || []).map(id => ['U', id]),
        ...(g.kids.get(cur.id) || []).map(id => ['D', id]),
      ];
      for (const [type, id, status] of moves) {
        if (seen.has(id) || !g.people.has(id)) continue;
        seen.add(id);
        const steps = [...cur.steps, describeStep(g, type, cur.id, id, status)];
        const chain = '案' + steps.map(s => s.word).join('之');
        const title = SHORT[steps.map(s => s.code).join('>')] || chain;
        out.set(id, { title, chain, dist: steps.length });
        next.push({ id, steps });
      }
    }
    frontier = next;
  }
  return out;
};

/**
 * 個案紀錄的「其他家屬」段落：自由擴充區、連得到案主的每一位，一人一行。
 * 主家系與「直接連到案主」的擴充連線原本就有自己的段落，這裡不重複寫。
 *   deceasedIds／disabledIds — 已歿、身障標記
 * 回傳 { text, unlinked }：unlinked 是自由擴充區裡連不到案主的人數，
 * 給畫面提示用（沒寫進紀錄的人，使用者應該知道）。
 */
export const extraMembersText = ({ family, freeNodes = [], customLinks = [], positions = {}, indexId, deceasedIds = [], disabledIds = [] }) => {
  const persons = freeNodes.filter(fn => fn.gender === 'M' || fn.gender === 'F');
  if (!indexId || persons.length === 0) return { text: '', unlinked: 0 };

  const g = buildKinGraph({ ...family, freeNodes, customLinks, positions });
  const titles = kinTitles(g, indexId);

  // 直接跟案主有擴充連線的（再婚配偶、前配偶）已經寫在上面的段落
  const describedAbove = new Set(customLinks
    .filter(l => l.type !== 'eco' && l.type !== 'annotation' && (l.sourceId === indexId || l.targetId === indexId))
    .map(l => (l.sourceId === indexId ? l.targetId : l.sourceId)));

  const rows = persons
    .filter(p => p.id !== indexId && titles.has(p.id) && !describedAbove.has(p.id))
    .map(p => ({ p, ...titles.get(p.id) }))
    .sort((a, b) => a.dist - b.dist || a.p.x - b.p.x);

  const text = rows.map(({ p, title }) => {
    if (deceasedIds.includes(p.id)) return `${title}已歿；\n`;
    let line = title;
    const sp = g.spouses.get(p.id)?.[0];
    if (sp && MARITAL[sp.status]) line += `，${MARITAL[sp.status]}`;
    // 子女由左到右＝由長到幼（家系圖慣例），括號裡的順序才對得上圖
    const ks = (g.kids.get(p.id) || []).map(k => g.people.get(k)).filter(Boolean)
      .sort((a, b) => a.x - b.x).map(k => k.gender);
    if (ks.length) line += `，${formatKidsText(ks.join(''))}`;
    if (disabledIds.includes(p.id)) line += '，領有身心障礙證明';
    return `${line}；\n`;
  }).join('');

  const unlinked = persons.filter(p => p.id !== indexId && !titles.has(p.id)).length;
  return { text, unlinked };
};
