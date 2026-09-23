import { describe, it, expect } from 'vitest';
import { browserOf, osOf, envSummary, feedbackUrl, FEEDBACK_FORM } from '../feedback';

const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const EDGE = CHROME_WIN + ' Edg/128.0.2739.42';
const ASUS_ANDROID = 'Mozilla/5.0 (Linux; Android 14; ASUS_AI2401) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

describe('browserOf／osOf', () => {
  it('認得常見的組合', () => {
    expect([browserOf(CHROME_WIN), osOf(CHROME_WIN)]).toEqual(['Chrome 128', 'Windows']);
    expect(browserOf(EDGE)).toBe('Edge 128');
    expect([browserOf(ASUS_ANDROID), osOf(ASUS_ANDROID)]).toEqual(['Chrome 127', 'Android']);
    expect([browserOf(IPHONE), osOf(IPHONE)]).toEqual(['Safari 17', 'iOS']);
  });
  it('認不得就說其他', () => {
    expect(browserOf('curl/8')).toBe('其他瀏覽器');
    expect(osOf('')).toBe('其他系統');
  });
});

describe('feedbackUrl', () => {
  const env = { version: '1.1.0', buildDate: '2026-09-23', ua: CHROME_WIN, width: 1920, height: 1080, tab: '家系圖' };
  it('環境資訊只有版本、瀏覽器、系統、螢幕、頁籤', () => {
    expect(envSummary(env)).toBe('v1.1.0（2026-09-23） · Chrome 128 · Windows · 1920×1080 · 家系圖');
  });
  it('帶進表單的「環境資訊」欄位', () => {
    const url = new URL(feedbackUrl(env));
    expect(url.origin + url.pathname).toBe(FEEDBACK_FORM);
    expect(url.searchParams.get('entry.975784485')).toBe(envSummary(env));
  });
});
