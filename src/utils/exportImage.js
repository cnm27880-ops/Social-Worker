/* ===========================================================================
 * 家系圖的下載與列印
 *
 * 從 GenogramTab.jsx 拆出來：這一段只需要「目前的 <svg> 元素」與「畫面上
 * 有哪些東西」，跟畫布的互動狀態無關。拆開之後裁切範圍的計算可以單獨寫
 * 測試，畫布那邊也少掉一百多行。
 * =========================================================================== */

import { R } from './helpers';
import { bgImageBox } from './bgImage';
import { stampOriginMeta } from './imageMeta';
import { textBoxSize } from './textBox';

/* 下載圖片的取樣倍率。列印與貼進 Word 都吃得下 3 倍圖，而這個數字也會
 * 寫進圖檔的來源印子裡（見 utils/imageMeta.js），下次匯入修補時才對得回來。 */
export const EXPORT_SCALE = 3;

/* 只服務編輯畫面、不該出現在成品裡的圖層（底圖定位框、橡皮擦游標圈、
 * 標籤的綁定虛線…）。下載與列印都是複製整棵 <svg>，所以複製完要先把這些拿掉。 */
export const NO_EXPORT = 'no-export';
export const stripEditorOnly = (svgEl) => {
  svgEl.querySelectorAll(`.${NO_EXPORT}`).forEach(el => el.remove());
  return svgEl;
};

export const ecoRx = (text) => Math.max(35, (text?.length || 1) * 9 + 15);
export const ECO_RY = 28;

/**
 * 算出目前畫面上所有內容的最小外框（含留白），下載圖片／列印共用。
 * nodePts 是所有主家系節點的中心座標；texts 要傳「已經算好吸附位置」的版本。
 * 什麼都沒有時回傳 null。
 */
export const computeCropBox = ({ nodePts = [], freeNodes = [], texts = [], polygons = [], cohabitationBox = null, bgImage = null }) => {
  const PAD = 40, allXs = [], allYs = [];
  nodePts.forEach(p => { allXs.push(p.x - R, p.x + R); allYs.push(p.y - R, p.y + R); });
  freeNodes.forEach(fn => {
    if (fn.type === 'eco') {
      const rx = ecoRx(fn.text);
      allXs.push(fn.x - rx, fn.x + rx); allYs.push(fn.y - ECO_RY, fn.y + ECO_RY);
    } else {
      allXs.push(fn.x - R, fn.x + R); allYs.push(fn.y - R, fn.y + R);
    }
  });
  texts.forEach(t => {
    const { left, top, w, h } = textBoxSize(t);
    allXs.push(t.x + left - 4, t.x + left + w + 4);
    allYs.push(t.y + top - 4, t.y + top + h + 4);
  });
  polygons.forEach(pg => pg.pts.forEach(pt => { allXs.push(pt.x); allYs.push(pt.y); }));
  if (cohabitationBox && cohabitationBox.type === 'single') { allXs.push(cohabitationBox.x, cohabitationBox.x + cohabitationBox.w); allYs.push(cohabitationBox.y, cohabitationBox.y + cohabitationBox.h); }
  else if (cohabitationBox && cohabitationBox.type === 'poly') { cohabitationBox.points.forEach(pt => { allXs.push(pt.x); allYs.push(pt.y); }); }

  // 底圖也要進裁切範圍，否則下載/列印會把修補好的舊圖切掉
  const bgBox = bgImageBox(bgImage);
  if (allXs.length === 0 && !bgBox) return null;

  /* 只有「畫上去的東西」需要外加白邊；底圖不用 —— 一張圖的邊界本來就是
     它自己的留白。對底圖再墊一次 40px 的話，「下載 → 匯入修補 → 再下載」
     每繞一圈就會多長出一圈白邊，來回幾趟整張圖會越縮越小。 */
  const span = (vals, lo, hi) => {
    const drawn = vals.length > 0;
    return {
      min: Math.min(drawn ? Math.min(...vals) - PAD : Infinity, lo ?? Infinity),
      max: Math.max(drawn ? Math.max(...vals) + PAD : -Infinity, hi ?? -Infinity),
    };
  };
  const sx = span(allXs, bgBox?.x, bgBox && bgBox.x + bgBox.w);
  const sy = span(allYs, bgBox?.y, bgBox && bgBox.y + bgBox.h);
  return { minX: sx.min, minY: sy.min, w: sx.max - sx.min, h: sy.max - sy.min };
};

/** 檔名裡 Windows 不允許的字元換成底線；未儲存的草稿就叫 genogram。 */
export const exportBaseName = (caseName) => (caseName || 'genogram').replace(/[\\/:*?"<>|]/g, '_');

/** 把畫布裁切後轉成點陣圖並下載。transparent=true 時不補白底（PNG 去背用）。 */
export const rasterizeAndDownload = (svgEl, box, { transparent, format, filename }) => {
  const cloned = stripEditorOnly(svgEl.cloneNode(true));
  cloned.setAttribute('width', box.w); cloned.setAttribute('height', box.h);
  cloned.setAttribute('viewBox', `${box.minX} ${box.minY} ${box.w} ${box.h}`);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(cloned)], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas'); canvas.width = box.w * EXPORT_SCALE; canvas.height = box.h * EXPORT_SCALE;
    const ctx = canvas.getContext('2d'); ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
    if (!transparent) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, box.w, box.h); }
    ctx.drawImage(img, 0, 0, box.w, box.h);
    URL.revokeObjectURL(url);
    /* 把裁切框寫進圖檔本身：這張圖之後再匯入「舊圖修補」時，就能一比一
       放回原本的位置與大小，而不是變成三倍大又貼在左上角。 */
    canvas.toBlob(async blob => {
      const stamped = await stampOriginMeta(blob, format, {
        v: 1,
        x: Math.round(box.minX), y: Math.round(box.minY),
        w: Math.round(box.w), h: Math.round(box.h),
        s: EXPORT_SCALE,
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(stamped); a.download = filename; a.click();
      URL.revokeObjectURL(a.href);
    }, format, 1.0);
  };
  img.src = url;
};

/* 列印/存成 PDF：借瀏覽器內建的列印功能，不額外引入 PDF 產生套件。
 * 做法是暫時在 <body> 底下插入一份只含裁切後 SVG 的列印專用容器，
 * 搭配 @media print 把畫面其他部分藏起來，列印對話框關閉後就移除，
 * 完全不影響使用者正在編輯的畫面。 */
export const printA4 = (svgEl, box, title) => {
  const cloned = stripEditorOnly(svgEl.cloneNode(true));
  cloned.removeAttribute('width'); cloned.removeAttribute('height');
  cloned.setAttribute('viewBox', `${box.minX} ${box.minY} ${box.w} ${box.h}`);
  cloned.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const container = document.createElement('div');
  container.id = 'print-a4-container';

  const style = document.createElement('style');
  style.textContent = `@page { size: A4 ${box.w >= box.h ? 'landscape' : 'portrait'}; margin: 10mm; }`;

  const header = document.createElement('div');
  header.className = 'print-a4-header';
  header.textContent = `${title || '家系圖'}．列印於 ${new Date().toLocaleDateString('zh-TW')}`;

  container.append(style, header, cloned);
  document.body.appendChild(container);

  const cleanup = () => { container.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
};
