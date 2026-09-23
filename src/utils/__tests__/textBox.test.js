import { describe, it, expect } from 'vitest';
import {
  verticalCells, textBoxSize, anchoredXY, resolveText, pickSide,
  snapWhileDragging, detachTextsFrom, duplicateText, effectiveVertical, ANCHOR_GAP,
  textCenter, xyForCenter,
} from '../textBox';

const R = 18;
const box = (t) => {
  const s = textBoxSize(t, effectiveVertical(t));
  return { l: t.x + s.left, t: t.y + s.top, r: t.x + s.left + s.w, b: t.y + s.top + s.h, cx: t.x + s.left + s.w / 2, cy: t.y + s.top + s.h / 2 };
};

describe('verticalCells：直式的數字', () => {
  it('中文一字一格', () => {
    expect(verticalCells('案父')).toEqual(['案', '父']);
  });
  it('一兩位數字併成一格（縱中橫）', () => {
    expect(verticalCells('案父58歲')).toEqual(['案', '父', '58', '歲']);
    expect(verticalCells('3F')).toEqual(['3F']);
  });
  it('三位以上一字一格往下排', () => {
    expect(verticalCells('1985年')).toEqual(['1', '9', '8', '5', '年']);
  });
});

describe('textBoxSize', () => {
  it('中文字寬是英數的將近兩倍', () => {
    const zh = textBoxSize({ text: '王小明', fontSize: 10 });
    const en = textBoxSize({ text: 'abc', fontSize: 10 });
    expect(zh.w).toBeGreaterThan(en.w * 1.5);
  });
  it('橫式方塊頂端在基線上方一個字高', () => {
    expect(textBoxSize({ text: 'a', fontSize: 16 }).top).toBe(-16);
  });
  it('直式：行數決定寬、字數決定高', () => {
    const one = textBoxSize({ text: '王小明', fontSize: 10, vertical: true });
    const two = textBoxSize({ text: '王小明\n務農', fontSize: 10, vertical: true });
    expect(two.w).toBeCloseTo(one.w * 2);
    expect(two.h).toBeCloseTo(one.h);
  });
});

describe('anchoredXY：四個方位', () => {
  const t = { text: '王小明', fontSize: 14 };
  const node = { x: 200, y: 100 };
  const place = (side) => box({ ...t, ...anchoredXY(t, node, side, R), anchor: { id: 'n', side } });

  it('下方：水平置中、頂端在節點下緣再往下一點', () => {
    const b = place('bottom');
    expect(b.cx).toBeCloseTo(node.x);
    expect(b.t).toBeCloseTo(node.y + R + ANCHOR_GAP);
  });
  it('上方：底端在節點上緣再往上一點', () => {
    const b = place('top');
    expect(b.cx).toBeCloseTo(node.x);
    expect(b.b).toBeCloseTo(node.y - R - ANCHOR_GAP);
  });
  it('左方：直式、垂直置中、右緣貼著節點', () => {
    const b = place('left');
    expect(b.cy).toBeCloseTo(node.y);
    expect(b.r).toBeCloseTo(node.x - R - ANCHOR_GAP);
  });
  it('右方：左緣貼著節點', () => {
    const b = place('right');
    expect(b.l).toBeCloseTo(node.x + R + ANCHOR_GAP);
  });
});

describe('resolveText', () => {
  const t = { id: 't', x: 5, y: 5, text: '案父', fontSize: 14, anchor: { id: 'fa', side: 'right' } };
  it('節點在：位置跟著節點、左右側變直式', () => {
    const r = resolveText(t, id => (id === 'fa' ? { x: 100, y: 100 } : null), R);
    expect(r.vertical).toBe(true);
    expect(r.x).not.toBe(5);
  });
  it('節點不見了：停在存著的位置', () => {
    const r = resolveText(t, () => null, R);
    expect(r).toMatchObject({ x: 5, y: 5, vertical: false });
    expect(r.anchor).toBeUndefined();
  });
});

