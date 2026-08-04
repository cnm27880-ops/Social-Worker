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
 * 2. 台灣實務並沒有統一的家系圖符號標準；多份台灣來源一致指出符號標示
 *    「有許多不同的標示法」，慣例是「至少自己單位的標示法應統一」。
 *    因此本檔案以辨識度優先，位置仍遵循 McGoldrick 標準（左＝精神、
 *    右＝生理、下＝成癮），畫法則自行選擇最清楚的呈現方式。
 *
 * 3. 臨床標記的畫法：半邊實色填色（淡紫）＋只在「填色與留白的交界」畫線，
 *    且同一個符號內一律同色 —— 意義完全由位置承載，顏色只表示「這裡有
 *    標記」，一個人身上有多個標記時才不會變成花的。
 *
 *    描邊只畫交界、不畫兩塊填色之間的內部線，是為了避免「左半＋下半」
 *    這種組合在正中央被畫出一個十字：兩塊填色本來就相連，中間不該有
 *    分隔線，只有跟留白（右上那塊）交界的地方才需要線。實作見
 *    divisionSegments()。
 *
 *    顏色選淡紫而非深色，是為了和既有的「身心障礙」左半深色實心、以及
 *    案主的深色實心區隔；灰階列印時它會變成淺灰，與那兩者仍可分辨。
 *
 * 4. 2026-08 第二次修訂：面板上的互動介面收斂成「快捷列表」，只留 7 個
 *    最常用的標記（deceased／disabled／chronicIllness／pregnancy／
 *    closeRelationship／conflict／deteriorating，見 QUICK_KEYS）。
 *    其餘符號（收養／寄養／精神疾病等舊版分類）保留定義只是為了讓舊案件
 *    裡已經標記過的內容能正常畫出來，不再有 UI 入口可以新增。
 *    chronicIllness（四分之一填色）與 deteriorating（斜線刻痕）在
 *    McGoldrick／GenoPro 等來源中都找不到對應的標準畫法，是本工具自訂的
 *    簡化符號，在各自的 note 欄位裡如實註明；closeRelationship（雙線）
 *    則是 McGoldrick 標準裡本來就有、只是先前沒收進工具箱的畫法。
 * =========================================================================== */

