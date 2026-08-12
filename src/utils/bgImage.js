/* ===========================================================================
 * 舊圖修補：把使用者上傳的圖片收成可以存進案件文件的底圖
 *
 * 為什麼要先縮圖再轉 dataURL：
 *   底圖必須跟著案件一起存進 localStorage、一起匯出成 .json，所以只能是
 *   dataURL（blob URL 重新整理就失效）。而 base64 會比原檔再大約 1.37 倍，
 *   手機拍的一張家系圖動輒 3–5MB，直接塞進去必定超過瀏覽器 5MB 左右的
 *   localStorage 配額 —— 案件會存不進去。掃描的家系圖是線稿，1600px 已經
 *   遠超過在畫布上描圖需要的解析度。
 *
 * 為什麼不對 dataURL 再做一次 gzip「背景壓縮、要用時解開」：
 *   JPEG/PNG 本身就是壓縮格式，位元組已經接近亂數，通用壓縮（gzip）在
 *   已壓縮的二進位資料上幾乎榨不出空間；而要把壓縮結果安全地塞進
 *   localStorage（透過 JSON.stringify），又得再轉回 base64 一次——
 *   兩次 base64 的膨脹（各 4/3 倍）反而會讓檔案比現在更大。這裡不是
 *   「懶得做」，是這條路線在資訊理論上就沒有空間可省。
 *
 *   真正有效、而且不需要額外「解壓縮」步驟的做法是換一個更有效率的
 *   編碼格式：WebP 在同樣的視覺品質下通常比 JPEG 再小 25–35%，
 *   還原生支援透明（PNG 才需要的功能）。因為 WebP dataURL 用起來
 *   跟 JPEG／PNG dataURL完全一樣（瀏覽器原生解碼，不需要我們自己拆包），
 *   所以不會像 gzip 方案那樣需要在「開啟案件」時多一段非同步解壓縮，
 *   也就不會有畫面卡住等解壓縮、或解壓縮失敗導致底圖開不了的風險。
 *   瀏覽器不支援 WebP 編碼時會安靜地退回 JPEG／PNG，行為不變。
 *
 * --- 底圖的座標模型（v2）---
 *   { src, w, h,            // w/h 是縮圖後的「原始像素」尺寸
 *     x, y, scale,          // 目前擺在畫布上的位置與倍率
 *     baseX, baseY, baseScale,  // 匯入當下算出來的擺法，供「重設」用
 *     opacity, fromApp, v }
 *
 *   擦除筆跡（doc.bgErase）存的是「圖片自身的像素座標」，不是畫布座標。
 *   這樣底圖被拖動或縮放時，擦掉的地方會跟著一起走 —— 存畫布座標的話，
 *   一移動底圖，擦痕就留在原地變成畫布上的破洞。
 * =========================================================================== */

import { readOriginMeta } from './imageMeta';

/** 底圖的資料格式版本；v1 沒有 x/y，擦除筆跡也還存在畫布座標。 */
export const BG_SCHEMA = 2;

/** 一般圖片縮圖後的最長邊上限。 */
export const MAX_EDGE = 1600;

/**
 * 認得出是本站下載的圖時放寬到 2400px。
 * 本站的 PNG 是 3 倍圖，一張 800 單位寬的家系圖會匯出成 2400px；
 * 硬壓回 1600px 會讓「下載後再匯入修補」這條路每繞一圈就糊一次。
 * 線稿的壓縮率很好，多出來的像素換算成 WebP 只多幾十 KB。
 */
export const MAX_EDGE_SELF = 2400;

/**
 * 沒有來源資訊時，自動把長邊縮到這個畫布單位數。
 * 人物符號是 36 單位、手足間距 100 單位，一張三代家系圖大約 600–900 單位寬，
 * 所以掃描檔套進來也該落在這個量級 —— 直接用原始像素當畫布單位（舊版行為）
 * 會讓一張 1600px 的掃描圖變成畫布上的 1600 單位，比自己畫的符號大三倍。
 */
export const FIT_EDGE = 900;

/** 底圖在畫布上的預設落點：稍微內縮，讓使用者看得出它是一張底圖而不是背景色。 */
export const BG_X = 40;
export const BG_Y = 40;

/** 「舊圖修補」的成品是那張舊圖本身，所以預設不打淡；要描圖再自己拉透明度。 */
export const DEFAULT_OPACITY = 1;

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 8;

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

/** WebP 品質；PNG 掃描線稿轉過來也用得到，WebP 原生支援透明。 */
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.85;

export const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/**
 * 把縮圖後的 canvas 編碼成 dataURL，優先用 WebP（同品質下通常比 JPEG
 * 再小 25–35%，且原生支援透明）。不支援 WebP 編碼的瀏覽器，
 * `toDataURL` 會安靜地退回 PNG，用回傳字串的 mime 判斷即可，
 * 不需要額外的 feature-detection。
 */
