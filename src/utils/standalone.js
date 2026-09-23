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