export const CATEGORIES = [
  { key: 'common', label: '快捷列表' },
  { key: 'health', label: '健康狀況（舊版，僅供對照）' },
  { key: 'kinship', label: '親子關係（舊版，僅供對照）' },
  { key: 'perinatal', label: '妊娠與失落（舊版，僅供對照）' },
  { key: 'relLine', label: '關係品質（舊版，僅供對照）' },
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

/**
 * 左上四分之一的裁切路徑（慢性病專用；目前只需要這一個角）。
 * 圓形那條弧線刻意跟 halfPath 的 'left' 分支用同一個 sweep-flag（0），
 * 因為它其實就是那條左半圓弧的前半段——保證掃過的是左上方而不是左下方。
 */
export const quarterPath = (gender, r) => {
  if (gender === 'M') return `M ${-r},${-r} L 0,${-r} L 0,0 L ${-r},0 Z`;
  return `M 0,0 L 0,${-r} A ${r},${r} 0 0,0 ${-r},0 Z`;
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
    quickTool: true,
    desc: '在符號上畫對角叉。',
    note: '兩份來源一致。',
  },
  {
    key: 'disabled',
    label: '身心障礙',
    category: 'common',
    kind: 'nodeAttr',
    quickTool: true,
    desc: '左半實心填滿。',
    note: '本工具沿用的既有畫法。McGoldrick 標準中左半代表精神疾病，'
        + '兩者不同，判讀時請以本工具的圖例為準。',
  },
  {
    key: 'chronicIllness',
    label: '慢性病',
    category: 'common',
    kind: 'nodeAttr',
    quarter: 'top-left',
    quickTool: true,
    desc: '左上四分之一填色。',
    note: '本工具自訂的簡化畫法，McGoldrick／GenoPro 等來源都沒有這個符號。'
        + '跟「身心障礙」的半邊實心同色（深色），不用精神疾病／生理疾病／'
        + '藥酒癮那套淡紫色系，以免混淆；改用四分之一區塊表示「慢性、'
        + '非急性」的健康狀況，位置本身不承載病因意義。',
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

  /* ===========================================================================
   * 獨立個體：懷孕／流產／死產
   *
   * kind:'standalone' — 拖到空白畫布放開會生成一個新的自由節點；拖到
   * 既有的人物節點上放開則不做任何事（這類符號本身就是獨立個體，不是
   * 貼在別人身上的標記）。生成後可再用既有的「拖曳碰撞連線」把它接到
   * 任何人身上（同一套機制，用於 男性／女性／生態圖 自由個體）。
   *
   * 三者都用三角形家族的形狀，不用性別方塊／圓形：
   *   - 兩份來源都用三角形代表懷孕／流產／人工流產，只是流產多畫一條
   *     對角線（GenoPro：「miscarriage...diagonal cross...drawn on top
   *     of the triangle」）。
   *   - 死產的畫法兩份來源不一致：一份說是「跟性別符號一樣，但是縮小」，
   *     另一份說是「跟性別符號一樣大，對角線大小不變」——但兩份都沒有
   *     指明死產性別未知時該用什麼形狀。為了不引入「拖曳時還要選性別」
   *     的額外互動，也為了三個符號在視覺上仍是同一個家族、容易理解，
   *     這裡讓死產沿用三角形，但畫成跟人物節點一樣大（半徑 R），對角線
   *     粗細與流產一致——取「大小區分懷孕/流產 vs 死產、對角線區分
   *     活產/死產」兩份來源的交集，缺口在說明書的圖例中如實註明。
   * =========================================================================== */
  {
    key: 'pregnancy',
    label: '懷孕',
    category: 'common',
    kind: 'standalone',
    shape: 'triangle',
    quickTool: true,
    desc: '拖到空白畫布放開即新增一個三角形節點。',
    note: '兩份來源一致：三角形代表懷孕。',
  },
  {
    key: 'miscarriage',
    label: '流產／人工流產',
    category: 'perinatal',
    kind: 'standalone',
    shape: 'triangle',
    cross: true,
    desc: '拖到空白畫布放開即新增一個帶對角線的小三角形節點。',
    note: '兩份來源一致：三角形加一條對角線代表流產或人工流產，'
        + '兩者本工具不另外區分，可用文字方塊補充說明。',
  },
  {
    key: 'stillbirth',
    label: '死產',
    category: 'perinatal',
    kind: 'standalone',
    shape: 'triangle',
    cross: true,
    full: true,
    desc: '拖到空白畫布放開即新增一個放大的帶對角線三角形節點。',
    note: '兩份來源畫法不一致，且都沒說明性別未知時的畫法。本工具取'
        + '兩者交集：沿用三角形（不強迫選性別），但放大到跟人物節點'
        + '一樣大以區別於流產。',
  },

  /* ===========================================================================
   * 關係品質：正向親密／衝突／關係惡化（快捷列表）＋疏離／斷絕／暴力（舊版）
   *
   * kind:'relLine' — 拖到一條婚姻線（案主父母、案主與配偶，或擴充關係
   * 的配偶線）上放開，會在那條線上疊加對應的關係線樣式；再拖一次同一個
   * 符號到同一條線上是取消。同一條線只會有一種關係品質（不疊加），拖
   * 別的符號上去是直接取代。
   * =========================================================================== */
  {
    key: 'closeRelationship',
    label: '正向親密',
    category: 'common',
    kind: 'relLine',
    lineStyle: 'double',
    quickTool: true,
    desc: '婚姻線改為雙線。',
    note: 'McGoldrick 標準畫法：雙線代表關係緊密、良好。',
  },
  {
    key: 'conflict',
    label: '衝突',
    category: 'common',
    kind: 'relLine',
    lineStyle: 'zigzag',
    quickTool: true,
    desc: '婚姻線改為鋸齒線。',
    note: 'McGoldrick 標準畫法：鋸齒線代表關係中有衝突、爭執。',
  },
  {
    key: 'deteriorating',
    label: '關係惡化',
    category: 'common',
    kind: 'relLine',
    lineStyle: 'hatch',
    quickTool: true,
    desc: '婚姻線上加一排斜線刻痕。',
    note: '本工具自訂的簡化畫法，McGoldrick／GenoPro 等來源都沒有這個符號。'
        + '跟既有的疏離（虛線）／斷絕（缺口）／暴力（紅色鋸齒線）這幾種'
        + '既定狀態不同，這個符號標記的是「正在惡化」的變化趨勢。',
  },

  {
    key: 'distant',
    label: '疏離',
    category: 'relLine',
    kind: 'relLine',
    lineStyle: 'dashed',
    desc: '婚姻線改為虛線。',
    note: '兩份來源一致：虛線代表關係疏遠、溝通有限。',
  },
  {
    key: 'cutoff',
    label: '斷絕',
    category: 'relLine',
    kind: 'relLine',
    lineStyle: 'gap',
    desc: '婚姻線中間斷開一段缺口。',
    note: 'McGoldrick 標準畫法：線段中間留白代表關係斷絕、無往來。',
  },
  {
    key: 'violence',
    label: '暴力',
    category: 'relLine',
    kind: 'relLine',
    lineStyle: 'zigzagRed',
    desc: '婚姻線改為紅色鋸齒線。',
    note: '本工具在標準鋸齒線的基礎上改用紅色加粗，'
        + '和「衝突」的一般鋸齒線做出區分，方便在列印或螢幕上快速辨識。',
  },
];

export const SYMBOL_MAP = Object.fromEntries(SYMBOLS.map(s => [s.key, s]));

/**
 * 快捷列表：面板上唯一互動入口，固定 7 個、固定順序（拖曳與 Q/W/R 鍵盤
 * 選取都依這個順序）。用明確陣列而不是從 SYMBOLS 篩選 quickTool 再排序，
 * 是為了讓順序跟 quickTool 標記脫鉤——之後想調整顯示順序，改這裡就好，
 * 不用去動每個符號定義裡的旗標。
 *
 * 其餘符號（收養、精神疾病、疏離…）不在這裡，畫布靠 SYMBOL_MAP 畫出
 * 舊案件裡已經標記過的內容，但面板上沒有入口可以新增。
 */
export const QUICK_KEYS = [
  'deceased', 'disabled', 'chronicIllness', 'pregnancy',
  'closeRelationship', 'conflict', 'deteriorating',
];
export const QUICK_SYMBOLS = QUICK_KEYS.map(k => SYMBOL_MAP[k]);

/** 會畫在親子連線上的標記（拖到子代節點，但線變樣式）。只在本檔案內使用。 */
const KINSHIP_KEYS = SYMBOLS.filter(s => s.kind === 'kinship').map(s => s.key);

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

/**
 * 算出要畫哪些分界線段。
 *
 * 作法：把符號切成四個象限（左上／右上／左下／右下），判斷各象限是否
 * 被填色，只在「相鄰兩象限一填一空」的地方畫線 —— 兩塊都填色的交界
 * 不畫，避免「左半＋下半」在正中央被畫出一個十字：
 *
 *   只有左半      → 中央整條垂直線（左右各半，一填一空）
 *   只有下半      → 中央整條水平線
 *   左半＋下半    → 上半垂直段 ＋ 右半水平段，合起來是 L 形，框住右上留白
 *   左半＋右半    → 全填滿，沒有留白，不畫任何線
 *
 * 方形（半邊長 r）與圓形（半徑 r）共用同一組座標，因為分界線都是從
 * 中心點延伸到符號邊緣，端點座標在兩者都是 ±r。
 *
 * 回傳 [[x1, y1, x2, y2], …]。
 */
export const divisionSegments = (halves, r) => {
  const has = (h) => halves.includes(h);
  const filled = {
    tl: has('left'),
    tr: has('right'),
    bl: has('left') || has('bottom'),
    br: has('right') || has('bottom'),
  };

  const segs = [];
  if (filled.tl !== filled.tr) segs.push([0, -r, 0, 0]);  // 垂直線．上半段
  if (filled.bl !== filled.br) segs.push([0, 0, 0, r]);   // 垂直線．下半段
  if (filled.tl !== filled.bl) segs.push([-r, 0, 0, 0]);  // 水平線．左半段
  if (filled.tr !== filled.br) segs.push([0, 0, r, 0]);   // 水平線．右半段
  return segs;
};

/* ===========================================================================
 * 獨立個體（懷孕／流產／死產）的三角形幾何
 * =========================================================================== */

/** 三角形三個頂點，尖端朝上，r 為中心到頂點的距離。 */
export const triangleVertices = (r) => [
  [0, -r],
  [-r * 0.95, r * 0.75],
  [r * 0.95, r * 0.75],
];

export const trianglePath = (r) => {
  const [[x0, y0], [x1, y1], [x2, y2]] = triangleVertices(r);
  return `M ${x0},${y0} L ${x1},${y1} L ${x2},${y2} Z`;
};

/** 流產／死產的對角叉，畫在三角形的外框範圍內，跟死亡符號的 X 同一個畫法。 */
export const triangleCrossLines = (r) => {
  const halfW = r * 0.95, topY = -r, botY = r * 0.75;
  return [
    [-halfW, topY, halfW, botY],
    [halfW, topY, -halfW, botY],
  ];
};

/* ===========================================================================
 * 關係品質線（疏離／衝突／斷絕／暴力）的幾何
 *
 * 三者都是「以兩人現有的婚姻線為基準，疊加一個樣式」，不取代原本的線
 * （離婚斜線、分居符號等仍照舊畫），只是額外疊上去的裝飾。
 * =========================================================================== */

/** 疏離：長虛線的 dasharray。 */
export const DISTANT_DASH = '9,6';

/**
 * 鋸齒線（衝突／暴力共用幾何）。
 * 回傳可直接放進 <polyline points="..."> 的字串。
 */
export const zigzagPoints = (x1, y1, x2, y2, amplitude = 5, segments = 8) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len; // 垂直於基準線的單位向量
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const bx = x1 + dx * t, by = y1 + dy * t;
    const off = (i === 0 || i === segments) ? 0 : (i % 2 === 1 ? amplitude : -amplitude);
    pts.push(`${bx + nx * off},${by + ny * off}`);
  }
  return pts.join(' ');
};

