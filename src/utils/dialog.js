/* ===========================================================================
 * 自製的確認／提示視窗
 *
 * 取代瀏覽器內建的 window.confirm／window.alert：那兩個的外觀由瀏覽器決定，
 * 會頂著「xxx.github.io 顯示」的標題、按鈕樣式跟網站完全不搭，而且會卡住
 * 整個頁面。
 *
 * 用法跟原本幾乎一樣，只是改成 await：
 *   if (!(await confirmDialog({ message: '確定刪除？', danger: true }))) return;
 *   await alertDialog({ message: '匯入成功！' });
 *
 * 畫面由 <DialogHost />（掛在 App 最外層）負責；這裡只是一個很小的佇列，
 * 不用 React Context，任何元件或一般函式都能直接呼叫。
 * =========================================================================== */

let current = null;          // { opts, resolve }
const listeners = new Set();
const emit = () => listeners.forEach(fn => fn(current));

export const subscribeDialog = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const open = (opts) => new Promise(resolve => {
  // 同一時間只會有一個；前一個還開著就當作取消，避免疊出兩層
  if (current) current.resolve(false);
  current = { opts, resolve };
  emit();
});

/** 回傳使用者的選擇：確定 → true，取消／Esc／點外面 → false。 */
export const confirmDialog = ({ title, message, confirmText = '確定', cancelText = '取消', danger = false } = {}) =>
  open({ kind: 'confirm', title, message, confirmText, cancelText, danger });

/** 只有一顆「知道了」的提示。 */
export const alertDialog = ({ title, message, confirmText = '知道了' } = {}) =>
  open({ kind: 'alert', title, message, confirmText });

export const closeDialog = (answer) => {
  if (!current) return;
  const { resolve } = current;
  current = null;
  emit();
  resolve(answer);
};
