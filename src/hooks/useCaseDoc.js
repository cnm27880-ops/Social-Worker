import { useCallback, useEffect, useRef, useState } from 'react';
import {
  INITIAL_DOC, toggleAttr, toggleLineAttr, clearAttrs, clearLineAttr,
} from '../utils/caseDoc';
import {
  openLibrary, readCaseDoc, writeCaseDoc, writeIndex, touchCase,
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
const QUOTA_MSG = '本機儲存空間不足，無法儲存案件。若有匯入舊圖，可先移除底圖再存，或匯出成 .json 保存。';

export function useCaseDoc() {
  /* 只初始化一次：讀出案件清單，但**不開啟任何案件**。
   * 每次開啟網頁都是一張乾淨的空白畫布，使用者按下「儲存案件」以前
   * 什麼都不落地（無痕畫布）。 */
  const [boot] = useState(() => openLibrary());
  const [index, setIndex] = useState(boot.index);
  const [doc, setDocRaw] = useState(() => ({ ...INITIAL_DOC }));

  /* --- 歷史堆疊 ---
   * 放在 ref 而不是 state：復原/重做只透過鍵盤觸發，沒有需要跟著堆疊
   * 深度重繪的 UI（原本有一組按鈕要顯示 disabled，計數器是為它們存在的）。
   * setDocRaw 本身就會觸發重繪，不需要額外的版本計數器。 */
  const past = useRef([]);
  const future = useRef([]);

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
    }

    lastCommit.current = { at: now, key };
    prevDoc.current = doc;
  }, [doc]);

  /* --- 後續變更的自動存檔（節流）---
   * 只有「已經按過儲存」的案件才會落地：activeId 是 null 時什麼都不寫。
   * 這是無痕畫布與案件庫的分界線。
   *
   * 刻意不記「上次存檔時間」：面板上不顯示它，留著只是每 800ms 多觸發
   * 一次沒人看的 render。存檔時間仍寫進案件索引的 updatedAt。 */
  useEffect(() => {
    const id = index.activeId;
    if (!id) return;
    const t = setTimeout(() => {
      if (!writeCaseDoc(id, doc)) return;
      setIndex(prev => {
        const next = touchCase(prev, id);
        writeIndex(next);
        return next;
      });
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [doc, index.activeId]);

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
  }, []);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    const next = future.current.pop();
    past.current.push(prevDoc.current);
    skipHistory.current = true;
    lastCommit.current = { at: 0, key: null };
    setDocRaw(next);
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

  /** 清掉一個節點身上的所有標記（「清除」模式點人物用） */
  const clearNodeAttrsCb = useCallback((id) => {
    pendingKey.current = `__clear_${id}`;
    setDocRaw(prev => ({ ...prev, nodeAttrs: clearAttrs(prev.nodeAttrs, id) }));
  }, []);

  /** 清掉一條線的關係品質標記（「清除」模式點婚姻線用） */
  const clearLineAttrCb = useCallback((lineId) => {
    pendingKey.current = `__clearLine_${lineId}`;
    setDocRaw(prev => ({ ...prev, lineAttrs: clearLineAttr(prev.lineAttrs, lineId) }));
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
  }, []);

  /** 把另一份文件載進編輯器：不記歷史，並清掉前一份案件的歷史 */
  const loadIntoEditor = useCallback((nextDoc) => {
    skipHistory.current = true;
    clearHistory();
    setDocRaw(nextDoc);
  }, [clearHistory]);

  /** 立刻把目前的編輯寫回案件（未儲存的草稿不寫）。 */
  const flushActive = useCallback(() => {
    if (!activeIdRef.current) return;
    writeCaseDoc(activeIdRef.current, docRef.current);
  }, []);

  /* =========================================================================
   * 時間軸快照
   *
   * 跟復原/重做不同：快照存在 localStorage，重新整理仍在，可以隨時跳回去。
   * 但它跟著「案件」走 —— 未儲存的無痕畫布沒有案件可掛，也就沒有時間軸；
   * 使用者按下「儲存案件」的那一刻，時間軸才開始。
   * ======================================================================= */

  const [snapshots, setSnapshots] = useState([]);

  /** 寫一份快照到指定案件，並刷新清單。 */
  const snapshotInto = useCallback((caseId, name) => {
    if (!caseId) return null;
    const snap = saveSnapshot(caseId, name, docRef.current);
    setSnapshots(listSnapshots(caseId));
    return snap;
  }, []);

  // 切換／新建／關閉案件後，快照清單也要換成那份案件自己的（未儲存則是空的）
  useEffect(() => {
    setSnapshots(index.activeId ? listSnapshots(index.activeId) : []);
  }, [index.activeId]);

  const takeSnapshot = useCallback((name) => snapshotInto(activeIdRef.current, name), [snapshotInto]);

  const removeSnapshot = useCallback((snapshotId) => {
    if (!activeIdRef.current) return;
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

  /**
   * 儲存案件。這是「無痕畫布」變成「有紀錄的案件」的唯一入口。
   *
   *   還沒儲存過 → 在案件庫建一份新案件，並開始記錄時間軸與後續自動存檔
   *   已經儲存過 → 立刻寫回，並在時間軸上留一個節點
   *
   * 每次儲存都順手存一份快照，儲存與時間軸因此是同一個動作的兩面：
   * 使用者不必分別記得「要存檔」和「要留紀錄」。
   */
  const saveCase = useCallback((name) => {
    const id = activeIdRef.current;

    if (id) {
      if (!writeCaseDoc(id, docRef.current)) throw new Error(QUOTA_MSG);
      const touched = touchCase(indexRef.current, id);
      const next = name?.trim() ? renameCaseIn(touched, id, name) : touched;
      commitIndex(next);
      snapshotInto(id, null);
      return next.list.find(c => c.id === id) || null;
    }

    const { index: next, id: newId } = addCase(indexRef.current, name);
    if (!writeCaseDoc(newId, docRef.current)) throw new Error(QUOTA_MSG);
    commitIndex(next);
    snapshotInto(newId, '建立案件');
    return next.list.find(c => c.id === newId) || null;
  }, [commitIndex, snapshotInto]);

  const renameCase = useCallback((id, name) => {
    commitIndex(renameCaseIn(indexRef.current, id, name));
  }, [commitIndex]);

  const deleteCase = useCallback((id) => {
    clearSnapshots(id); // 案件不在了，屬於它的時間軸快照也沒有意義了
    const { index: next, closedActive } = removeCase(indexRef.current, id);
    commitIndex(next);
    // 刪掉的是正在編輯的那一份：回到未儲存的空白畫布
    if (closedActive) loadIntoEditor({ ...INITIAL_DOC });
  }, [commitIndex, loadIntoEditor]);

  const activeCase = index.list.find(c => c.id === index.activeId) || null;

  /** 匯出目前畫布。未儲存的草稿也能匯出（檔名用「未命名案件」）。 */
  const exportCase = useCallback(() => {
    const current = indexRef.current;
    const entry = current.list.find(c => c.id === current.activeId);
    downloadCaseFile(entry?.name || '未命名案件', docRef.current);
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
    toggleNodeAttr,
    toggleLineAttr: toggleLineAttrCb,
    clearNodeAttrs: clearNodeAttrsCb,
    clearLineAttr: clearLineAttrCb,


    cases: index.list,
    activeCaseId: index.activeId,
    activeCase,
    isSaved: !!index.activeId,
    switchCase,
    saveCase,
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
