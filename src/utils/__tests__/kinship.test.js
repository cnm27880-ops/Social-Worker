import { describe, it, expect } from 'vitest';
import { buildFamily } from '../familyLayout';
import { buildKinGraph, kinTitles, extraMembersText } from '../kinship';

/* 情境：案主是第二代長子（c0，已婚，配偶 s0）。
   配偶那邊的原生家庭用自由擴充區畫：岳父 gf、岳母 gm 結婚（l_in），
   配偶 s0 放進他們的子女區，另外還有配偶的哥哥 bro（在 s0 左邊）與妹妹 sis。 */
const gen2Cfg = [{ gender: 'M', partner: 'married', g3Str: '' }, { gender: 'F', partner: 'none', g3Str: '' }];
const freeNodes = [
  { id: 'gf', gender: 'M', x: 400, y: 80 },
  { id: 'gm', gender: 'F', x: 470, y: 80 },
  { id: 'bro', gender: 'M', x: 100, y: 160 },
  { id: 'sis', gender: 'F', x: 900, y: 160 },
  { id: 'far', gender: 'F', x: 1500, y: 160 },   // 沒有任何連線
  { id: 'pet', type: 'pet', x: 1600, y: 160 },
];
const customLinks = [{ id: 'l_in', sourceId: 'gf', targetId: 'gm', status: 'married' }];
const childLinks = [
  { id: 'a', lineId: 'l_in', childId: 's0' },
  { id: 'b', lineId: 'l_in', childId: 'bro' },
  { id: 'c', lineId: 'l_in', childId: 'sis' },
];
const family = buildFamily({ gen2Cfg, customLinks, childLinks, freeNodes });

describe('kinTitles', () => {
  const g = buildKinGraph({ ...family, freeNodes, customLinks });
  const t = kinTitles(g, 'c0');
  it('主家系', () => {
    expect(t.get('fa').title).toBe('案父');
    expect(t.get('c1').title).toBe('案妹');
    expect(t.get('s0').title).toBe('案妻');
  });
  it('配偶的父母用慣用簡稱，串接寫法也留著', () => {
    expect(t.get('gf')).toMatchObject({ title: '案岳父', chain: '案妻之父', dist: 2 });
    expect(t.get('gm').title).toBe('案岳母');
  });
  it('配偶的手足：左邊是兄、右邊是妹（走手足而不是繞經岳父母）', () => {
    expect(t.get('bro').title).toBe('案妻之兄');
    expect(t.get('sis').title).toBe('案妻之妹');
  });
  it('沒有連線的人、寵物不在裡面', () => {
    expect(t.has('far')).toBe(false);
    expect(t.has('pet')).toBe(false);
  });
  it('沒有案主就什麼都不算', () => {
    expect(kinTitles(g, null).size).toBe(0);
  });
});

describe('其他簡稱', () => {
  it('父親的哥哥是伯父、弟弟是叔叔；母親的兄弟是舅舅', () => {
    const fn = [
      { id: 'gpa', gender: 'M', x: 0, y: 0 }, { id: 'gma', gender: 'F', x: 60, y: 0 },
      { id: 'uncle', gender: 'M', x: 10, y: 80 },   // 在案父左邊 → 伯父
      { id: 'dad', gender: 'M', x: 200, y: 80 }, { id: 'aunt', gender: 'F', x: 400, y: 80 },
      { id: 'me', gender: 'M', x: 200, y: 160 },
    ];
    const cl = [{ id: 'l', sourceId: 'gpa', targetId: 'gma', status: 'married' }];
    const ch = [
      { id: '1', lineId: 'l', childId: 'uncle' }, { id: '2', lineId: 'l', childId: 'dad' },
      { id: '3', lineId: 'l', childId: 'aunt' }, { id: '4', parentId: 'dad', childId: 'me' },
    ];
    const fam = buildFamily({ mainFamily: false, customLinks: cl, childLinks: ch, freeNodes: fn });
    const t = kinTitles(buildKinGraph({ ...fam, freeNodes: fn, customLinks: cl }), 'me');
    expect(t.get('dad').title).toBe('案父');
    expect(t.get('uncle').title).toBe('案伯父');
    expect(t.get('aunt').title).toBe('案姑姑');
    expect(t.get('gpa').title).toBe('案祖父');
  });
  it('查不到簡稱就用串接', () => {
    const fn = [{ id: 'me', gender: 'F', x: 0, y: 0 }, { id: 'ex', gender: 'M', x: 60, y: 0 }, { id: 'exdad', gender: 'M', x: 60, y: -80 }];
    const cl = [{ id: 'l', sourceId: 'me', targetId: 'ex', status: 'divorced' }];
    const ch = [{ id: '1', parentId: 'exdad', childId: 'ex' }];
    const fam = buildFamily({ mainFamily: false, customLinks: cl, childLinks: ch, freeNodes: fn });
    const t = kinTitles(buildKinGraph({ ...fam, freeNodes: fn, customLinks: cl }), 'me');
    expect(t.get('exdad').title).toBe('案前夫之父');
  });
});

describe('extraMembersText', () => {
  it('只寫自由擴充區的人，一人一行，並回報沒連線的人數', () => {
    const { text, unlinked } = extraMembersText({
      family, freeNodes, customLinks, indexId: 'c0', deceasedIds: ['gf'], disabledIds: ['sis'],
    });
    // 同樣是兩層關係的，由左到右排；岳母的子女依左右順序：妻兄、妻（案妻）、妻妹
    expect(text).toBe('案妻之兄；\n案岳父已歿；\n案岳母，已婚，育有1子2女(男女女)；\n案妻之妹，領有身心障礙證明；\n');
    expect(unlinked).toBe(1);
  });
  it('直接跟案主有擴充連線的配偶，上面已經寫過，不重複', () => {
    const fn = [{ id: 'wife2', gender: 'F', x: 500, y: 160 }];
    const cl = [{ id: 'l2', sourceId: 'c0', targetId: 'wife2', status: 'married' }];
    const fam = buildFamily({ gen2Cfg, customLinks: cl, freeNodes: fn });
    expect(extraMembersText({ family: fam, freeNodes: fn, customLinks: cl, indexId: 'c0' }).text).toBe('');
  });
  it('沒有案主：不寫也不提示', () => {
    expect(extraMembersText({ family, freeNodes, customLinks, indexId: null })).toEqual({ text: '', unlinked: 0 });
  });
});
