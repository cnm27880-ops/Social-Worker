import { describe, it, expect } from 'vitest';
import { parseAgeInput, displayAge, currentRocYear } from '../age';

describe('currentRocYear', () => {
  it('西元年減 1911', () => {
    expect(currentRocYear(new Date(2026, 0, 1))).toBe(115);
  });
});

describe('parseAgeInput：民國生年', () => {
  it.each([
    ['82年', 82], ['82年次', 82], ['民82', 82], ['民國82', 82], ['民國82年', 82],
    ['民82年次', 82], ['R82', 82], ['r82', 82], ['102年次', 102], ['R 82', 82],
    ['８２年次', 82], ['Ｒ８２', 82],
  ])('%s → 生年 %i', (raw, year) => {
    expect(parseAgeInput(raw)).toEqual({ kind: 'birthYear', year });
  });
});

describe('parseAgeInput：已經是年齡', () => {
  it.each([
    ['35', 35], ['35y', 35], ['35Y', 35], ['35yo', 35], ['35YO', 35], ['35歲', 35], ['３５', 35],
  ])('%s → 年齡 %i', (raw, value) => {
    expect(parseAgeInput(raw)).toEqual({ kind: 'age', value });
  });
});

describe('parseAgeInput：認不得就原樣', () => {
  it.each(['', '   ', '不詳', '約60', '60多', '1985', 'abc', '82年生'])('%j → null', (raw) => {
    expect(parseAgeInput(raw)).toBeNull();
  });
  it('不是字串', () => {
    expect(parseAgeInput(undefined)).toBeNull();
    expect(parseAgeInput(82)).toBeNull();
  });
});

describe('displayAge', () => {
  const opts = { rocYear: 115 };
  it('原樣模式一律不動', () => {
    expect(displayAge('82年次', 'raw', opts)).toBe('82年次');
  });
  it('實歲模式換算民國生年', () => {
    expect(displayAge('82年次', 'age', opts)).toBe('33');
    expect(displayAge('民82', 'age', opts)).toBe('33');
    expect(displayAge('R102', 'age', opts)).toBe('13');
  });
  it('年齡寫法不換算', () => {
    expect(displayAge('82', 'age', opts)).toBe('82');
    expect(displayAge('82y', 'age', opts)).toBe('82y');
    expect(displayAge('82yo', 'age', opts)).toBe('82yo');
  });
  it('已歿成員不換算', () => {
    expect(displayAge('30年次', 'age', { ...opts, deceased: true })).toBe('30年次');
  });
  it('生年比今年大（打錯）不換算，不畫負數', () => {
    expect(displayAge('120年次', 'age', opts)).toBe('120年次');
  });
  it('今年出生是 0 歲', () => {
    expect(displayAge('115年次', 'age', opts)).toBe('0');
  });
  it('空值', () => {
    expect(displayAge(undefined, 'age', opts)).toBe('');
    expect(displayAge('', 'age', opts)).toBe('');
  });
});
