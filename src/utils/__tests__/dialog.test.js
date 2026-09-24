import { describe, it, expect } from 'vitest';
import { confirmDialog, alertDialog, closeDialog, subscribeDialog } from '../dialog';

describe('dialog', () => {
  it('確定回傳 true、取消回傳 false，畫面會收到開關通知', async () => {
    const seen = [];
    const off = subscribeDialog(d => seen.push(d ? d.opts.kind : null));
    const p1 = confirmDialog({ message: 'A', danger: true });
    closeDialog(true);
    expect(await p1).toBe(true);
    const p2 = confirmDialog({ message: 'B' });
    closeDialog(false);
    expect(await p2).toBe(false);
    off();
    expect(seen).toEqual(['confirm', null, 'confirm', null]);
  });
  it('前一個還開著又開新的：舊的當作取消', async () => {
    const p1 = confirmDialog({ message: 'A' });
    const p2 = alertDialog({ message: 'B' });
    expect(await p1).toBe(false);
    closeDialog(true);
    expect(await p2).toBe(true);
  });
});
