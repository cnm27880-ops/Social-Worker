/* ===========================================================================
 * 家系圖符號表（精簡版 - 快捷列表 6 個狀態／關係標記 + 自由擴充區 1 個獨立節點）
 * =========================================================================== */

export const CATEGORIES = [
  { key: 'common', label: '快捷列表' },
  { key: 'free', label: '自由擴充區' },
];

/** 臨床標記的填色與描邊設定 */
export const CLINICAL_FILL = '#c4b5fd';
export const CLINICAL_STROKE = '#334155';
export const CLINICAL_STROKE_W = 2;

/**
 * 把「半邊」轉成裁切路徑。
 */
export const halfPath = (gender, side, r) => {
  if (gender === 'M') {
    if (side === 'left')   return `M ${-r},${-r} L 0,${-r} L 0,${r} L ${-r},${r} Z`;
    if (side === 'right')  return `M 0,${-r} L ${r},${-r} L ${r},${r} L 0,${r} Z`;
    return `M ${-r},0 L ${r},0 L ${r},${r} L ${-r},${r} Z`;
  }
  if (side === 'left')   return `M 0,${-r} A ${r},${r} 0 0,0 0,${r} Z`;
  if (side === 'right')  return `M 0,${-r} A ${r},${r} 0 0,1 0,${r} Z`;
  return `M ${-r},0 A ${r},${r} 0 0,0 ${r},0 Z`;
};

/**
 * 左上四分之一的裁切路徑（慢性病專用）
 */
export const quarterPath = (gender, r) => {
  if (gender === 'M') return `M ${-r},${-r} L 0,${-r} L 0,0 L ${-r},0 Z`;
  return `M 0,0 L 0,${-r} A ${r},${r} 0 0,0 ${-r},0 Z`;
};

/* ===========================================================================
 * 符號定義
 * - 快捷列表（category: 'common'）：6 個狀態／關係標記，套用在已存在的人物節點
 *   或婚姻線上，點一下套用、再點一下（或套到同樣的標記）即取消。
 * - 自由擴充區（category: 'free'）：獨立節點，點按鈕即在畫布上新增一個全新個體。
 * desc 只用在說明書「符號對照」表，不再驅動快捷列表按鈕上的懸浮提示框。
 * =========================================================================== */

export const SYMBOLS = [
  {
    key: 'deceased',
    label: '死亡',
    category: 'common',
    kind: 'nodeAttr',
    quickTool: true,
    desc: '在符號上畫對角叉。',
  },
  {
    key: 'disabled',
    label: '身心障礙',
    category: 'common',
    kind: 'nodeAttr',
    quickTool: true,
    desc: '左半實心填滿。',
  },
  {
    key: 'chronicIllness',
    label: '慢性病',
    category: 'common',
    kind: 'nodeAttr',
    quarter: 'top-left',
    quickTool: true,
    desc: '左上四分之一填色。',
  },
  {
    key: 'pregnancy',
    label: '三角',
    category: 'free',
    kind: 'standalone',
    shape: 'triangle',
    desc: '點選按鈕即在畫布上新增一個獨立三角形節點。',
  },
  {
    key: 'closeRelationship',
    label: '正向親密',
    category: 'common',
    kind: 'relLine',
    lineStyle: 'double',
    quickTool: true,
    desc: '婚姻線改為雙線。',
  },
  {
    key: 'conflict',
    label: '衝突',
    category: 'common',
    kind: 'relLine',
    lineStyle: 'zigzag',
    quickTool: true,
    desc: '婚姻線改為鋸齒線。',
  },
  {
    key: 'deteriorating',
    label: '關係惡化',
    category: 'common',
    kind: 'relLine',
    lineStyle: 'hatch',
    quickTool: true,
    desc: '婚姻線上加一排斜線刻痕。',
  },
];

export const SYMBOL_MAP = Object.fromEntries(SYMBOLS.map(s => [s.key, s]));

