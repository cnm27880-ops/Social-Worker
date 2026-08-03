/* ===========================================================================
 * 家系圖符號表
 *
 * 畫法依據（2026-08 查證）：
 *   - GenoPro 標準符號說明  https://genopro.com/genogram/symbols/
 *   - 英國 Oxfordshire Safeguarding Children Board 採用的同一套說明
 *     https://www.oscb.org.uk/wp-content/uploads/2019/08/genogram-detail.pdf
 *   - McGoldrick, Gerson & Petry《Genograms: Assessment and Intervention》
 *     所建立、目前教科書通用的標準符號集（1985 年首版）
 *
 * 需要知道的兩件事：
 *
 * 1. 各家畫法有差異。GenoPro 的說明就明講「there are some variations from
 *    one author to another」。這裡採用兩份以上來源一致的畫法，有分歧的
 *    在該符號的 note 欄位註明。
 *
 * 2. 臨床標記的畫法：半邊實色填色 ＋ 分界描邊，且同一個符號內一律同色。
 *
 *    位置遵循標準（左＝精神、右＝生理、下＝成癮），「意義」完全由位置承載，
 *    顏色只表示「這裡有標記」—— 所以不需要、也刻意不用顏色區分病因，
 *    同一個人身上有多個標記時才不會變成花的。
 *
 *    分界描邊是必要的：沒有它，左半＋下半（剩右上四分之一）會看起來像整格
 *    填滿，四分之一的空白分不出來。描邊讓每一塊的邊界明確。
 *
 *    顏色選淡紫而非深色，是為了和既有的「身障」左半深色實心、以及案主的
 *    深色實心區隔；灰階列印時它會變成淺灰，與那兩者仍可分辨。
 * =========================================================================== */

export const CATEGORIES = [
  { key: 'common', label: '常用' },
  { key: 'health', label: '健康狀況' },
  { key: 'kinship', label: '親子關係' },
];

/** 臨床標記的填色。所有標記同色，病因靠位置區分。 */
export const CLINICAL_FILL = '#c4b5fd';

/** 分界描邊的顏色與粗細。 */
export const CLINICAL_STROKE = '#334155';
export const CLINICAL_STROKE_W = 2;

/**
 * 把「半邊」轉成裁切路徑。
 * side: 'left' | 'right' | 'bottom'，r 為半徑（方形則是半邊長）。
 */
export const halfPath = (gender, side, r) => {
  if (gender === 'M') {
    if (side === 'left')   return `M ${-r},${-r} L 0,${-r} L 0,${r} L ${-r},${r} Z`;
    if (side === 'right')  return `M 0,${-r} L ${r},${-r} L ${r},${r} L 0,${r} Z`;
    return `M ${-r},0 L ${r},0 L ${r},${r} L ${-r},${r} Z`;              // bottom
  }
  if (side === 'left')   return `M 0,${-r} A ${r},${r} 0 0,0 0,${r} Z`;
  if (side === 'right')  return `M 0,${-r} A ${r},${r} 0 0,1 0,${r} Z`;
  return `M ${-r},0 A ${r},${r} 0 0,0 ${r},0 Z`;                          // bottom
};

/* ===========================================================================
 * 符號定義
 *
 * kind: 'nodeAttr'  → 拖到人物節點上貼附
 *       'kinship'   → 也是貼在子代節點上，但畫在該子代的親子連線上
 * =========================================================================== */

export const SYMBOLS = [
  {
    key: 'deceased',
    label: '死亡',
    category: 'common',
    kind: 'nodeAttr',
    shortcut: 'R',
    desc: '在符號上畫對角叉。',
    note: '兩份來源一致。',
  },
  {
    key: 'disabled',
    label: '身心障礙',
    category: 'common',
    kind: 'nodeAttr',
    shortcut: 'W',
    desc: '左半實心填滿。',
    note: '本工具沿用的既有畫法。McGoldrick 標準中左半代表精神疾病，'
        + '兩者不同，判讀時請以本工具的圖例為準。',
  },

  {
    key: 'mentalIllness',
    label: '精神疾病',
    category: 'health',
    kind: 'nodeAttr',
    half: 'left',
    desc: '左半填色。',
    note: 'McGoldrick 標準以左半代表精神／情緒疾病。'
        + '本工具用淡紫填色，以免與既有的「身心障礙」左半深色實心混淆。',
  },
  {
    key: 'physicalIllness',
    label: '生理疾病',
    category: 'health',
    kind: 'nodeAttr',
    half: 'right',
    desc: '右半填色。',
    note: 'McGoldrick 標準以右半代表生理疾病。',
  },
  {
    key: 'substanceUse',
    label: '藥酒癮',
    category: 'health',
    kind: 'nodeAttr',
    half: 'bottom',
    desc: '下半填色。',
    note: 'McGoldrick 標準以下半代表酒精或藥物成癮。'
        + '同時有精神疾病與成癮時，左半與下半會同時填色，右上角留白；'
        + '分界描邊讓那塊留白清楚可辨。',
  },

  {
    key: 'adopted',
    label: '收養',
    category: 'kinship',
    kind: 'kinship',
    // 親子線實際只有 22px 左右，間距太大會看起來像實線
    dash: '5,3',
    desc: '該子女與父母之間的親子線改為長虛線。',
    note: '兩份來源一致：親生為實線、收養為虛線、寄養為點線。',
  },
  {
    key: 'foster',
    label: '寄養',
    category: 'kinship',
    kind: 'kinship',
    dash: '1.5,2.5',
    desc: '該子女與父母之間的親子線改為點線。',
    note: '兩份來源一致。',
  },
];

export const SYMBOL_MAP = Object.fromEntries(SYMBOLS.map(s => [s.key, s]));

/** 會畫在親子連線上的標記（拖到子代節點，但線變樣式） */
export const KINSHIP_KEYS = SYMBOLS.filter(s => s.kind === 'kinship').map(s => s.key);

/** 從一個節點的標記陣列中找出要套用的親子線樣式 */
export const kinshipDashFor = (attrs) => {
  if (!attrs) return undefined;
  for (const key of KINSHIP_KEYS) {
    if (attrs.includes(key)) return SYMBOL_MAP[key].dash;
  }
  return undefined;
};

/** 節點上要填色的半邊（可同時多個，例如精神疾病＋藥酒癮） */
export const healthHalvesFor = (attrs) =>
  (attrs || [])
    .map(k => SYMBOL_MAP[k])
    .filter(s => s && s.half)
    .map(s => s.half);
