/* ===========================================================================
 * 問題回報／功能建議
 *
 * 右上角的按鈕在新分頁打開 Google 表單（表單由作者自己的 Google 帳號管理，
 * 回覆會整理在 Google 試算表）。網站本身不送出任何資料：是使用者自己在
 * Google 的頁面上填寫、按送出，本站「零雲端傳輸」的承諾不受影響。
 *
 * 唯一幫忙帶入的是「環境資訊」欄位——網站版本、瀏覽器、作業系統、螢幕
 * 大小、目前在哪個頁籤，方便重現問題。刻意不帶任何案件內容（案主、家系圖、
 * 紀錄文字都不會出現在網址裡）；使用者送出前也看得到、可以刪掉。
 * =========================================================================== */

export const FEEDBACK_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSelDET-AktxNvvGLjq5pcI2b1BlCsBmkLPHs1OqmH-fKN9Yew/viewform';
/** 表單上「環境資訊（系統自動帶入）」那一題的欄位代碼。 */
export const FEEDBACK_ENV_ENTRY = 'entry.975784485';

/** 從 User-Agent 認出瀏覽器與版本（只取主版號）。順序有差：Edge、Opera 的 UA 裡也有 Chrome。 */
export const browserOf = (ua = '') => {
  const rules = [
    [/Edg\/(\d+)/, 'Edge'], [/OPR\/(\d+)/, 'Opera'], [/SamsungBrowser\/(\d+)/, 'Samsung'],
    [/Firefox\/(\d+)/, 'Firefox'], [/Chrome\/(\d+)/, 'Chrome'], [/Version\/(\d+).*Safari/, 'Safari'],
  ];
  for (const [re, name] of rules) {
    const m = re.exec(ua);
    if (m) return `${name} ${m[1]}`;
  }
  return '其他瀏覽器';
};

export const osOf = (ua = '') => {
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return '其他系統';
};

/** 環境資訊的一行字，例如「v1.1.0（2026-09-23） · Chrome 128 · Windows · 1920×1080 · 家系圖」。 */
export const envSummary = ({ version, buildDate, ua, width, height, tab }) => [
  `v${version}${buildDate ? `（${buildDate}）` : ''}`,
  browserOf(ua), osOf(ua),
  width && height ? `${width}×${height}` : null,
  tab,
].filter(Boolean).join(' · ');

/** 帶好環境資訊的表單網址。 */
export const feedbackUrl = (env) =>
  `${FEEDBACK_FORM}?usp=pp_url&${FEEDBACK_ENV_ENTRY}=${encodeURIComponent(envSummary(env))}`;
