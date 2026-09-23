import { describe, it, expect } from 'vitest';
import { alignGen2, remapGen2Keys, migrateDoc, INITIAL_DOC } from '../caseDoc';

describe('alignGen2', () => {
  it('在最前面插一個人，原本的人整批往後對', () => {
    expect(alignGen2(['F', 'M', 'M'], ['M', 'F', 'M', 'M'])).toEqual([-1, 0, 1, 2]);
  });
});

describe('remapGen2Keys', () => {
  const doc = {
    ...INITIAL_DOC,
    ages: { c0: '82年次', c1: '35' },
    texts: [
      { id: 't1', x: 0, y: 0, text: '長女', fontSize: 14, anchor: { id: 'c0', side: 'bottom' } },
      { id: 't2', x: 9, y: 9, text: '次子', fontSize: 14, anchor: { id: 'c1', side: 'left' } },
      { id: 't3', x: 0, y: 0, text: '父', fontSize: 14, anchor: { id: 'fa', side: 'top' } },
      { id: 't4', x: 0, y: 0, text: '備註', fontSize: 14 },
    ],
  };

  it('插人時，年齡與標籤跟著人搬', () => {
    const patch = remapGen2Keys(doc, [-1, 0, 1]);
    expect(patch.ages).toEqual({ c1: '82年次', c2: '35' });
    expect(patch.texts[0].anchor.id).toBe('c1');
    expect(patch.texts[1].anchor.id).toBe('c2');
    expect(patch.texts[2]).toBe(doc.texts[2]);
    expect(patch.texts[3]).toBe(doc.texts[3]);
  });

  it('人被刪掉時，標籤解開但留著', () => {
    const patch = remapGen2Keys(doc, [0]);   // 只留第一個
    expect(patch.texts[1].anchor).toBeUndefined();
    expect(patch.texts[1]).toMatchObject({ x: 9, y: 9, text: '次子' });
  });
});

describe('migrateDoc', () => {
  it('舊存檔沒有 ageDisplay 時補預設', () => {
    expect(migrateDoc({ ages: { c0: '1' } }).ageDisplay).toBe('raw');
  });
  it('不認得的 ageDisplay 改回預設', () => {
    expect(migrateDoc({ ageDisplay: 'weird' }).ageDisplay).toBe('raw');
  });
  it('壞掉的標籤綁定只丟綁定、保留方塊', () => {
    const doc = migrateDoc({
      texts: [
        { id: 'a', x: 1, y: 2, text: 'x', fontSize: 14, anchor: { id: 'c0', side: 'middle' } },
        { id: 'b', x: 1, y: 2, text: 'y', fontSize: 14, anchor: { id: 'c0', side: 'left' } },
      ],
    });
    expect(doc.texts[0].anchor).toBeUndefined();
    expect(doc.texts[0].text).toBe('x');
    expect(doc.texts[1].anchor).toEqual({ id: 'c0', side: 'left' });
  });
});
