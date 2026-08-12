/* ===========================================================================
 * 在下載的圖片裡蓋一枚「這張圖原本畫在畫布的哪裡、多大」的印子
 *
 * 為什麼需要：
 *   下載出去的 PNG／JPG 是「裁切後 ×3 倍」的點陣圖 —— 裁切把畫布座標的
 *   原點資訊丟掉了，3 倍又讓圖上的人物符號變成畫布上的三倍大。所以把自己
 *   下載的圖再匯入「舊圖修補」當底圖時，位置與大小都跟原稿對不起來：
 *   新疊上去的符號只有舊圖上的三分之一大，位置也整個偏掉。
 *
 *   這裡的做法是在匯出時把裁切框（minX／minY／寬／高，畫布座標）寫進圖檔
 *   本身，匯入時再讀回來，就能一次把底圖放回原本的位置、還原成原本的大小。
 *   使用者不必自己對位，也不必另外保存 .json。
 *
 * 為什麼寫進圖檔而不是檔名：
 *   檔名會被使用者改、被通訊軟體改；而且塞四個數字進檔名很醜。PNG 的 tEXt
 *   與 JPEG 的 COM 都是規格內的註解區塊，任何看圖軟體都會忽略它，檔案照樣
 *   能正常開啟、正常貼進 Word，只有本站認得這段內容。
 *
 * 讀不到印子也不會壞：匯入端會退回「自動縮放到適合畫布」的一般流程，
 * 掃描檔與手機拍的照片走的就是那條路。
 * =========================================================================== */

/** 印子的識別字串。PNG tEXt 的 keyword 限 Latin-1、1–79 字元。 */
export const META_KEYWORD = 'Genogram-Origin';

/** 只讀檔頭這麼多位元組就夠：印子固定蓋在 IHDR／SOI 後面第一格。 */
const HEAD_BYTES = 12288;

const latin1Bytes = (str) => {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xFF;
  return out;
};

const latin1String = (bytes, from, to) => {
  let out = '';
  for (let i = from; i < to; i++) out += String.fromCharCode(bytes[i]);
  return out;
};

/* --- PNG chunk 的 CRC32（多項式 0xEDB88320，PNG 規格指定） --- */
let CRC_TABLE = null;
const crcTable = () => {
  if (CRC_TABLE) return CRC_TABLE;
  CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    CRC_TABLE[n] = c >>> 0;
  }
  return CRC_TABLE;
};

const crc32 = (bytes) => {
  const table = crcTable();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

const isPng = (bytes) => PNG_SIG.every((b, i) => bytes[i] === b);

const view = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/**
 * 把一個 tEXt chunk 插在 IHDR 後面。回傳新的位元組，格式不對就回傳 null。
 * IHDR 一定是第一個 chunk（PNG 規格），所以插在它後面對任何解碼器都合法。
 */
const pngInsertText = (bytes, payload) => {
  if (bytes.length < 33 || !isPng(bytes)) return null;
  const insertAt = 8 + 12 + view(bytes).getUint32(8);   // 簽章 + IHDR（長度4+型別4+資料+CRC4）

  const data = latin1Bytes(payload);
  const chunk = new Uint8Array(12 + data.length);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, data.length);
  chunk.set(latin1Bytes('tEXt'), 4);
  chunk.set(data, 8);
  dv.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));

  const out = new Uint8Array(bytes.length + chunk.length);
  out.set(bytes.subarray(0, insertAt), 0);
  out.set(chunk, insertAt);
  out.set(bytes.subarray(insertAt), insertAt + chunk.length);
  return out;
};

/** 走訪 PNG chunk，找出第一個 tEXt 的內容（含 keyword\0 前綴）。 */
const pngReadText = (bytes) => {
  if (bytes.length < 8 || !isPng(bytes)) return null;
  const dv = view(bytes);
  let p = 8;
  while (p + 8 <= bytes.length) {
    const len = dv.getUint32(p);
    const type = latin1String(bytes, p + 4, p + 8);
    if (type === 'IEND') return null;
    if (type === 'tEXt' && p + 12 + len <= bytes.length) {
      return latin1String(bytes, p + 8, p + 8 + len);
    }
    p += 12 + len;
  }
  return null;
};

