import { describe, it, expect } from 'vitest';
import { isPlainLink, linkStyleOf, linkStrokeSpec } from '../standalone';
import { mergeChildLinks } from '../childLinks';
import { buildKinGraph } from '../kinship';

describe('一般連線（生態圖／註記／自畫線）', () => {
  it('三種都算，配偶連線不算', () => {
    expect(isPlainLink({ type: 'eco' })).toBe(true);
    expect(isPlainLink({ type: 'annotation' })).toBe(true);
    expect(isPlainLink({ type: 'line' })).toBe(true);
    expect(isPlainLink({ status: 'married' })).toBe(false);
  });
  it('沒填線型的舊資料是實線', () => {
    expect(linkStyleOf({ type: 'eco' })).toBe('solid');
    expect(linkStyleOf({ lineStyle: 'zigzag' })).toBe('zigzag');
    expect(linkStyleOf({ lineStyle: '亂填' })).toBe('solid');
  });
  it('粗線加粗、虛線有 dasharray', () => {
    expect(linkStrokeSpec('strong', 2).strokeWidth).toBeGreaterThan(2);
    expect(linkStrokeSpec('dashed', 2).strokeDasharray).toBeTruthy();
    expect(linkStrokeSpec('solid', 2).strokeDasharray).toBeUndefined();
  });
  it('自畫線不會被當成配偶，也不會當成放子女的婚姻線', () => {
    const g = buildKinGraph({
      nodes: [{ id: 'a', gender: 'M' }, { id: 'b', gender: 'F' }],
      customLinks: [{ id: 'l1', sourceId: 'a', targetId: 'b', type: 'line', status: 'married' }],
    });
    expect(g.spouses.get('a')).toBeUndefined();
    const out = mergeChildLinks([], [{ id: 'l1', sourceId: 'a', targetId: 'b', type: 'line' }],
      [{ id: 'c1', lineId: 'l1', childId: 'x' }], ['a', 'b', 'x']);
    expect(out).toEqual([]);
  });
});
