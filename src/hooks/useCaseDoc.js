import { useCallback, useEffect, useRef, useState } from 'react';
import {
  INITIAL_DOC, idsWithAttr, setAttrIds, toggleAttr, toggleLineAttr,
} from '../utils/caseDoc';
import {
  initLibrary, readCaseDoc, writeCaseDoc, writeIndex, touchCase,
  addCase, renameCaseIn, removeCase, downloadCaseFile, parseCaseFile,
} from '../utils/caseStore';
import {
  listSnapshots, saveSnapshot, deleteSnapshot, readSnapshotDoc, clearSnapshots,
} from '../utils/snapshotStore';

/* 連續同一個欄位的修改，在這個時間窗內視為一次操作。
 * 沒有這個，拖曳一次節點會產生上百筆歷史，按復原要按到天荒地老。 */
const COALESCE_MS = 450;

/** 歷史上限。每筆是一份完整文件快照，但文件本身很小，200 筆很輕。 */
const MAX_HISTORY = 200;

/** 自動存檔的節流間隔。 */
const AUTOSAVE_MS = 800;

/**
 * 案件文件的狀態容器。
 *
 * 對外提供的 setField(key) 回傳的 setter 與 useState 的 setter 同介面
 * （吃值或吃 updater function），所以既有元件把
 *     const [positions, setPositions] = useState({})
 * 換成
 *     const positions = doc.positions, setPositions = setField('positions')
 * 之後，元件內部所有呼叫點都不用改。
 */
