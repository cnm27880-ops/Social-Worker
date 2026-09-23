/* ===========================================================================
 * 年齡欄位：民國生年 ⇄ 實歲
 *
 * 節點裡的年齡是自由輸入的字串，實務上常見兩種寫法混用：
 *   - 民國生年：82年、82年次、民82、民國82年、R82
 *   - 年齡：35、35歲、35y、35yo
 *
 * 顯示模式（doc.ageDisplay）只影響「畫面上怎麼呈現」，存檔的永遠是使用者
 * 當初打的原字串。這樣切回「原樣」一定能還原，明年打開同一份案件時，
 * 實歲也會用明年的民國年重新計算，不會停在存檔那一年。
 *
 * 換算規則：今年民國年 − 生年，也就是「今年會滿的歲數」。只有出生年、
 * 沒有月日，所以生日還沒到的人會比實際多 1 歲——這是年次換算的通用慣例，
 * 說明書與按鈕提示都有寫。
 * =========================================================================== */

export const AGE_DISPLAYS = ['raw', 'age'];
export const AGE_DISPLAY_LABELS = { raw: '原樣', age: '實歲' };

/** 今年的民國年。傳入 Date 方便測試。 */
export const currentRocYear = (now = new Date()) => now.getFullYear() - 1911;

/** 全形數字與英文字母轉半形：注音輸入法很容易打出「８２年」「Ｒ８２」。 */
const toHalfWidth = (s) =>
  s.replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

/**
 * 判斷一格年齡字串是哪一種寫法。
 *   { kind: 'birthYear', year }  — 民國生年，可換算
 *   { kind: 'age', value }       — 已經是年齡，不換算
 *   null                         — 認不得（空白、「不詳」、「約60」…），原樣顯示
 */
export const parseAgeInput = (raw) => {
  if (typeof raw !== 'string') return null;
  const s = toHalfWidth(raw).replace(/\s+/g, '');
  if (!s) return null;

  let m;
  // 民82、民國82、民國82年、民82年次、R82、r82
  if ((m = /^(?:民國?|[Rr])(\d{1,3})(?:年次?)?$/.exec(s))) return { kind: 'birthYear', year: Number(m[1]) };
  // 82年、82年次
  if ((m = /^(\d{1,3})年次?$/.exec(s))) return { kind: 'birthYear', year: Number(m[1]) };
  // 35歲、35y、35yo、35Y
  if ((m = /^(\d{1,3})(?:歲|[Yy][Oo]?)$/.exec(s))) return { kind: 'age', value: Number(m[1]) };
  // 純數字一律當年齡
  if ((m = /^(\d{1,3})$/.exec(s))) return { kind: 'age', value: Number(m[1]) };
  return null;
};

/**
 * 依顯示模式算出節點上要畫的字。
 * - 'raw'：原樣
 * - 'age'：民國生年換成實歲；其他寫法原樣
 * 已歿成員不換算——「今年 − 生年」會變成「如果還活著是幾歲」，不是過世
 * 時的年齡，畫在打了叉的人身上反而會誤導。
 * 生年比今年還大（打錯字，或 100 年以後出生卻打成兩位數）也不換算，
 * 寧可原樣顯示，也不要畫出一個負數。
 */
export const displayAge = (raw, mode, { rocYear = currentRocYear(), deceased = false } = {}) => {
  const text = raw || '';
  if (mode !== 'age' || deceased) return text;
  const p = parseAgeInput(text);
  if (!p || p.kind !== 'birthYear') return text;
  if (p.year < 1 || p.year > rocYear) return text;
  return String(rocYear - p.year);
};