describe('pickSide', () => {
  const n = { x: 0, y: 0 };
  it('依方向', () => {
    expect(pickSide(n, { x: 0, y: 30 })).toBe('bottom');
    expect(pickSide(n, { x: 0, y: -30 })).toBe('top');
    expect(pickSide(n, { x: -30, y: 5 })).toBe('left');
    expect(pickSide(n, { x: 30, y: 5 })).toBe('right');
  });
  it('斜角附近維持目前的邊，不來回跳', () => {
    expect(pickSide(n, { x: 30, y: 33 }, 'right')).toBe('right');
    expect(pickSide(n, { x: 33, y: 30 }, 'bottom')).toBe('bottom');
    expect(pickSide(n, { x: 30, y: 60 }, 'right')).toBe('bottom');
  });
});

describe('snapWhileDragging', () => {
  const t = { id: 't', text: '王小明', fontSize: 14 };
  const nodes = [{ id: 'a', x: 100, y: 100 }, { id: 'b', x: 300, y: 100 }];
  it('拖到節點下方就吸上去', () => {
    expect(snapWhileDragging(t, { x: 100, y: 140 }, nodes, R)).toEqual({ id: 'a', side: 'bottom' });
  });
  it('拖到節點左邊吸在左側', () => {
    expect(snapWhileDragging(t, { x: 65, y: 100 }, nodes, R)).toEqual({ id: 'a', side: 'left' });
  });
  it('離每個節點都遠就不吸', () => {
    expect(snapWhileDragging(t, { x: 200, y: 250 }, nodes, R)).toBeNull();
  });
  it('吸在最近的那一個', () => {
    expect(snapWhileDragging(t, { x: 300, y: 60 }, nodes, R)).toEqual({ id: 'b', side: 'top' });
  });
  it('已經吸著的要拉比較遠才放開', () => {
    const anchored = { ...t, anchor: { id: 'a', side: 'bottom' } };
    expect(snapWhileDragging(t, { x: 100, y: 175 }, nodes, R)).toBeNull();
    expect(snapWhileDragging(anchored, { x: 100, y: 175 }, nodes, R)).toEqual({ id: 'a', side: 'bottom' });
  });
});

describe('textCenter／xyForCenter', () => {
  it('橫式與直式互換時，中心不動', () => {
    const t = { x: 0, y: 0, text: '王小明', fontSize: 14 };
    const c = { x: 120, y: 80 };
    for (const vertical of [false, true]) {
      const placed = { ...t, ...xyForCenter(t, vertical, c) };
      const back = textCenter(placed, vertical);
      expect(back.x).toBeCloseTo(c.x);
      expect(back.y).toBeCloseTo(c.y);
    }
  });
});

describe('detachTextsFrom', () => {
  it('解開綁在該節點的標籤，停在目前畫面上的位置', () => {
    const texts = [
      { id: '1', x: 0, y: 0, text: '甲', fontSize: 14, anchor: { id: 'f1', side: 'bottom' } },
      { id: '2', x: 0, y: 0, text: '乙', fontSize: 14, anchor: { id: 'f2', side: 'bottom' } },
    ];
    const posOf = id => ({ f1: { x: 100, y: 100 }, f2: { x: 300, y: 100 } }[id] || null);
    const next = detachTextsFrom(texts, 'f1', posOf, R);
    expect(next[0].anchor).toBeUndefined();
    expect(next[0].x).toBeCloseTo(resolveText(texts[0], posOf, R).x);
    expect(next[1]).toBe(texts[1]);
  });
  it('沒有綁定時回傳原陣列（不產生多餘的復原紀錄）', () => {
    const texts = [{ id: '1', x: 0, y: 0, text: '甲', fontSize: 14 }];
    expect(detachTextsFrom(texts, 'x', () => null, R)).toBe(texts);
  });
});

describe('duplicateText', () => {
  it('照抄內容與字級、不帶綁定、錯開位置', () => {
    const src = { id: '1', x: 0, y: 0, text: '務農', fontSize: 20, anchor: { id: 'fa', side: 'left' } };
    const shown = { ...src, x: 50, y: 60, vertical: true };
    const copy = duplicateText(src, shown, 'new');
    expect(copy).toEqual({ id: 'new', x: 70, y: 80, text: '務農', fontSize: 20, vertical: true });
  });
});