/** JPEG 的 COM（0xFFFE）註解區塊，插在 SOI 後面。 */
const jpegInsertComment = (bytes, payload) => {
  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
  const data = latin1Bytes(payload);
  if (data.length + 2 > 0xFFFF) return null;

  const seg = new Uint8Array(4 + data.length);
  seg[0] = 0xFF; seg[1] = 0xFE;
  seg[2] = ((data.length + 2) >> 8) & 0xFF;
  seg[3] = (data.length + 2) & 0xFF;
  seg.set(data, 4);

  const out = new Uint8Array(bytes.length + seg.length);
  out.set(bytes.subarray(0, 2), 0);
  out.set(seg, 2);
  out.set(bytes.subarray(2), 2 + seg.length);
  return out;
};

/** 走訪 JPEG 標記段找 COM。碰到 SOS（影像資料開始）就停。 */
const jpegReadComment = (bytes) => {
  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
  let p = 2;
  while (p + 4 <= bytes.length) {
    if (bytes[p] !== 0xFF) return null;
    const marker = bytes[p + 1];
    if (marker === 0xFF) { p += 1; continue; }             // 填充位元組
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9)) { p += 2; continue; }
    if (marker === 0xDA) return null;                       // SOS：後面是壓縮資料
    const len = (bytes[p + 2] << 8) | bytes[p + 3];
    if (len < 2) return null;
    if (marker === 0xFE) return latin1String(bytes, p + 4, Math.min(p + 2 + len, bytes.length));
    p += 2 + len;
  }
  return null;
};

/** 把 `keyword\0{json}` 拆回物件；不是我們蓋的印子就回 null。 */
const decodePayload = (payload) => {
  if (!payload) return null;
  const sep = payload.indexOf('\0');
  if (sep < 0 || payload.slice(0, sep) !== META_KEYWORD) return null;
  try {
    const meta = JSON.parse(payload.slice(sep + 1));
    const ok = ['x', 'y', 'w', 'h'].every(k => Number.isFinite(meta?.[k]));
    return ok && meta.w > 0 && meta.h > 0 ? meta : null;
  } catch {
    return null;
  }
};

/**
 * 在剛產生的圖片 blob 上蓋印子。任何一步失敗都直接回傳原本的 blob ——
 * 這只是「下次匯入更順手」的加值資訊，絕不能讓下載本身失敗。
 */
export const stampOriginMeta = async (blob, mime, origin) => {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const payload = `${META_KEYWORD}\0${JSON.stringify(origin)}`;
    const out = mime === 'image/png' ? pngInsertText(bytes, payload)
      : mime === 'image/jpeg' ? jpegInsertComment(bytes, payload)
        : null;
    return out ? new Blob([out], { type: mime }) : blob;
  } catch {
    return blob;
  }
};

/**
 * 從匯入檔案的 dataURL 讀回印子。掃描檔、手機拍的照片、別的軟體畫的圖
 * 都不會有，回 null 是預期中的常態。
 */
export const readOriginMeta = (dataURL) => {
  try {
    if (typeof dataURL !== 'string') return null;
    const comma = dataURL.indexOf(',');
    const header = dataURL.slice(0, comma);
    if (comma < 0 || !header.includes(';base64')) return null;

    const isJpeg = header.includes('image/jpeg');
    if (!isJpeg && !header.includes('image/png')) return null;

    // base64 只解檔頭：一張 5MB 的圖沒必要整份轉成位元組陣列
    const b64 = dataURL.slice(comma + 1);
    const headLen = Math.min(b64.length - (b64.length % 4), Math.ceil(HEAD_BYTES / 3) * 4);
    const bin = atob(b64.slice(0, headLen));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    return decodePayload(isJpeg ? jpegReadComment(bytes) : pngReadText(bytes));
  } catch {
    return null;
  }
};
