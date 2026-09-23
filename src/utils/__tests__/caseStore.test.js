import { describe, it, expect } from 'vitest';
import {
  addCase, updateCaseMeta, copyName, filterSortCases, storageUsage,
  buildBackup, parseCaseFile, buildExport, BACKUP_KIND, readIndex,
} from '../caseStore';
import { INITIAL_DOC } from '../caseDoc';

const empty = { v: 1, activeId: null, lastBackupAt: null, list: [] };

describe('addCase', () => {
  it('預設打開新案件，並補上建立時間、案號、備註', () => {
    const { index, id } = addCase(empty, '案主 A');
    expect(index.activeId).toBe(id);
    expect(index.list[0]).toMatchObject({ name: '案主 A', caseNo: '', note: '' });
    expect(index.list[0].createdAt).toBeTypeOf('number');
  });
  it('還原備份時不切換過去，並沿用原本的案號與時間', () => {
    const { index } = addCase({ ...empty, activeId: 'x' }, '甲', { caseNo: 'A-1', createdAt: 5, updatedAt: 6 }, { open: false });
    expect(index.activeId).toBe('x');
    expect(index.list[0]).toMatchObject({ caseNo: 'A-1', createdAt: 5, updatedAt: 6 });
  });
});

describe('updateCaseMeta', () => {
  it('改案號、備註；名稱清空視為不改', () => {
    const { index, id } = addCase(empty, '甲');
    const next = updateCaseMeta(index, id, { name: '  ', caseNo: ' 113-045 ', note: '高風險' });
    expect(next.list[0]).toMatchObject({ name: '甲', caseNo: '113-045', note: '高風險' });
  });
});

describe('copyName', () => {
  it('加（副本），重複就加編號', () => {
    expect(copyName([{ name: '甲' }], '甲')).toBe('甲（副本）');
    expect(copyName([{ name: '甲（副本）' }], '甲')).toBe('甲（副本）2');
  });
});

describe('filterSortCases', () => {
  const list = [
    { id: '1', name: '王家', caseNo: 'A-2', note: '', createdAt: 1, updatedAt: 30 },
    { id: '2', name: '李家', caseNo: '', note: '高風險', createdAt: 3, updatedAt: 10 },
    { id: '3', name: '陳家', caseNo: 'B-9', note: '', createdAt: 2, updatedAt: 20 },
  ];
  it('名稱、案號、備註都搜得到', () => {
    expect(filterSortCases(list, '王').map(c => c.id)).toEqual(['1']);
    expect(filterSortCases(list, 'b-9').map(c => c.id)).toEqual(['3']);
    expect(filterSortCases(list, '風險').map(c => c.id)).toEqual(['2']);
  });
  it('排序：最近編輯、建立時間', () => {
    expect(filterSortCases(list, '', 'updated').map(c => c.id)).toEqual(['1', '3', '2']);
    expect(filterSortCases(list, '', 'created').map(c => c.id)).toEqual(['2', '3', '1']);
  });
  it('不改動傳入的陣列', () => {
    const copy = [...list];
    filterSortCases(list, '', 'name');
    expect(list).toEqual(copy);
  });
});

describe('storageUsage', () => {
  it('只算本站的 key', () => {
    const data = { 'genogram-cases': 'abc', 'genogram-case-1': '12345', other: 'xxxxxxxx' };
    const fake = { length: 3, key: i => Object.keys(data)[i], getItem: k => data[k] };
    expect(storageUsage(fake).used).toBe('genogram-cases'.length + 3 + 'genogram-case-1'.length + 5);
  });
});

describe('備份與還原', () => {
  it('整包備份可以原樣解析回來', () => {
    const list = [
      { id: 'a', name: '甲', caseNo: 'A-1', note: 'n', createdAt: 1, updatedAt: 2 },
      { id: 'b', name: '乙', caseNo: '', note: '', createdAt: 3, updatedAt: 4 },
    ];
    const docs = { a: { ...INITIAL_DOC, gen2Str: '男' }, b: { ...INITIAL_DOC, gen2Str: '女女' } };
    const payload = buildBackup(list, id => docs[id]);
    expect(payload.kind).toBe(BACKUP_KIND);
    const parsed = parseCaseFile(JSON.stringify(payload));
    expect(parsed.kind).toBe('backup');
    expect(parsed.cases.map(c => c.name)).toEqual(['甲', '乙']);
    expect(parsed.cases[0].meta).toMatchObject({ caseNo: 'A-1', note: 'n', createdAt: 1 });
    expect(parsed.cases[1].doc.gen2Str).toBe('女女');
  });
  it('壞掉的那一份跳過，其他照樣還原', () => {
    const text = JSON.stringify({ kind: BACKUP_KIND, cases: [{ name: '壞', doc: 'oops' }, { name: '好', doc: {} }] });
    expect(parseCaseFile(text).cases.map(c => c.name)).toEqual(['好']);
  });
  it('整包都壞掉就報錯', () => {
    expect(() => parseCaseFile(JSON.stringify({ kind: BACKUP_KIND, cases: [] }))).toThrow();
  });
  it('單一案件檔照舊可以匯入', () => {
    const parsed = parseCaseFile(JSON.stringify(buildExport('甲', INITIAL_DOC)));
    expect(parsed).toMatchObject({ kind: 'case', name: '甲' });
  });
});

describe('readIndex：舊版索引', () => {
  it('沒有 caseNo／createdAt 的舊資料補預設值', () => {
    const store = { 'genogram-cases': JSON.stringify({ v: 1, activeId: 'a', list: [{ id: 'a', name: '甲', updatedAt: 9 }] }) };
    globalThis.localStorage = { getItem: k => store[k] ?? null };
    const idx = readIndex();
    expect(idx.list[0]).toEqual({ id: 'a', name: '甲', caseNo: '', note: '', createdAt: 9, updatedAt: 9 });
    expect(idx.lastBackupAt).toBeNull();
    delete globalThis.localStorage;
  });
});