const encodeCanvas = (canvas, keepAlpha) => {
  const webp = canvas.toDataURL('image/webp', WEBP_QUALITY);
  if (webp.startsWith('data:image/webp')) return webp;
  return keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', JPEG_QUALITY);
};

/**
 * 決定新匯入的圖要擺在哪、放多大。
 *
 * origin 是從圖檔裡讀回來的裁切框（見 utils/imageMeta.js）—— 只有本站
 * 自己下載的 PNG／JPG 才有。有它就能一比一放回原本的位置與大小，
 * 「下載 → 之後再匯入修補」整條路才會對得起來。
 */
const placementFor = (origin, w, h) => {
  if (origin) return { x: origin.x, y: origin.y, scale: clampScale(origin.w / w) };
  // 不放大：小圖硬撐到 FIT_EDGE 只會糊掉，維持原尺寸反而好描
  return { x: BG_X, y: BG_Y, scale: clampScale(Math.min(1, FIT_EDGE / Math.max(w, h))) };
};

/**
 * 讀入一個圖片檔，回傳可直接放進 doc.bgImage 的物件。
 * 失敗時丟出帶中文訊息的錯誤（呼叫端直接顯示給使用者）。
 */
export const loadBgImage = (file) => new Promise((resolve, reject) => {
  if (!file) return reject(new Error('沒有選到檔案。'));
  if (!ACCEPTED.includes(file.type)) {
    return reject(new Error('只支援 JPG、PNG 或 WebP 圖片。'));
  }

  const reader = new FileReader();
  reader.onerror = () => reject(new Error('讀取檔案失敗，請再試一次。'));
  reader.onload = () => {
    const origin = readOriginMeta(reader.result);

    const img = new Image();
    img.onerror = () => reject(new Error('這個檔案不是能開啟的圖片。'));
    img.onload = () => {
      const maxEdge = origin ? MAX_EDGE_SELF : MAX_EDGE;
      const ratio = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      // PNG／WebP 可能帶透明；WebP 輸出原生支援透明，只有退回 JPEG 時
      // 才需要先補白底，否則透明區塊會被 JPEG 填成黑色。
      const keepAlpha = file.type === 'image/png' || file.type === 'image/webp';
      if (!keepAlpha) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);

      const { x, y, scale } = placementFor(origin, w, h);
      resolve({
        v: BG_SCHEMA,
        src: encodeCanvas(canvas, keepAlpha),
        w, h,
        x, y, scale,
        baseX: x, baseY: y, baseScale: scale,
        opacity: DEFAULT_OPACITY,
        fromApp: !!origin,
      });
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

/** 底圖在畫布座標上實際佔的範圍。 */
export const bgImageBox = (bg) => {
  if (!bg) return null;
  const scale = bg.scale || 1;
  return { x: bg.x ?? BG_X, y: bg.y ?? BG_Y, w: bg.w * scale, h: bg.h * scale };
};

/** 面板上的「大小」以匯入當下為 100%，使用者才有一個看得懂的基準。 */
export const bgZoomPct = (bg) => Math.round((bg.scale / (bg.baseScale || bg.scale || 1)) * 100);
export const bgScaleFromPct = (bg, pct) => clampScale((bg.baseScale || bg.scale || 1) * pct / 100);

/**
 * 把舊版（v1）的底圖與擦除筆跡升級成目前的格式。
 *
 * v1 的底圖固定釘在 (40, 40)、只有一個 scale，擦除筆跡存的是畫布座標。
 * 新版底圖可以自由搬動與縮放，筆跡因此改存圖片自身的像素座標；這裡把
 * 舊筆跡除以當時的倍率、扣掉當時的落點，換算回去，舊案件打開來擦痕
 * 仍然蓋在同一個位置上。
 */
export const migrateBgPatch = (bgImage, bgErase = []) => {
  if (!bgImage) return { bgImage: null, bgErase: [] };
  if (bgImage.v === BG_SCHEMA) return { bgImage, bgErase };

  const scale = bgImage.scale || 1;
  return {
    bgImage: {
      ...bgImage,
      v: BG_SCHEMA,
      x: BG_X, y: BG_Y, scale,
      baseX: BG_X, baseY: BG_Y, baseScale: scale,
      opacity: bgImage.opacity ?? DEFAULT_OPACITY,
      fromApp: false,
    },
    bgErase: bgErase.map(st => ({
      ...st,
      w: Math.max(1, (st.w || 24) / scale),
      pts: st.pts.map(([x, y]) => [(x - BG_X) / scale, (y - BG_Y) / scale]),
    })),
  };
};
