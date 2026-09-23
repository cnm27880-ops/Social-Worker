import { describe, it, expect } from 'vitest';
import { mergeChildLinks, setChildLink, dropChildLinks, childRestPos, dropZones, hitZone, descendantsOf } from '../childLinks';
import { remapGen2Keys, INITIAL_DOC, migrateDoc } from '../caseDoc';

const baseLines = [
  { id: 'ml-g1', type: 'marry', a: 'fa', b: 'mo' },
  { id: 'pc-g1', type: 'pc', pa: 'fa', pb: 'mo', kids: ['c0'] },
];
const couple = [{ id: 'l_1', sourceId: 'f_m', targetId: 'f_f', status: 'married' }];

describe('mergeChildLinks', () => {
  it('沒有子女關係時原封不動', () => {
    expect(mergeChildLinks(baseLines, couple, [])).toBe(baseLines);
  });
  it('掛到主家系：併進原本那條手足橫線', () => {
    const out = mergeChildLinks(baseLines, [], [{ id: 'x', lineId: 'ml-g1', childId: 'f_9' }]);
    expect(out.find(l => l.id === 'pc-g1').kids).toEqual(['c0', 'f_9']);
    expect(baseLines[1].kids).toEqual(['c0']);   // 不改動傳入的陣列
  });
  it('掛到自由擴充的夫妻：沒有親子線就新開一條，三個人共用', () => {
    const out = mergeChildLinks(baseLines, couple, [
      { id: 'a', lineId: 'l_1', childId: 'k1' },
      { id: 'b', lineId: 'l_1', childId: 'k2' },
      { id: 'c', lineId: 'l_1', childId: 'k3' },
    ]);
    const pc = out.filter(l => l.type === 'pc' && l.pa === 'f_m');
    expect(pc).toHaveLength(1);
    expect(pc[0].kids).toEqual(['k1', 'k2', 'k3']);
  });
  it('生態圖／註記連線不算婚姻線；線不在了就不畫', () => {
    const eco = [{ id: 'l_e', type: 'eco', sourceId: 'fa', targetId: 'eco_1' }];
    const out = mergeChildLinks(baseLines, eco, [
      { id: 'a', lineId: 'l_e', childId: 'k1' },
      { id: 'b', lineId: 'gone', childId: 'k2' },
    ]);
    expect(out).toEqual(baseLines);
  });
  it('不能當自己的子女', () => {
    const out = mergeChildLinks(baseLines, couple, [{ id: 'a', lineId: 'l_1', childId: 'f_m' }]);
    expect(out.some(l => l.id === 'pcx-l_1')).toBe(false);
  });
});

describe('setChildLink／dropChildLinks', () => {
  it('一個人只有一對父母：再掛一次就是改掛', () => {
    let cls = setChildLink([], 'k1', { lineId: 'l_1' }, 'a');
    cls = setChildLink(cls, 'k1', { parentId: 'f_m' }, 'b');
    expect(cls).toEqual([{ id: 'b', parentId: 'f_m', childId: 'k1' }]);
  });
  it('刪人或刪線時清掉相關的；沒有就回傳原陣列', () => {
    const cls = [{ id: 'a', lineId: 'l_1', childId: 'k1' }, { id: 'b', lineId: 'l_2', childId: 'k2' }];
    expect(dropChildLinks(cls, { childId: 'k1' })).toEqual([cls[1]]);
    expect(dropChildLinks(cls, { lineId: 'l_2' })).toEqual([cls[0]]);
    expect(dropChildLinks(cls, { childId: 'nobody' })).toBe(cls);
  });
});

describe('childRestPos', () => {
  it('起點在婚姻線下方：放回起點（拖上去連線、放開回原位）', () => {
    expect(childRestPos({ start: { x: 500, y: 300 }, dropX: 420, barY: 100, radius: 18 })).toEqual({ x: 500, y: 300 });
  });
  it('起點在線上方：放到下一個世代，有兄弟姊妹就對齊他們', () => {
    expect(childRestPos({ start: { x: 500, y: 50 }, dropX: 420, barY: 100, radius: 18 })).toEqual({ x: 420, y: 180 });
    expect(childRestPos({ start: { x: 500, y: 50 }, dropX: 420, barY: 100, siblingYs: [200, 210], radius: 18 })).toEqual({ x: 420, y: 210 });
  });
});