export function useCaseDoc() {
  /* 只初始化一次：讀出案件索引與目前開啟的那份文件 */
  const [boot] = useState(() => initLibrary());
  const [index, setIndex] = useState(boot.index);
  const [doc, setDocRaw] = useState(boot.doc);

  /* --- 歷史堆疊 ---
   * 放在 ref 避免每次 push 都觸發 render；按鈕的可用狀態另外用
   * histVersion 這個計數器驅動重繪。 */
  const past = useRef([]);
  const future = useRef([]);
  const [histVersion, setHistVersion] = useState(0);

  const prevDoc = useRef(doc);
  const skipHistory = useRef(false);
  const pendingKey = useRef(null);
  const lastCommit = useRef({ at: 0, key: null });

  /* setter 身分要穩定，否則相依於 setter 的 useEffect 會不斷重跑 */
  const setterCache = useRef({});

  /* 讓 useCallback 讀得到最新值又不必列進相依 */
  const docRef = useRef(doc); docRef.current = doc;
  const indexRef = useRef(index); indexRef.current = index;
  const activeIdRef = useRef(index.activeId); activeIdRef.current = index.activeId;

  /* --- 記錄歷史 ---
   * 用 effect 而不是在 updater 裡動 ref：updater 在 React 可能被重複呼叫，
   * 在裡面做副作用會導致歷史被推兩次。 */
  useEffect(() => {
    if (prevDoc.current === doc) return;

    // 復原/重做、以及切換案件造成的替換，本身不該再被記進歷史
    if (skipHistory.current) {
      skipHistory.current = false;
      prevDoc.current = doc;
      return;
    }

    const now = Date.now();
    const key = pendingKey.current;
    const coalesce =
      key !== null &&
      key === lastCommit.current.key &&
      now - lastCommit.current.at < COALESCE_MS;

    if (!coalesce) {
      past.current.push(prevDoc.current);
      if (past.current.length > MAX_HISTORY) past.current.shift();
      future.current = [];
      setHistVersion(v => v + 1);
    }

    lastCommit.current = { at: now, key };
    prevDoc.current = doc;
  }, [doc]);

  /* --- 自動存檔（節流）：只覆寫目前這一份案件 ---
   * 刻意不記「上次存檔時間」：面板上不再顯示它，留著就只是每 800ms
   * 多觸發一次沒人看的 render。存檔時間仍寫進案件索引的 updatedAt，
   * 案件切換選單看得到。 */
  useEffect(() => {
    const t = setTimeout(() => {
      const id = activeIdRef.current;
      if (!writeCaseDoc(id, doc)) return;
      setIndex(prev => {
        const next = touchCase(prev, id);
        writeIndex(next);
        return next;
      });
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [doc]);

  /* --- 欄位 setter --- */
  const setField = useCallback((key) => {
    if (!setterCache.current[key]) {
      setterCache.current[key] = (valueOrFn) => {
        pendingKey.current = key;
        setDocRaw(prev => {
          const cur = prev[key];
          const next = typeof valueOrFn === 'function' ? valueOrFn(cur) : valueOrFn;
          if (Object.is(next, cur)) return prev;
          return { ...prev, [key]: next };
        });
      };
    }
    return setterCache.current[key];
  }, []);

  /**
   * 一次改多個欄位並算成單一筆歷史（重置、匯入、套用範本用）。
   * label 只是給歷史合併判斷用的識別字串。
   */
  const patchDoc = useCallback((patch, label = null) => {
    pendingKey.current = label ?? `__patch_${Date.now()}`;
    setDocRaw(prev => ({ ...prev, ...patch }));
  }, []);

  /* --- 復原 / 重做 --- */
  const undo = useCallback(() => {
    if (!past.current.length) return;
    const prev = past.current.pop();
    future.current.push(prevDoc.current);
    skipHistory.current = true;
    lastCommit.current = { at: 0, key: null };
    setDocRaw(prev);
    setHistVersion(v => v + 1);
  }, []);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    const next = future.current.pop();
    past.current.push(prevDoc.current);
    skipHistory.current = true;
    lastCommit.current = { at: 0, key: null };
    setDocRaw(next);
    setHistVersion(v => v + 1);
  }, []);

  /* --- Ctrl/⌘ + Z 復原、Ctrl/⌘ + Shift + Z（或 Ctrl+Y）重做 --- */
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  /* --- 相容層 ---
   * 既有的 GenogramTab / RecordTab 是用 deceasedIds / disabledIds 兩個
   * 陣列在讀寫的。這裡把它們接到 nodeAttrs 上，讓那些元件不用改。
   * 之後積木工具箱做好、呼叫點都改用 nodeAttrs 後即可移除。 */
  const attrListSetter = useCallback((attr) => {
    const cacheKey = `__attr_${attr}`;
    if (!setterCache.current[cacheKey]) {
      setterCache.current[cacheKey] = (valueOrFn) => {
        pendingKey.current = cacheKey;
        setDocRaw(prev => {
          const cur = idsWithAttr(prev.nodeAttrs, attr);
          const next = typeof valueOrFn === 'function' ? valueOrFn(cur) : valueOrFn;
          return { ...prev, nodeAttrs: setAttrIds(prev.nodeAttrs, attr, next) };
        });
      };
    }
    return setterCache.current[cacheKey];
  }, []);

  /** 切換單一節點的單一標記（積木工具箱拖曳貼附用） */
  const toggleNodeAttr = useCallback((id, attr) => {
    pendingKey.current = `__toggle_${id}_${attr}`;
    setDocRaw(prev => ({ ...prev, nodeAttrs: toggleAttr(prev.nodeAttrs, id, attr) }));
  }, []);

  /** 切換一條線的關係品質標記（積木工具箱拖曳貼附到婚姻線用） */
  const toggleLineAttrCb = useCallback((lineId, key) => {
    pendingKey.current = `__lineAttr_${lineId}`;
    setDocRaw(prev => ({ ...prev, lineAttrs: toggleLineAttr(prev.lineAttrs, lineId, key) }));
  }, []);

  /* =========================================================================
   * 案件管理
   *
   * 每次切走之前都先把目前這份立刻寫回，不等 800ms 的節流 —— 否則剛改完
   * 就切換案件會掉最後幾秒的編輯。
   * ======================================================================= */

  const clearHistory = useCallback(() => {
    past.current = [];
    future.current = [];
    lastCommit.current = { at: 0, key: null };
    setHistVersion(v => v + 1);
  }, []);

  /** 把另一份文件載進編輯器：不記歷史，並清掉前一份案件的歷史 */
  const loadIntoEditor = useCallback((nextDoc) => {
    skipHistory.current = true;
    clearHistory();
    setDocRaw(nextDoc);
  }, [clearHistory]);

  const flushActive = useCallback(() => {
    writeCaseDoc(activeIdRef.current, docRef.current);
  }, []);

  const commitIndex = useCallback((next) => {
    writeIndex(next);
    setIndex(next);
  }, []);

  const switchCase = useCallback((id) => {
    if (id === activeIdRef.current) return;
    flushActive();
    commitIndex({ ...indexRef.current, activeId: id });
    loadIntoEditor(readCaseDoc(id));
  }, [flushActive, commitIndex, loadIntoEditor]);

  const createCase = useCallback(() => {
    flushActive();
    const { index: next, id } = addCase(indexRef.current);
    const fresh = { ...INITIAL_DOC };
    writeCaseDoc(id, fresh);
    commitIndex(next);
    loadIntoEditor(fresh);
    return id;
  }, [flushActive, commitIndex, loadIntoEditor]);

  const renameCase = useCallback((id, name) => {
    commitIndex(renameCaseIn(indexRef.current, id, name));
  }, [commitIndex]);

  const deleteCase = useCallback((id) => {
    clearSnapshots(id); // 案件不在了，屬於它的時間軸快照也沒有意義了
    const { index: next, needsNewCase } = removeCase(indexRef.current, id);

    // 刪到一份都不剩：直接開一份空的，不要讓使用者面對空畫面
    if (needsNewCase) {
      const { index: withNew, id: newId } = addCase(next);
      const fresh = { ...INITIAL_DOC };
      writeCaseDoc(newId, fresh);
      commitIndex(withNew);
      loadIntoEditor(fresh);
      return;
    }

    const wasActive = id === activeIdRef.current;
    commitIndex(next);
    if (wasActive) loadIntoEditor(readCaseDoc(next.activeId));
  }, [commitIndex, loadIntoEditor]);

  const activeCase = index.list.find(c => c.id === index.activeId) || null;

  /* =========================================================================
   * 時間軸快照
   *
   * 跟復原/重做不同：快照是使用者主動按下才存的一份「留念」，重新整理
   * 瀏覽器也還在，可以隨時跳回去看，但不是自動記錄的每一步。
   * ======================================================================= */

  const [snapshots, setSnapshots] = useState(() => listSnapshots(index.activeId));

  // 切換案件後，快照清單也要換成那份案件自己的
  useEffect(() => {
    setSnapshots(listSnapshots(index.activeId));
  }, [index.activeId]);

  const takeSnapshot = useCallback((name) => {
    const snap = saveSnapshot(activeIdRef.current, name, docRef.current);
    setSnapshots(listSnapshots(activeIdRef.current));
    return snap;
  }, []);

  const removeSnapshot = useCallback((snapshotId) => {
    setSnapshots(deleteSnapshot(activeIdRef.current, snapshotId));
  }, []);

  /** 還原一份快照到目前編輯畫面：當成一次一般編輯，可以再用 Ctrl+Z 復原這次還原。 */
  const restoreSnapshot = useCallback((snapshotId) => {
    const snapDoc = readSnapshotDoc(activeIdRef.current, snapshotId);
    if (!snapDoc) return false;
    pendingKey.current = `__restoreSnapshot_${snapshotId}_${Date.now()}`;
    setDocRaw(snapDoc);
    return true;
  }, []);

  const exportCase = useCallback(() => {
    const current = indexRef.current;
    const entry = current.list.find(c => c.id === current.activeId);
    downloadCaseFile(entry?.name || '案件', docRef.current);
  }, []);

  /** 匯入永遠是「新增一份」，不覆蓋目前開著的案件。 */
  const importCase = useCallback(async (file) => {
    const { name, doc: imported } = await file.text().then(parseCaseFile);
    flushActive();
    const { index: next, id } = addCase(indexRef.current, name || undefined);
    writeCaseDoc(id, imported);
    commitIndex(next);
    loadIntoEditor(imported);
    return next.list.find(c => c.id === id);
  }, [flushActive, commitIndex, loadIntoEditor]);

  /* 關掉分頁前把最後的編輯寫回，補上節流的空窗 */
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushActive(); };
    window.addEventListener('pagehide', flushActive);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flushActive);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flushActive]);

  return {
    doc,
    setField,
    patchDoc,
    attrListSetter,
    toggleNodeAttr,
    toggleLineAttr: toggleLineAttrCb,

    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    histVersion,


    cases: index.list,
    activeCaseId: index.activeId,
    activeCase,
    switchCase,
    createCase,
    renameCase,
    deleteCase,
    exportCase,
    importCase,

    snapshots,
    takeSnapshot,
    restoreSnapshot,
    removeSnapshot,
  };
}