export const QUICK_KEYS = [
  'deceased', 'disabled', 'chronicIllness',
  'closeRelationship', 'conflict', 'deteriorating',
];
export const QUICK_SYMBOLS = QUICK_KEYS.map(k => SYMBOL_MAP[k]);

const KINSHIP_KEYS = SYMBOLS.filter(s => s.kind === 'kinship').map(s => s.key);

export const kinshipDashFor = (attrs) => {
  if (!attrs) return undefined;
  for (const key of KINSHIP_KEYS) {
    if (attrs.includes(key)) return SYMBOL_MAP[key].dash;
  }
  return undefined;
};

export const healthHalvesFor = (attrs) =>
  (attrs || [])
    .map(k => SYMBOL_MAP[k])
    .filter(s => s && s.half)
    .map(s => s.half);

export const divisionSegments = (halves, r) => {
  const has = (h) => halves.includes(h);
  const filled = {
    tl: has('left'),
    tr: has('right'),
    bl: has('left') || has('bottom'),
    br: has('right') || has('bottom'),
  };

  const segs = [];
  if (filled.tl !== filled.tr) segs.push([0, -r, 0, 0]);
  if (filled.bl !== filled.br) segs.push([0, 0, 0, r]);
  if (filled.tl !== filled.bl) segs.push([-r, 0, 0, 0]);
  if (filled.tr !== filled.br) segs.push([0, 0, r, 0]);
  return segs;
};

export const triangleVertices = (r) => [
  [0, -r],
  [-r * 0.95, r * 0.75],
  [r * 0.95, r * 0.75],
];

export const trianglePath = (r) => {
  const [[x0, y0], [x1, y1], [x2, y2]] = triangleVertices(r);
  return `M ${x0},${y0} L ${x1},${y1} L ${x2},${y2} Z`;
};

export const triangleCrossLines = (r) => {
  const halfW = r * 0.95, topY = -r, botY = r * 0.75;
  return [
    [-halfW, topY, halfW, botY],
    [halfW, topY, -halfW, botY],
  ];
};

export const DISTANT_DASH = '9,6';

export const zigzagPoints = (x1, y1, x2, y2, amplitude = 5, segments = 8) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const bx = x1 + dx * t, by = y1 + dy * t;
    const off = (i === 0 || i === segments) ? 0 : (i % 2 === 1 ? amplitude : -amplitude);
    pts.push(`${bx + nx * off},${by + ny * off}`);
  }
  return pts.join(' ');
};

export const gapSegments = (x1, y1, x2, y2, gapRatio = 0.24) => {
  const dx = x2 - x1, dy = y2 - y1;
  const midStart = 0.5 - gapRatio / 2, midEnd = 0.5 + gapRatio / 2;
  return [
    [x1, y1, x1 + dx * midStart, y1 + dy * midStart],
    [x1 + dx * midEnd, y1 + dy * midEnd, x2, y2],
  ];
};

export const doubleLineSegments = (x1, y1, x2, y2, offset = 2.6) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  return [
    [x1 + nx * offset, y1 + ny * offset, x2 + nx * offset, y2 + ny * offset],
    [x1 - nx * offset, y1 - ny * offset, x2 - nx * offset, y2 - ny * offset],
  ];
};

export const hatchSegments = (x1, y1, x2, y2, count = 5, tickLen = 7) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const tx = dx / len, ty = dy / len;
  const nx = -ty, ny = tx;
  const half = tickLen / 2 / Math.SQRT2;
  const segs = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const cx = x1 + dx * t, cy = y1 + dy * t;
    const hx = (tx + nx) * half, hy = (ty + ny) * half;
    segs.push([cx - hx, cy - hy, cx + hx, cy + hy]);
  }
  return segs;
};

export const distToSegment = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + dx * t, cy = y1 + dy * t;
  return Math.hypot(px - cx, py - cy);
};
