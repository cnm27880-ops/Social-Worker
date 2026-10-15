import { describe, it, expect } from 'vitest';
import { buildFamily } from '../familyLayout';

describe('buildFamily 第二對父母', () => {
  const cfg = [
    { gender: 'F', partner: 'none', g3Str: '', p2: true },
    { gender: 'M', partner: 'none', g3Str: '' },
  ];

  it('預設關閉：沒有 fa2／mo2，也沒有第二條親子線', () => {
    const { nodes, lines } = buildFamily({ gen2Cfg: cfg });
    expect(nodes.some(n => n.id === 'fa2' || n.id === 'mo2')).toBe(false);
    expect(lines.some(l => l.id === 'pc-g1b' || l.id === 'ml-g1b')).toBe(false);
  });

  it('打開後多一對父母，只連有勾 p2 的人，原本那對照舊連所有子女', () => {
    const { nodes, lines } = buildFamily({ gen2Cfg: cfg, parents2On: true, parents2Type: 'adopt', parents2Status: 'separated' });
    expect(nodes.filter(n => n.gen === 0).map(n => [n.id, n.label])).toEqual([
      ['fa', '父'], ['mo', '母'], ['fa2', '養父'], ['mo2', '養母'],
    ]);
    expect(lines.find(l => l.id === 'ml-g1b').status).toBe('separated');
    expect(lines.find(l => l.id === 'pc-g1').kids).toEqual(['c0', 'c1']);
    expect(lines.find(l => l.id === 'pc-g1b')).toMatchObject({ pa: 'fa2', pb: 'mo2', kids: ['c0'], dashed: true });
  });

  it('第二對父母擺在第一對右邊，不會壓到', () => {
    const { nodes } = buildFamily({ gen2Cfg: cfg, parents2On: true });
    const x = id => nodes.find(n => n.id === id).dx;
    expect(x('fa2')).toBeGreaterThan(x('mo') + 60);
  });

  it('繼親是實線，收養與寄養是虛線', () => {
    const dashedOf = (t) => buildFamily({ gen2Cfg: cfg, parents2On: true, parents2Type: t })
      .lines.find(l => l.id === 'pc-g1b').dashed;
    expect([dashedOf('adopt'), dashedOf('step'), dashedOf('foster')]).toEqual([true, false, true]);
  });

  it('沒有人勾 p2 時只畫出父母符號，不產生親子線', () => {
    const { lines } = buildFamily({ gen2Cfg: [{ gender: 'M', partner: 'none', g3Str: '' }], parents2On: true });
    expect(lines.some(l => l.id === 'pc-g1b')).toBe(false);
    expect(lines.some(l => l.id === 'ml-g1b')).toBe(true);
  });

  it('舊圖修補模式（主家系關閉）不畫第二對父母', () => {
    const { nodes } = buildFamily({ gen2Cfg: cfg, parents2On: true, mainFamily: false });
    expect(nodes.some(n => n.id === 'fa2')).toBe(false);
  });
});

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