/**
 * 斷絕：線段中間留一段缺口。回傳兩段線的端點座標。
 * 回傳 [[x1,y1,x2,y2], [x1,y1,x2,y2]]。
 */
export const gapSegments = (x1, y1, x2, y2, gapRatio = 0.24) => {
  const dx = x2 - x1, dy = y2 - y1;
  const midStart = 0.5 - gapRatio / 2, midEnd = 0.5 + gapRatio / 2;
  return [
    [x1, y1, x1 + dx * midStart, y1 + dy * midStart],
    [x1 + dx * midEnd, y1 + dy * midEnd, x2, y2],
  ];
};

/**
 * 正向親密：兩條平行線，往基準線兩側各偏移 offset。
 * 回傳 [[x1,y1,x2,y2], [x1,y1,x2,y2]]。
 */
export const doubleLineSegments = (x1, y1, x2, y2, offset = 2.6) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  return [
    [x1 + nx * offset, y1 + ny * offset, x2 + nx * offset, y2 + ny * offset],
    [x1 - nx * offset, y1 - ny * offset, x2 - nx * offset, y2 - ny * offset],
  ];
};

/**
 * 關係惡化：在基準線上等距排列的斜線刻痕，本身不含基準線——呼叫端
 * 要另外畫一條實線當底（見 GenogramTab 的 'deteriorating' 分支）。
 * 每一刻痕跟基準線夾 45°，長度 tickLen，回傳 [[x1,y1,x2,y2], …]。
 */
export const hatchSegments = (x1, y1, x2, y2, count = 5, tickLen = 7) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const tx = dx / len, ty = dy / len;   // 沿線方向
  const nx = -ty, ny = tx;              // 垂直方向
  const half = tickLen / 2 / Math.SQRT2; // (tx+nx, ty+ny) 長度固定是 √2，先歸一化
  const segs = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const cx = x1 + dx * t, cy = y1 + dy * t;
    const hx = (tx + nx) * half, hy = (ty + ny) * half;
    segs.push([cx - hx, cy - hy, cx + hx, cy + hy]);
  }
  return segs;
};

/** 點到線段的最短距離，供拖曳關係線符號時判斷是否命中某條婚姻線。 */
export const distToSegment = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + dx * t, cy = y1 + dy * t;
  return Math.hypot(px - cx, py - cy);
};
