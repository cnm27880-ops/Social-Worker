/* 左側面板那排「狀態標籤」（已婚／離婚、橫式／直式…）共用的切換操作。
 * 從 GenogramTab.jsx 拆出來，擴充連線面板也要用同一套。 */

/** 滑鼠停在標籤上滾動滾輪：往下是下一個、往上是上一個，循環切換。 */
export const wheelRef = (el, list, current, setter) => {
  if (!el) return;
  el.onwheel = (e) => { e.preventDefault(); e.stopPropagation(); const next = (list.indexOf(current) + (e.deltaY > 0 ? 1 : -1) + list.length) % list.length; setter(list[next]); };
};

/** 點擊往前切到下一個狀態（跟滾輪往下同方向），滾輪仍可雙向切換。
 * 這批狀態標籤原本只能滾輪操作——滑鼠沒有滾輪（觸控板手勢因人而異）或
 * 不知道可以滾的人根本切不動，點擊是找得到的最低限度操作方式。 */
export const cycleOnClick = (list, current, setter) => (e) => {
  e.stopPropagation();
  const next = (list.indexOf(current) + 1) % list.length;
  setter(list[next]);
};
