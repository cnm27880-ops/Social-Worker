import { describe, it, expect } from 'vitest';
import { CHANGELOG, recentUpdates, formatUpdateDate } from '../changelog';

describe('更新公告', () => {
  it('每筆都有 YYYY-MM-DD 日期與至少一條說明', () => {
    for (const u of CHANGELOG) {
      expect(u.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(u.items.length).toBeGreaterThan(0);
    }
  });

  it('新的排前面，只取前幾筆', () => {
    const list = [{ date: '2026-01-01', items: ['a'] }, { date: '2026-03-01', items: ['b'] }, { date: '2026-02-01', items: ['c'] }];
    expect(recentUpdates(list, 2).map(u => u.date)).toEqual(['2026-03-01', '2026-02-01']);
  });

  it('日期改用斜線顯示', () => {
    expect(formatUpdateDate('2026-09-27')).toBe('2026/09/27');
  });
});