describe('caseDoc：子女關係跟著第二代搬家', () => {
  it('插人時 ml-c0 → ml-c1；人被刪掉就解除', () => {
    const doc = { ...INITIAL_DOC, childLinks: [
      { id: 'a', lineId: 'ml-c0', childId: 'k1' },
      { id: 'b', lineId: 'l_1', childId: 'k2' },
    ] };
    expect(remapGen2Keys(doc, [-1, 0]).childLinks.map(c => c.lineId)).toEqual(['ml-c1', 'l_1']);
    expect(remapGen2Keys(doc, []).childLinks.map(c => c.lineId)).toEqual(['l_1']);
  });
  it('舊存檔沒有 childLinks 補空陣列；壞掉的筆數丟掉', () => {
    expect(migrateDoc({}).childLinks).toEqual([]);
    expect(migrateDoc({ childLinks: [{ id: 'a', lineId: 'x', childId: 'y' }, { id: 1 }] }).childLinks).toHaveLength(1);
  });
});

describe('單親', () => {
  it('親子線的兩端都是那位家長；家長不在了就不畫', () => {
    const cls = [{ id: 'a', parentId: 'mom', childId: 'k1' }, { id: 'b', parentId: 'mom', childId: 'k2' }];
    const out = mergeChildLinks([], [], cls, ['mom', 'k1', 'k2']);
    expect(out).toEqual([{ id: 'pcx-mom', type: 'pc', pa: 'mom', pb: 'mom', kids: ['k1', 'k2'], isExt: true, single: true }]);
    expect(mergeChildLinks([], [], cls, ['k1', 'k2'])).toEqual([]);
  });
  it('刪掉家長時一起清掉', () => {
    const cls = [{ id: 'a', parentId: 'mom', childId: 'k1' }, { id: 'b', lineId: 'l', childId: 'k2' }];
    expect(dropChildLinks(cls, { childId: 'mom', parentId: 'mom' })).toEqual([cls[1]]);
  });
  it('第二代搬家時單親的家長也跟著搬', () => {
    const doc = { ...INITIAL_DOC, childLinks: [{ id: 'a', parentId: 'c0', childId: 'k1' }] };
    expect(remapGen2Keys(doc, [-1, 0]).childLinks[0].parentId).toBe('c1');
    expect(remapGen2Keys(doc, []).childLinks).toEqual([]);
  });
  it('舊格式與單親格式都能通過檢查', () => {
    expect(migrateDoc({ childLinks: [{ id: 'a', parentId: 'x', childId: 'y' }] }).childLinks).toHaveLength(1);
  });
});

describe('dropZones／hitZone', () => {
  const P = { fa: { x: 100, y: 100 }, mo: { x: 164, y: 100 }, aunt: { x: 300, y: 100 }, me: { x: 500, y: 300 } };
  const posOf = id => P[id];
  const zones = dropZones({
    draggedId: 'me', couples: [{ id: 'ml', a: 'fa', b: 'mo' }], singles: ['aunt', 'me'],
    posOf, barYOf: () => 100, radius: 18,
  });
  it('夫妻一格（中點下方）、單身者一格（正下方）；自己不會有', () => {
    expect(zones.map(z => z.key)).toEqual(['l:ml', 'p:aunt']);
    expect(zones[0].x).toBe(132);
    expect(zones[0].y).toBeGreaterThan(100 + 18);
    expect(zones[1]).toMatchObject({ x: 300, target: { parentId: 'aunt' } });
  });
  it('拖著夫妻其中一人時，不會出現他們自己的放置區', () => {
    const z = dropZones({ draggedId: 'fa', couples: [{ id: 'ml', a: 'fa', b: 'mo' }], singles: [], posOf, barYOf: () => 100, radius: 18 });
    expect(z).toEqual([]);
  });
  it('放進去才算，旁邊一點不算', () => {
    expect(hitZone(zones, { x: 132, y: zones[0].y + 5 })?.key).toBe('l:ml');
    expect(hitZone(zones, { x: 132, y: zones[0].y + 40 })).toBeNull();
    expect(hitZone(zones, P.fa)).toBeNull();   // 放在人身上是結婚，不是子女
  });
});

describe('不能放進自己子孫的子女區', () => {
  const lines = [
    { id: 'p1', type: 'pc', pa: 'fa', pb: 'mo', kids: ['c0'] },
    { id: 'p2', type: 'pc', pa: 'c0', pb: 's0', kids: ['g0'] },
  ];
  it('descendantsOf 一路往下找', () => {
    expect([...descendantsOf(lines, 'fa')].sort()).toEqual(['c0', 'g0']);
  });
  it('子孫的放置區不會出現', () => {
    const P = { c0: { x: 0, y: 0 }, s0: { x: 64, y: 0 }, g0: { x: 32, y: 80 }, x: { x: 300, y: 0 } };
    const z = dropZones({
      draggedId: 'fa', couples: [{ id: 'ml-c0', a: 'c0', b: 's0' }], singles: ['g0', 'x'],
      posOf: id => P[id], barYOf: () => 0, radius: 18, blocked: descendantsOf(lines, 'fa'),
    });
    expect(z.map(q => q.key)).toEqual(['p:x']);
  });
});
