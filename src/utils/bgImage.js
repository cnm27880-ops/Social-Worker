/* ===========================================================================
 * 舊圖修補：把使用者上傳的圖片收成可以存進案件文件的底圖
 *
 * 為什麼要先縮圖再轉 dataURL：
 *   底圖必須跟著案件一起存進 localStorage、一起匯出成 .json，所以只能是
 *   dataURL（blob URL 重新整理就失效）。而 base64 會比原檔再大約 1.37 倍，
 *   手機拍的一張家系圖動輒 3–5MB，直接塞進去必定超過瀏覽器 5MB 左右的
 *   localStorage 配額 —— 案件會存不進去。掃描的家系圖是線稿，1600px 已經
 *   遠超過在畫布上描圖需要的解析度。
 * =========================================================================== */

/** 縮圖後的最長邊上限。 */
export const MAX_EDGE = 1600;

/** 底圖在畫布上的落點：稍微內縮，讓使用者看得出它是一張底圖而不是背景色。 */
export const BG_X = 40;
export const BG_Y = 40;

export const DEFAULT_OPACITY = 0.55;
export const DEFAULT_SCALE = 1;

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

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
    const img = new Image();
    img.onerror = () => reject(new Error('這個檔案不是能開啟的圖片。'));
    img.onload = () => {
      const ratio = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      // PNG 可能帶透明，轉 JPEG 會把透明填成黑色，所以 PNG 維持 PNG
      const keepPng = file.type === 'image/png';
      if (!keepPng) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);

      resolve({
        src: keepPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85),
        w, h,
        opacity: DEFAULT_OPACITY,
        scale: DEFAULT_SCALE,
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
  return { x: BG_X, y: BG_Y, w: bg.w * scale, h: bg.h * scale };
};
