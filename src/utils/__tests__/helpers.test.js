import { describe, it, expect } from 'vitest';
import { parseGenders, formatKidsText, getGen2Title, centeredG1 } from '../helpers';

describe('parseGenders', () => {
  it('中文、英文、數字都認得，其他字略過', () => {
    expect(parseGenders('女男 MF12x')).toEqual(['F', 'M', 'M', 'F', 'M', 'F']);
  });
});

describe('formatKidsText', () => {
  it('統計子女並翻回中文', () => {
    expect(formatKidsText('MFM')).toBe('育有2子1女(男女男)');
    expect(formatKidsText('無')).toBe('無子嗣');
  });
});

describe('getGen2Title', () => {
  const cfg = [{ gender: 'F' }, { gender: 'M' }, { gender: 'M' }];
  it('沒有案主：用子女稱謂', () => {
    expect(getGen2Title(0, cfg, null)).toBe('案長女');
    expect(getGen2Title(2, cfg, null)).toBe('案次子');
  });
  it('案主是第二代：其他人改用手足稱謂', () => {
    expect(getGen2Title(1, cfg, 'c1')).toBe('案主');
    expect(getGen2Title(0, cfg, 'c1')).toBe('案姊');
    expect(getGen2Title(2, cfg, 'c1')).toBe('案弟');
  });
});

describe('centeredG1', () => {
  it('父母都在自動位置時不必寫入座標', () => {
    expect(centeredG1({}, [{ gender: 'M', partner: 'none' }])).toBeNull();
  });
  it('子女被整排搬動時，父母跟著位移', () => {
    const cfg = [{ gender: 'M', partner: 'none' }, { gender: 'F', partner: 'none' }];
    const base = centeredG1({ fa: { x: 0, y: 80 }, mo: { x: 64, y: 80 } }, cfg);
    const moved = centeredG1({ fa: { x: 0, y: 80 }, mo: { x: 64, y: 80 }, c0: { x: 1000, y: 160 }, c1: { x: 1100, y: 160 } }, cfg);
    expect(moved.fa.x).toBeGreaterThan(base.fa.x);
    expect(moved.mo.x - moved.fa.x).toBeCloseTo(64);
  });
});
