import { describe, it, expect } from 'vitest';
import { buildFamily } from '../familyLayout';

describe('buildFamily 第三代多胞胎', () => {
  it('g3Multi 勾選的孫輩會帶 isMulti', () => {
    const { nodes } = buildFamily({
      gen2Cfg: [{ gender: 'M', partner: 'married', g3Str: '男女女', g3Multi: [false, true, true] }],
    });
    const g3 = nodes.filter(n => n.gen === 2).map(n => [n.id, n.isMulti]);
    expect(g3).toEqual([['g0_0', false], ['g0_1', true], ['g0_2', true]]);
  });

  it('舊資料沒有 g3Multi 時一律不是多胞胎', () => {
    const { nodes } = buildFamily({ gen2Cfg: [{ gender: 'F', partner: 'married', g3Str: 'MM' }] });
    expect(nodes.filter(n => n.gen === 2).every(n => n.isMulti === false)).toBe(true);
  });
});
