/* 自由擴充區裡「不是人」的獨立個體：三角（懷孕／流產／死產）與寵物。
 * 它們拖到人物身上時產生的是註記連線（細紫線），不是婚姻線；也不吃
 * 死亡、身障這類人物標記。 */

import { R } from './helpers';

export const STANDALONE_TYPES = ['pregnancy', 'miscarriage', 'stillbirth', 'pet'];

/** 跟人物節點（正方形／圓形）一樣大，畫布上才不會顯得特別小。 */
export const standaloneRadius = () => R;

/** 寵物用菱形：上下左右四個頂點離中心都是 r。 */
export const diamondPath = (r) => `M 0,${-r} L ${r},0 L 0,${r} L ${-r},0 Z`;

/** 從中心往某個角度走到菱形邊緣的距離（連線才會剛好停在邊上）。 */
export const diamondEdge = (r, ang) => r / (Math.abs(Math.cos(ang)) + Math.abs(Math.sin(ang)));

/* 「不是配偶」的連線：生態圖的圓、三角與寵物的註記線，以及「畫線」工具
 * 隨手拉的線。它們沒有婚姻狀態、不帶子代，家系排版、親屬稱謂與個案紀錄
 * 都要略過。 */
export const PLAIN_LINK_TYPES = ['eco', 'annotation', 'line'];
export const isPlainLink = (l) => PLAIN_LINK_TYPES.includes(l?.type);

/* 這類連線的線型，沿用生態圖的慣例：粗實線＝強而正向、虛線＝薄弱、
 * 鋸齒（壓力）＝緊張衝突。沒填的舊資料一律當實線。 */
export const LINK_STYLES = ['solid', 'strong', 'dashed', 'zigzag'];
export const LINK_STYLE_LABELS = { solid: '實線', strong: '粗線', dashed: '虛線', zigzag: '鋸齒' };
export const LINK_STYLE_HINTS = {
  solid: '一般連結',
  strong: '粗線：強而正向的關係',
  dashed: '虛線：薄弱或不穩定的關係',
  zigzag: '鋸齒：壓力、衝突的關係',
};
export const linkStyleOf = (l) => (LINK_STYLES.includes(l?.lineStyle) ? l.lineStyle : 'solid');

/* 一條連線用的畫法：SVG 的 line 或 polyline 屬性，畫的人只管套用。 */
export const linkStrokeSpec = (style, baseWidth) => ({
  strokeWidth: style === 'strong' ? baseWidth * 2.2 : baseWidth,
  strokeDasharray: style === 'dashed' ? '9,6' : undefined,
});
