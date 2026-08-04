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
 * =========================================================================== */

/** 縮圖後的最長邊上限。 */
export const MAX_EDGE = 1600;

/** 底圖在畫布上的落點：稍微內縮，讓使用者看得出它是一張底圖而不是背景色。 */
export const BG_X = 40;
export const BG_Y = 40;

export const DEFAULT_OPACITY = 0.55;
export const DEFAULT_SCALE = 1;

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

/** WebP 品質；PNG 掃描線稿轉過來也用得到，WebP 原生支援透明。 */
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.85;

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

      // PNG／WebP 可能帶透明；WebP 輸出原生支援透明，只有退回 JPEG 時
      // 才需要先補白底，否則透明區塊會被 JPEG 填成黑色。
      const keepAlpha = file.type === 'image/png' || file.type === 'image/webp';
      if (!keepAlpha) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);

      resolve({
        src: encodeCanvas(canvas, keepAlpha),
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
