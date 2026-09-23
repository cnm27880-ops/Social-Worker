import { describe, it, expect } from 'vitest';
import { computeCropBox, exportBaseName } from '../exportImage';

describe('computeCropBox', () => {
  it('什麼都沒有回傳 null', () => {
    expect(computeCropBox({})).toBeNull();
  });
  it('一個節點：外加 40px 留白', () => {
    expect(computeCropBox({ nodePts: [{ x: 100, y: 100 }] })).toEqual({ minX: 42, minY: 42, w: 116, h: 116 });
  });
  it('文字方塊（例如吸在節點旁的標籤）也算進去，不會被切掉', () => {
    const only = computeCropBox({ nodePts: [{ x: 100, y: 100 }] });
    const withLabel = computeCropBox({
      nodePts: [{ x: 100, y: 100 }],
      texts: [{ x: 60, y: 160, text: '王小明很長的名字', fontSize: 16 }],
    });
    expect(withLabel.h).toBeGreaterThan(only.h);
    expect(withLabel.minX + withLabel.w).toBeGreaterThan(only.minX + only.w);
  });
});

describe('exportBaseName', () => {
  it('Windows 不允許的字元換掉；沒有名稱用 genogram', () => {
    expect(exportBaseName('王/小:明?')).toBe('王_小_明_');
    expect(exportBaseName(undefined)).toBe('genogram');
  });
});
