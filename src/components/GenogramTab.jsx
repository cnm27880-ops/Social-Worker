import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  SZ, R, COUPLE_GAP, SIBLING_GAP, GEN_Y, TEXT_FONT,
  G2_STATUSES, G2_LABELS, G1_STATUSES, G1_LABELS,
  TEXT_DIRS, TEXT_DIR_LABELS,
  parseGenders, getSmoothPath, getRelativeTitle, getGen2Title,
  computeMainLayout, centeredG1
} from '../utils/helpers';
import CaseBar from './CaseBar';
import ImagePatchPanel from './ImagePatchPanel';
import InfoTip from './InfoTip';
import { SymbolPreview, loadUsage, bumpUsage } from './SymbolPreview';
import { BG_X, BG_Y, bgImageBox } from '../utils/bgImage';
import {
  SYMBOL_MAP, QUICK_KEYS, QUICK_SYMBOLS,
  halfPath, healthHalvesFor, divisionSegments, kinshipDashFor,
  quarterPath,
  CLINICAL_FILL, CLINICAL_STROKE, CLINICAL_STROKE_W,
  trianglePath, triangleCrossLines,
  zigzagPoints, gapSegments, doubleLineSegments, hatchSegments, distToSegment, DISTANT_DASH,
} from '../utils/symbols';

/* 獨立個體（懷孕／流產／死產）用的三角形半徑：跟人物節點（正方形／圓形）
 * 一樣大，畫布上才不會顯得特別小。 */
const STANDALONE_TYPES = ['pregnancy', 'miscarriage', 'stillbirth'];
const standaloneRadius = () => R;

const CUSTOM_LINK_STATUSES = ['married', 'divorced'];
const CUSTOM_LINK_LABELS = { married: '已婚', divorced: '離婚' };
const EXT_COLOR_MODES = ['black', 'blue'];
const EXT_COLOR_LABELS = { black: '一般', blue: '編輯' };

const ecoRx = (text) => Math.max(35, (text?.length || 1) * 9 + 15);
const ECO_RY = 28;

const GenogramTab = ({
  doc, setField, patchDoc, toggleNodeAttr, toggleLineAttr, clearNodeAttrs, clearLineAttr,
  cases, activeCaseId, activeCase, isSaved,
  switchCase, saveCase, renameCase, deleteCase, exportCase, importCase,
  snapshots, takeSnapshot, restoreSnapshot, removeSnapshot,
  gen2Str, setGen2Str, gen2Cfg, setGen2Cfg,
  indexId, setIndexId,
  cohabMembers, setCohabMembers,
  deceasedIds,
  disabledIds,
  g1Status, setG1Status,
  freeNodes, setFreeNodes,
  customLinks, setCustomLinks
}) => {
  /* --- 案件文件欄位 ---
   * 這些以前是本地 useState，現在讀寫都經過案件文件，才能被復原與自動存檔
   * 涵蓋。setField 回傳的 setter 與 useState 的 setter 同介面，所以下面所有
   * 呼叫點都維持原樣。 */
  const positions = doc.positions,      setPositions = setField('positions');
  const cohabMode = doc.cohabMode,      setCohabMode = setField('cohabMode');
  const cohabSolid = doc.cohabSolid,    setCohabSolid = setField('cohabSolid');
  const ipStyle = doc.ipStyle,          setIpStyle = setField('ipStyle');
  const polygons = doc.polygons,        setPolygons = setField('polygons');

  /* --- 舊圖修補 --- */
  const bgImage = doc.bgImage,          setBgImage = setField('bgImage');
  const bgErase = doc.bgErase,          setBgErase = setField('bgErase');

  /* --- 純 UI 暫態：不進復原、不存檔 --- */
  const [eraseMode, setEraseMode] = useState(false);
  const [eraseWidth, setEraseWidth] = useState(24);
  const [eraseDraft, setEraseDraft] = useState(null);   // 正在畫的那一筆
  const [drag, setDrag] = useState(null);
  const [usage, setUsage] = useState(loadUsage);   // 符號使用次數：決定快捷列表內的排序
  const [mode, setMode] = useState(null);
  /* 快捷列表目前選到第幾個（0-based，順序見 QUICK_KEYS）。Q 重新開啟時
   * 從上次的位置繼續，不用每次都從頭數。 */
  const [quickIdx, setQuickIdx] = useState(0);
  const [draftPoly, setDraftPoly] = useState([]);
  const [selectedPolyId, setSelectedPolyId] = useState(null);
  const [dragVertex, setDragVertex] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e) => { if (!exportMenuRef.current?.contains(e.target)) setExportOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [exportOpen]);

  // 持續同步的 ref，讓 useMemo / useCallback 可讀取最新值，但不觸發多餘的 re-compute
  const freeNodesRef = useRef(freeNodes);
  freeNodesRef.current = freeNodes;
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const texts = doc.texts,                    setTexts = setField('texts');
  const textDirection = doc.textDirection,    setTextDirection = setField('textDirection');
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [textDrag, setTextDrag] = useState(null);
  const [textResize, setTextResize] = useState(null);
  const textDragMoved = useRef(false);
  // 拖曳節點放開時瀏覽器仍會補發一次 click；沒有這個旗標，onClick 會把
  // 「剛拖完放手」誤判成「案主／身障／同住／死亡等模式下的一般點擊」，
  // 對剛搬移完位置的節點多蓋一個不該有的標記。
  const nodeDragMoved = useRef(false);
  const [mousePos, setMousePos] = useState(null);

  /* --- 擴充區顏色模式 --- */
  const extColorMode = doc.extColorMode,      setExtColorMode = setField('extColorMode');

  /* --- 年齡與文字編輯狀態 --- */
  const ages = doc.ages,                      setAges = setField('ages');
  const [editingAgeId, setEditingAgeId] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  const [editingEcoId, setEditingEcoId] = useState(null);

  const finishEditingText = (id, newText) => {
    setTexts(prev => prev.map(t => t.id === id ? { ...t, text: newText } : t));
    setEditingTextId(null);
  };
  const finishEditingAge = (id, newAge) => {
    setAges(prev => ({ ...prev, [id]: newAge }));
    setEditingAgeId(null);
  };

  /* ===== 畫布互動邏輯 ===== */
  const svgRef = useRef(null);
  const wheelRef = (el, list, current, setter) => {
    if (!el) return;
    el.onwheel = (e) => { e.preventDefault(); e.stopPropagation(); const next = (list.indexOf(current) + (e.deltaY > 0 ? 1 : -1) + list.length) % list.length; setter(list[next]); };
  };
  /** 點擊往前切到下一個狀態（跟滾輪往下同方向），滾輪仍可雙向切換。
   * 這批狀態標籤原本只能滾輪操作——滑鼠沒有滾輪（觸控板手勢因人而異）或
   * 不知道可以滾的人根本切不動，點擊是找得到的最低限度操作方式。 */
  const cycleOnClick = (list, current, setter) => (e) => {
    e.stopPropagation();
    const next = (list.indexOf(current) + 1) % list.length;
    setter(list[next]);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      /* 這裡全是單鍵快捷鍵，帶了 Ctrl／Cmd／Alt 的組合鍵不該落進來——
       * 否則 Ctrl+A（全選）會順手把符號選取打開、Ctrl+S 會偷偷換掉選中的符號。 */
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const quickActive = mode !== null && QUICK_KEYS.includes(mode);
      /* A：開／關快捷列表選取狀態，從上次選到的位置繼續。
       * S／D：只有選取狀態開著時才移動焦點——沒開著按了也不該有反應，
       * 否則使用者搞不清楚現在到底選中了什麼。
       * Q／W／E：案主／同住／年齡三個畫布模式，共用同一個 mode 狀態，
       *   所以天然互斥。清除模式（'clear'）目前沒有入口，見面板那段註解。 */
      if (key === 'a') setMode(quickActive ? null : QUICK_KEYS[quickIdx]);
      if (key === 's' && quickActive) {
        const next = (quickIdx - 1 + QUICK_KEYS.length) % QUICK_KEYS.length;
        setQuickIdx(next); setMode(QUICK_KEYS[next]);
      }
      if (key === 'd' && quickActive) {
        const next = (quickIdx + 1) % QUICK_KEYS.length;
        setQuickIdx(next); setMode(QUICK_KEYS[next]);
      }
      if (key === 'q') setMode(p => p === 'index' ? null : 'index');
      if (key === 'w') setMode(p => p === 'cohab' ? null : 'cohab');
      /* 進入年齡模式順便把年齡打開——要輸入年齡卻看不到年齡是沒有意義的。
       * 離開模式不會關掉顯示，年齡填完仍然留在畫布上。 */
      if (key === 'e') setMode(p => p === 'age' ? null : 'age');
      if (e.key === 'Enter' && mode === 'cohab' && cohabMode === 'poly' && draftPoly.length >= 3) {
        setPolygons(prev => [...prev, { id: 'pg_' + Date.now(), pts: draftPoly }]); setDraftPoly([]); setMousePos(null);
      }
      if (e.key === 'Escape' && draftPoly.length > 0) { setDraftPoly([]); setMousePos(null); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftPoly, mode, cohabMode, quickIdx]);

  /* 第二代的人數／配偶／第三代一變動，整排子女的寬度就跟著變，父母原本停的
   * 位置就不再是正中央。這裡把「改第二代」與「父母重新置中」寫成同一次更新：
   * 一來位置自動跟上不用每次手動拉，二來復原（Ctrl+Z）是一步回到底。 */
  const applyGen2Cfg = (nextCfg, patch = {}) => {
    const g1 = centeredG1(positions, nextCfg);
    patchDoc({
      ...patch,
      gen2Cfg: nextCfg,
      ...(g1 ? { positions: { ...positions, fa: g1.fa, mo: g1.mo } } : {}),
    }, 'gen2cfg');
  };

  const onGen2Change = (val) => {
    const gs = parseGenders(val);
    applyGen2Cfg(
      gs.map((g, i) => (gen2Cfg[i] && gen2Cfg[i].gender === g) ? gen2Cfg[i] : { gender: g, partner: 'none', g3Str: '', isMulti: false }),
      { gen2Str: val }
    );
  };

  const changePartner = (i, status) => applyGen2Cfg(gen2Cfg.map((d, j) => j === i ? { ...d, partner: status, g3Str: status === 'none' ? '' : d.g3Str } : d));
  const setG3 = (i, v) => applyGen2Cfg(gen2Cfg.map((d, j) => j === i ? { ...d, g3Str: v } : d));
  const toggleMulti = (i) => setGen2Cfg(p => p.map((d, j) => j === i ? { ...d, isMulti: !d.isMulti } : d));

  const addText = () => {
    const id = 'txt_' + Date.now();
    setTexts(prev => [...prev, { id, x: 300, y: 200, text: '文字', fontSize: 16, vertical: textDirection === 'vertical' }]);
  };
  const deleteText = (id) => {
    setTexts(prev => prev.filter(t => t.id !== id));
    setSelectedTextId(null);
  };

  const finishEditingEco = (id, newText) => {
    if (!newText.trim()) {
      // 清空文字 → 刪除該生態圖節點及相關連線
      setCustomLinks(prev => prev.filter(l => l.sourceId !== id && l.targetId !== id));
      setFreeNodes(prev => prev.filter(fn => fn.id !== id));
    } else {
      setFreeNodes(prev => prev.map(fn => fn.id === id ? { ...fn, text: newText } : fn));
    }
    setEditingEcoId(null);
  };

  /* --- 自由節點操作 --- */
  const addFreeNode = (gender) => {
    const id = 'f_' + Date.now();
    setFreeNodes(prev => [...prev, { id, gender, x: 500, y: 320 }]);
  };
  /** 新增獨立個體（目前僅「三角」）：跟 addFreeNode 一樣，點按鈕就在畫布上
   * 生出一個全新節點，不覆蓋任何既有節點——跟快捷列表「點人物套用標記」是兩回事。 */
  const addStandaloneNode = (type) => {
    const id = 'f_' + Date.now();
    setFreeNodes(prev => [...prev, { id, type, x: 500, y: 320 }]);
  };
  const addEcoNode = () => {
    const id = 'eco_' + Date.now();
    const hasIndex = !!indexId;
    const newNode = { id, type: 'eco', text: '資源名稱', x: hasIndex ? 650 : 100, y: hasIndex ? 100 : 100 };
    setFreeNodes(prev => [...prev, newNode]);
    if (hasIndex) {
      setCustomLinks(prev => [...prev, { id: 'l_' + Date.now(), sourceId: indexId, targetId: id, type: 'eco', status: 'married', kidsStr: '', kidsCfg: [] }]);
    }
  };
  const updateCustomLink = (linkId, field, val) => {
    setCustomLinks(prev => prev.map(l => l.id === linkId ? { ...l, [field]: val } : l));
  };
  const deleteCustomLink = (linkId) => {
    setCustomLinks(prev => prev.filter(l => l.id !== linkId));
  };

  const { nodes, lines } = useMemo(() => {
    const N = [], L = [];
    // 版面幾何（含第一代夫妻自動置中）與子女變動時的重新置中共用同一份計算
    const { units, fX, mX } = computeMainLayout(gen2Cfg);
    N.push({ id: 'fa', gender: 'M', gen: 0, dx: fX, dy: GEN_Y[0], label: '父' }, { id: 'mo', gender: 'F', gen: 0, dx: mX, dy: GEN_Y[0], label: '母' });
    L.push({ id: 'ml-g1', type: 'marry', a: 'fa', b: 'mo', status: g1Status });

    const g2ids = [];
    units.forEach((u, i) => {
      const cid = `c${i}`;
      if (u.isMarried) {
        const lx = u.x, rx = u.spouseX;
        const sid = `s${i}`, coupleMidX = (lx + rx) / 2;
        N.push({ id: cid, gender: u.gender, gen: 1, dx: lx, dy: GEN_Y[1], label: `${u.gender === 'M'?'子':'女'}${i+1}`, isMulti: u.isMulti });
        N.push({ id: sid, gender: u.gender === 'M'?'F':'M', gen: 1, dx: rx, dy: GEN_Y[1], label: '配偶' });
        L.push({ id: `ml-c${i}`, type: 'marry', a: cid, b: sid, status: u.partner });
        g2ids.push(cid);
        if (u.g3.length > 0) {
          const g3Start = coupleMidX - ((u.g3.length - 1) * SIBLING_GAP) / 2, g3ids = [];
          u.g3.forEach((g, j) => {
            const gid = `g${i}_${j}`;
            N.push({ id: gid, gender: g, gen: 2, dx: g3Start + j * SIBLING_GAP, dy: GEN_Y[2], label: `${g==='M'?'孫':'孫女'}${j+1}` });
            g3ids.push(gid);
          });
          L.push({ id: `pc-c${i}`, type: 'pc', pa: cid, pb: sid, kids: g3ids });
        }
      } else {
        N.push({ id: cid, gender: u.gender, gen: 1, dx: u.x, dy: GEN_Y[1], label: `${u.gender === 'M'?'子':'女'}${i+1}`, isMulti: u.isMulti });
        g2ids.push(cid);
      }
    });
    if (g2ids.length > 0) L.push({ id: 'pc-g1', type: 'pc', pa: 'fa', pb: 'mo', kids: g2ids });

    // === customLink kidsCfg → 整合為完全體節點 ===
    customLinks.forEach(lnk => {
      if (lnk.type === 'eco' || lnk.type === 'annotation') return; // 生態圖／獨立個體連線不參與節點生成
      if (!lnk.kidsCfg || lnk.kidsCfg.length === 0) return;
      const srcN = N.find(n => n.id === lnk.sourceId); const srcF = freeNodesRef.current.find(fn => fn.id === lnk.sourceId);
      const tgtN = N.find(n => n.id === lnk.targetId); const tgtF = freeNodesRef.current.find(fn => fn.id === lnk.targetId);
      
      // 修正座標抓取：強制讀取拖曳後的實際視覺座標，防止兩段婚姻小孩擠在同一個中心點
      const spx = positionsRef.current[lnk.sourceId]?.x ?? srcN?.dx ?? srcF?.x ?? 300;
      const spy = positionsRef.current[lnk.sourceId]?.y ?? srcN?.dy ?? srcF?.y ?? 160;
      const tpx = positionsRef.current[lnk.targetId]?.x ?? tgtN?.dx ?? tgtF?.x ?? 400;
      const tpy = positionsRef.current[lnk.targetId]?.y ?? tgtN?.dy ?? tgtF?.y ?? 160;

      const parentMidX = (spx + tpx) / 2, parentY = Math.max(spy, tpy), kidsY = parentY + 80;
      const kidUnits = lnk.kidsCfg.map((kc) => {
        const isMarried = kc.partner !== 'none'; const g3 = isMarried ? parseGenders(kc.g3Str || '') : [];
        const w = !isMarried ? SIBLING_GAP : Math.max(COUPLE_GAP + SZ, g3.length > 0 ? (g3.length - 1) * SIBLING_GAP + SZ : 0) + 50;
        return { ...kc, g3, w, isMarried };
      });
      const kidsTotalW = kidUnits.reduce((s, u) => s + u.w, 0) || SIBLING_GAP;
      let ckx = parentMidX - kidsTotalW / 2; const kidIds = [];
      kidUnits.forEach((ku, ki) => {
        const kidId = `${lnk.id}_c${ki}`, midU = ckx + ku.w / 2;
        if (ku.isMarried) {
          const lx = kidUnits.length === 1 ? parentMidX - COUPLE_GAP / 2 : midU - COUPLE_GAP / 2;
          const rx = kidUnits.length === 1 ? parentMidX + COUPLE_GAP / 2 : midU + COUPLE_GAP / 2;
          const sid = `${lnk.id}_s${ki}`, cmx = (lx + rx) / 2;
          N.push({ id: kidId, gender: ku.gender, gen: 2, dx: lx, dy: kidsY, label: getRelativeTitle(ku.gender, ki, lnk.kidsCfg), isExt: true });
          N.push({ id: sid, gender: ku.gender === 'M' ? 'F' : 'M', gen: 2, dx: rx, dy: kidsY, label: '配偶', isExt: true });
          L.push({ id: `${lnk.id}_ml_c${ki}`, type: 'marry', a: kidId, b: sid, status: ku.partner, isExt: true });
          kidIds.push(kidId);
          if (ku.g3.length > 0) {
            const g3Start = cmx - ((ku.g3.length - 1) * SIBLING_GAP) / 2, g3ids = [];
            ku.g3.forEach((g, j) => { const gkid = `${lnk.id}_g${ki}_${j}`; N.push({ id: gkid, gender: g, gen: 3, dx: g3Start + j * SIBLING_GAP, dy: kidsY + 80, label: `${g === 'M' ? '孫' : '孫女'}${j+1}`, isExt: true }); g3ids.push(gkid); });
            L.push({ id: `${lnk.id}_pc_c${ki}`, type: 'pc', pa: kidId, pb: sid, kids: g3ids, isExt: true });
          }
        } else {
          N.push({ id: kidId, gender: ku.gender, gen: 2, dx: midU, dy: kidsY, label: getRelativeTitle(ku.gender, ki, lnk.kidsCfg), isExt: true });
          kidIds.push(kidId);
        }
        ckx += ku.w;
      });
      if (kidIds.length > 0) L.push({ id: `${lnk.id}_pc`, type: 'pc', pa: lnk.sourceId, pb: lnk.targetId, kids: kidIds, isExt: true });
    });

    return { nodes: N, lines: L };
  }, [gen2Cfg, g1Status, customLinks]); // freeNodes 改用 ref 讀取，避免每次拖曳觸發重算


  const pos = useCallback((id) => {
    if (positions[id]) return positions[id];
    const n = nodes.find(v => v.id === id);
    if (n) return { x: n.dx, y: n.dy };
    const fn = freeNodes.find(v => v.id === id);
    if (fn) return { x: fn.x, y: fn.y };
    return { x: 0, y: 0 };
  }, [positions, nodes, freeNodes]);
  const svgPt = useCallback((e) => { const p = svgRef.current.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svgRef.current.getScreenCTM().inverse()); }, []);

  /* =========================================================================
   * 積木工具箱的拖曳貼附
   *
   * 與畫布上既有的「拖曳碰撞即連線」刻意分開處理：
   *   - 途中經過的節點只會高亮，不會被貼上
   *   - 只有「放開」那一刻的座標算數，命中誰就貼給誰
   *   - 放開在空白處＝取消，什麼都不做
   * 貼附本身是切換：對已經有該標記的人再拖一次就是取消。
   * ======================================================================= */
  const [symbolDrag, setSymbolDrag] = useState(null);   // { key, x, y, hoverId }

  const allNodeIds = useMemo(
    () => [
      ...nodes.map(n => n.id),
      ...freeNodes.filter(f => f.type !== 'eco' && !STANDALONE_TYPES.includes(f.type)).map(f => f.id),
    ],
    [nodes, freeNodes]
  );

  /** 找出座標命中的節點；沒命中回傳 null */
  const hitTestNode = useCallback((pt) => {
    for (const id of allNodeIds) {
      const p = pos(id);
      if (Math.abs(pt.x - p.x) <= R + 4 && Math.abs(pt.y - p.y) <= R + 4) return id;
    }
    return null;
  }, [allNodeIds, pos]);

  /* 供關係品質符號拖曳命中判斷用的婚姻線清單：主線（父母／案主與配偶）
   * 加上擴充關係裡「非生態圖、非獨立個體註記」的配偶線。 */
  const marriageLineSegs = useMemo(() => {
    const segs = lines
      .filter(ln => ln.type === 'marry')
      .map(ln => ({ id: ln.id, a: ln.a, b: ln.b }));
    customLinks.forEach(lnk => {
      if (lnk.type === 'eco' || lnk.type === 'annotation') return;
      segs.push({ id: lnk.id, a: lnk.sourceId, b: lnk.targetId });
    });
    return segs;
  }, [lines, customLinks]);

  /** 找出座標命中的婚姻線；沒命中回傳 null。 */
  const hitTestLine = useCallback((pt) => {
    let best = null, bestDist = 14; // 14px 內才算命中，太寬會誤觸到旁邊的線
    for (const seg of marriageLineSegs) {
      const pa = pos(seg.a), pb = pos(seg.b);
      const d = distToSegment(pt.x, pt.y, pa.x, pa.y, pb.x, pb.y);
      if (d < bestDist) { bestDist = d; best = seg.id; }
    }
    return best;
  }, [marriageLineSegs, pos]);

  const startSymbolDrag = useCallback((e, key) => {
    e.preventDefault();
    e.stopPropagation();
    setSymbolDrag({ key, x: e.clientX, y: e.clientY, hoverId: null });
  }, []);

  /** 記錄用過一次某個符號，快捷列表依這個次數排序。拖曳與點擊套用共用。 */
  const recordUse = useCallback((key) => setUsage(bumpUsage(key)), []);

  useEffect(() => {
    if (!symbolDrag) return;
    const kind = SYMBOL_MAP[symbolDrag.key]?.kind;

    const svgPointFor = (ev) => {
      if (!svgRef.current) return null;
      const p = svgRef.current.createSVGPoint();
      p.x = ev.clientX; p.y = ev.clientY;
      const ctm = svgRef.current.getScreenCTM();
      return ctm ? p.matrixTransform(ctm.inverse()) : null;
    };

    const onMove = (ev) => {
      // 拖曳中只更新游標位置與高亮目標，不做任何資料異動
      const svgP = svgPointFor(ev);
      let hoverId = null, hoverLineId = null;
      if (svgP) {
        if (kind === 'relLine') hoverLineId = hitTestLine(svgP);
        else if (kind !== 'standalone') hoverId = hitTestNode(svgP);
      }
      setSymbolDrag(d => (d ? { ...d, x: ev.clientX, y: ev.clientY, hoverId, hoverLineId } : d));
    };

    const onUp = (ev) => {
      const { key } = symbolDrag;
      const svgP = svgPointFor(ev);
      setSymbolDrag(null);
      if (!svgP) return;

      if (kind === 'relLine') {
        const lineId = hitTestLine(svgP);
        if (!lineId) return;                         // 放開在空白處：取消
        toggleLineAttr(lineId, key);
        recordUse(key);
        return;
      }

      if (kind === 'standalone') {
        if (hitTestNode(svgP)) return;                // 放開在既有人物節點上：不做事
        setFreeNodes(prev => [...prev, { id: 'f_' + Date.now(), type: key, x: svgP.x, y: svgP.y }]);
        recordUse(key);
        return;
      }

      const targetId = hitTestNode(svgP);
      if (!targetId) return;                         // 放開在空白處：取消
      toggleNodeAttr(targetId, key);
      recordUse(key);
    };

    const onKey = (ev) => { if (ev.key === 'Escape') setSymbolDrag(null); };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [symbolDrag, hitTestNode, hitTestLine, toggleNodeAttr, toggleLineAttr, setFreeNodes, recordUse]);

  const onDown = useCallback((e, id) => {
    e.stopPropagation(); nodeDragMoved.current = false; const sp = svgPt(e); const p = pos(id);
    const isFree = freeNodes.some(fn => fn.id === id);
    setDrag({ id, ox: sp.x - p.x, oy: sp.y - p.y, isFree });
  }, [svgPt, pos, freeNodes]);

  const onTextDown = useCallback((e, id) => {
    e.stopPropagation(); textDragMoved.current = false; const sp = svgPt(e); const found = texts.find(v => v.id === id);
    if (found) setTextDrag({ id, ox: sp.x - found.x, oy: sp.y - found.y });
  }, [svgPt, texts]);

  const onTextClick = useCallback((e, id) => { e.stopPropagation(); if (textDragMoved.current) return; setSelectedTextId(id); }, []);
  const onTextDoubleClick = useCallback((e, id) => {
    e.stopPropagation(); setEditingTextId(id);
  }, []);

  const onResizeDown = useCallback((e, id) => {
    e.stopPropagation(); const sp = svgPt(e); const found = texts.find(v => v.id === id);
    if (found) setTextResize({ id, startY: sp.y, startSize: found.fontSize });
  }, [svgPt, texts]);

  /* 拖曳時的對齊參考線（純顯示，不進文件）：
     { x, y, center } — center 為 true 代表吸在「中線」上（父母對子女中央等） */
  const [snapGuide, setSnapGuide] = useState(null);

  const onMove = useCallback((e) => {
    const sp = svgPt(e);
    if (draftPoly.length > 0) setMousePos({ x: sp.x, y: sp.y });
    if (dragVertex) { setPolygons(p => p.map(pg => pg.id !== dragVertex.polyId ? pg : { ...pg, pts: pg.pts.map((pt, i) => i === dragVertex.index ? { x: sp.x - dragVertex.ox, y: sp.y - dragVertex.oy } : pt) })); return; }
    if (textResize) { setTexts(p => p.map(t => t.id === textResize.id ? { ...t, fontSize: Math.max(10, Math.min(72, Math.round(textResize.startSize + (sp.y - textResize.startY) * 0.3))) } : t)); return; }
    if (textDrag) { textDragMoved.current = true; setTexts(p => p.map(t => t.id === textDrag.id ? { ...t, x: sp.x - textDrag.ox, y: sp.y - textDrag.oy } : t)); return; }
    if (!drag) return;
    nodeDragMoved.current = true;

    // 收集畫面上「所有」節點的最新座標，作為全域磁吸的對象
    const allSnaps = [];
    nodes.forEach(n => {
      if (n.id !== drag.id) {
        const p = positionsRef.current[n.id] || { x: n.dx, y: n.dy };
        allSnaps.push(p);
      }
    });
    freeNodesRef.current.forEach(fn => {
      if (fn.id !== drag.id) {
        allSnaps.push({ x: fn.x, y: fn.y });
      }
    });

    /* --- 中線磁吸 ---
     * 一般的 12px 磁吸只能對齊「別人身上」，對不到兩人之間的中心點，所以
     * 父母要擺在整排子女正中央時只能用目測。這裡替正在拖的人算出它該對齊的
     * 中線：拖父母 → 讓夫妻中點落在子女整排的中央；拖子女 → 對齊父母中點。 */
    const at = (id) => {
      const p = positionsRef.current[id];
      if (p) return p;
      const n = nodes.find(v => v.id === id);
      if (n) return { x: n.dx, y: n.dy };
      const fn = freeNodesRef.current.find(v => v.id === id);
      return fn ? { x: fn.x, y: fn.y } : null;
    };
    const centerSnaps = [];   // { nodeX: 節點要落在哪, guideX: 參考線畫在哪 }
    lines.forEach(ln => {
      if (ln.type !== 'pc' || !ln.kids || ln.kids.length === 0) return;
      const kidPts = ln.kids.map(at).filter(Boolean);
      if (kidPts.length === 0) return;
      const kidXs = kidPts.map(p => p.x);
      const kidsMid = (Math.min(...kidXs) + Math.max(...kidXs)) / 2;
      if (ln.pa === drag.id || ln.pb === drag.id) {
        const other = at(ln.pa === drag.id ? ln.pb : ln.pa);
        if (other) centerSnaps.push({ nodeX: 2 * kidsMid - other.x, guideX: kidsMid });
      }
      if (ln.kids.includes(drag.id)) {
        const pa = at(ln.pa), pb = at(ln.pb);
        if (pa && pb) { const mid = (pa.x + pb.x) / 2; centerSnaps.push({ nodeX: mid, guideX: mid }); }
      }
    });

    // 中線優先（14px），沒吸到才回到一般的 12px 對齊
    const snapX = (val) => {
      for (const cs of centerSnaps) if (Math.abs(val - cs.nodeX) < 14) return { v: cs.nodeX, guide: cs.guideX, center: true };
      for (const p of allSnaps) if (Math.abs(val - p.x) < 12) return { v: p.x, guide: p.x, center: false };
      return { v: val, guide: null, center: false };
    };
    const snapY = (val) => {
      for (const p of allSnaps) if (Math.abs(val - p.y) < 12) return { v: p.y, guide: p.y };
      return { v: val, guide: null };
    };
    const showGuide = (sx, sy) => setSnapGuide(
      sx.guide == null && sy.guide == null ? null : { x: sx.guide, y: sy.guide, center: sx.center }
    );

    if (drag.isFree) {
      let newX = sp.x - drag.ox, newY = sp.y - drag.oy;
      
      // 1. 擴充關係優先：25px 強力磁吸伴侶
      const connIds = customLinks
        .filter(l => l.sourceId === drag.id || l.targetId === drag.id)
        .map(l => l.sourceId === drag.id ? l.targetId : l.sourceId);
      
      let matchedPartner = false;
      for (const cid of connIds) {
        const fromPos = positionsRef.current[cid];
        const connY = fromPos?.y
          ?? freeNodesRef.current.find(fn => fn.id === cid)?.y
          ?? nodes.find(n => n.id === cid)?.dy;
        if (connY != null && Math.abs(newY - connY) < 25) { 
          newY = connY; 
          matchedPartner = true;
          break; 
        }
      }

      // 2. 沒吸到伴侶時，啟動中線磁吸 + 12px 全域磁吸 (對齊網格上其他人)
      const sx = snapX(newX);
      const sy = matchedPartner ? { v: newY, guide: null } : snapY(newY);
      newX = sx.v; newY = sy.v;
      showGuide(sx, sy);
      setFreeNodes(prev => prev.map(fn => fn.id === drag.id ? { ...fn, x: newX, y: newY } : fn));
    } else {
      // 原生節點：中線磁吸 + 12px 全域磁吸
      const sx = snapX(sp.x - drag.ox), sy = snapY(sp.y - drag.oy);
      showGuide(sx, sy);
      setPositions(prev => ({ ...prev, [drag.id]: { x: sx.v, y: sy.v } }));
    }
  }, [drag, textDrag, textResize, dragVertex, draftPoly, svgPt, setFreeNodes, customLinks, nodes, lines]);

  const onUp = useCallback(() => {
    if (drag && drag.isFree) {
      const draggedNode = freeNodes.find(fn => fn.id === drag.id);
      if (draggedNode) {
        const dp = { x: draggedNode.x, y: draggedNode.y };
        // Check collision with all existing nodes
        let closestId = null, closestDist = Infinity;
        nodes.forEach(nd => {
          const np = pos(nd.id);
          const dist = Math.sqrt(Math.pow(dp.x - np.x, 2) + Math.pow(dp.y - np.y, 2));
          if (dist < 60 && dist < closestDist) { closestDist = dist; closestId = nd.id; }
        });
        // Also check other freeNodes
        freeNodes.forEach(fn => {
          if (fn.id === drag.id) return;
          const dist = Math.sqrt(Math.pow(dp.x - fn.x, 2) + Math.pow(dp.y - fn.y, 2));
          if (dist < 60 && dist < closestDist) { closestDist = dist; closestId = fn.id; }
        });
        if (closestId) {
          const alreadyLinked = customLinks.some(l => (l.sourceId === drag.id && l.targetId === closestId) || (l.sourceId === closestId && l.targetId === drag.id));
          if (!alreadyLinked) {
            const draggedIsEco = draggedNode.type === 'eco';
            const draggedIsAnnotation = STANDALONE_TYPES.includes(draggedNode.type);
            const newLinkType = draggedIsEco ? 'eco' : draggedIsAnnotation ? 'annotation' : undefined;
            setCustomLinks(prev => [...prev, { id: 'l_' + Date.now(), sourceId: closestId, targetId: drag.id, ...(newLinkType ? { type: newLinkType } : {}), status: 'married', kidsStr: '', kidsCfg: [] }]);
            // Push freeNode away to prevent overlap
            const tp = pos(closestId);
            const angle = Math.atan2(dp.y - tp.y, dp.x - tp.x);
            const pushDist = 70;
            setFreeNodes(prev => prev.map(fn => fn.id === drag.id ? { ...fn, x: tp.x + Math.cos(angle) * pushDist, y: tp.y + Math.sin(angle) * pushDist } : fn));
          }
        }
      }
    }
    setDragVertex(null); setDrag(null); setTextDrag(null); setTextResize(null); setSnapGuide(null);
  }, [drag, freeNodes, nodes, pos, customLinks, setCustomLinks, setFreeNodes]);

  const onClick = (e, id) => {
    e.stopPropagation();
    // 放手前如果真的拖動過，這是一次拖曳的收尾，不是要標記這個節點
    if (nodeDragMoved.current) { nodeDragMoved.current = false; return; }
    if (mode === 'index') { setIndexId(p => p === id ? null : id); return; }
    if (mode === 'cohab' && cohabMode === 'auto') { setCohabMembers(p => p.includes(id) ? p.filter(m => m !== id) : [...p, id]); return; }
    if (mode === 'age') { setEditingAgeId(id); return; }
    if (mode === 'clear') { clearNodeAttrs(id); return; }
    // 快捷列表選中的符號若是「貼在人物身上」這一類，點節點即套用；
    // 關係線／獨立個體這兩類不在這裡處理（見 <svg> 的 onClick，這裡的
    // e.stopPropagation() 讓事件不會冒泡上去，剛好避免點到節點時誤觸那邊）。
    if (mode && SYMBOL_MAP[mode]?.kind === 'nodeAttr') {
      toggleNodeAttr(id, mode);
      recordUse(mode);
    }
  };

  const cohabitationBox = useMemo(() => {
    const members = nodes.filter(n => cohabMembers.includes(n.id));
    if (members.length === 0) return null;
    if (members.length === 1) { const p = pos(members[0].id); return { type: 'single', x: p.x - R - 30, y: p.y - R - 30, w: SZ + 60, h: SZ + 60 }; }
    const corners = [];
    members.forEach(n => { const p = pos(n.id); corners.push({ x: p.x - 30, y: p.y - 30 }, { x: p.x + 30, y: p.y - 30 }, { x: p.x - 30, y: p.y + 30 }, { x: p.x + 30, y: p.y + 30 }); });
    const pts = corners.sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
    const lower = [], upper = [];
    for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    lower.pop(); upper.pop();
    return { type: 'poly', points: lower.concat(upper) };
  }, [cohabMembers, nodes, pos]);

  /** 算出目前畫面上所有內容的最小外框（含留白），下載圖片/列印共用。 */
  const computeCropBox = useCallback(() => {
    const PAD = 40, allXs = [], allYs = [];
    nodes.forEach(n => { const p = pos(n.id); allXs.push(p.x - R, p.x + R); allYs.push(p.y - R, p.y + R); });
    freeNodes.forEach(fn => {
      if (fn.type === 'eco') {
        const rx = ecoRx(fn.text);
        allXs.push(fn.x - rx, fn.x + rx); allYs.push(fn.y - ECO_RY, fn.y + ECO_RY);
      } else {
        allXs.push(fn.x - R, fn.x + R); allYs.push(fn.y - R, fn.y + R);
      }
    });
    texts.forEach(t => { const w = t.vertical ? t.fontSize * 1.5 : t.text.length * t.fontSize * 0.7, h = t.vertical ? t.text.length * t.fontSize * 1.2 : t.fontSize * 1.5; allXs.push(t.x - 4, t.x + (t.vertical ? t.fontSize * 1.5 : w)); allYs.push(t.y - (t.vertical ? 4 : t.fontSize + 4), t.y + (t.vertical ? h : 8)); });
    polygons.forEach(pg => pg.pts.forEach(pt => { allXs.push(pt.x); allYs.push(pt.y); }));
    // 底圖也要進裁切範圍，否則下載/列印會把修補好的舊圖切掉
    const bgBox = bgImageBox(bgImage);
    if (bgBox) { allXs.push(bgBox.x, bgBox.x + bgBox.w); allYs.push(bgBox.y, bgBox.y + bgBox.h); }
    if (cohabitationBox && cohabitationBox.type === 'single') { allXs.push(cohabitationBox.x, cohabitationBox.x + cohabitationBox.w); allYs.push(cohabitationBox.y, cohabitationBox.y + cohabitationBox.h); }
    else if (cohabitationBox && cohabitationBox.type === 'poly') { cohabitationBox.points.forEach(pt => { allXs.push(pt.x); allYs.push(pt.y); }); }
    if (allXs.length === 0) return null;
    const minX = Math.min(...allXs) - PAD, minY = Math.min(...allYs) - PAD;
    const w = Math.max(...allXs) + PAD - minX, h = Math.max(...allYs) + PAD - minY;
    return { minX, minY, w, h };
  }, [nodes, freeNodes, texts, polygons, cohabitationBox, pos, bgImage]);

  /** 把畫布裁切後轉成點陣圖並下載。transparent=true 時不補白底（PNG 去背用）。 */
  const rasterizeAndDownload = useCallback((box, { transparent, format, filename }) => {
    const cloned = svgRef.current.cloneNode(true);
    cloned.setAttribute('width', box.w); cloned.setAttribute('height', box.h);
    cloned.setAttribute('viewBox', `${box.minX} ${box.minY} ${box.w} ${box.h}`);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(cloned)], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = box.w * 3; canvas.height = box.h * 3;
      const ctx = canvas.getContext('2d'); ctx.scale(3, 3);
      if (!transparent) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, box.w, box.h); }
      ctx.drawImage(img, 0, 0, box.w, box.h);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href); }, format, 1.0);
    };
    img.src = url;
  }, []);

  /** 檔名用案件名稱，未儲存的草稿就叫 genogram。 */
  const exportBaseName = useCallback(
    () => (activeCase?.name || 'genogram').replace(/[\\/:*?"<>|]/g, '_'),
    [activeCase]
  );

  /* 主按鈕：一鍵下載高解析 PNG（3 倍圖、白底）。
   * 白底而不是去背 —— 直接貼進 Word／LINE 都不會變成一片黑，去背留在進階選單。 */
  const downloadPNG = useCallback(() => {
    const box = computeCropBox();
    if (!box) return;
    rasterizeAndDownload(box, { transparent: false, format: 'image/png', filename: `${exportBaseName()}.png` });
  }, [computeCropBox, rasterizeAndDownload, exportBaseName]);

  const downloadJPG = useCallback(() => {
    const box = computeCropBox();
    if (!box) return;
    rasterizeAndDownload(box, { transparent: false, format: 'image/jpeg', filename: `${exportBaseName()}.jpg` });
  }, [computeCropBox, rasterizeAndDownload, exportBaseName]);

  const downloadPNGTransparent = useCallback(() => {
    const box = computeCropBox();
    if (!box) return;
    rasterizeAndDownload(box, { transparent: true, format: 'image/png', filename: `${exportBaseName()}-去背.png` });
  }, [computeCropBox, rasterizeAndDownload, exportBaseName]);

  /* 列印/存成 PDF：借瀏覽器內建的列印功能，不額外引入 PDF 產生套件。
   * 做法是暫時在 <body> 底下插入一份只含裁切後 SVG 的列印專用容器，
   * 搭配 @media print 把畫面其他部分藏起來，列印對話框關閉後就移除，
   * 完全不影響使用者正在編輯的畫面。 */
  const printA4 = useCallback(() => {
    const box = computeCropBox();
    if (!box) return;
    const cloned = svgRef.current.cloneNode(true);
    cloned.removeAttribute('width'); cloned.removeAttribute('height');
    cloned.setAttribute('viewBox', `${box.minX} ${box.minY} ${box.w} ${box.h}`);
    cloned.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const container = document.createElement('div');
    container.id = 'print-a4-container';

    const style = document.createElement('style');
    style.textContent = `@page { size: A4 ${box.w >= box.h ? 'landscape' : 'portrait'}; margin: 10mm; }`;

    const header = document.createElement('div');
    header.className = 'print-a4-header';
    header.textContent = `${activeCase?.name || '家系圖'}．列印於 ${new Date().toLocaleDateString('zh-TW')}`;

    container.append(style, header, cloned);
    document.body.appendChild(container);

    const cleanup = () => { container.remove(); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }, [computeCropBox, activeCase]);

  /* ===== 橡皮擦：在底圖上拖曳抹除 =====
   * 一筆從 mousedown 開始、mouseup 結束，中途只更新本地暫態；
   * 放開才寫進文件，所以一筆就是一筆歷史，Ctrl+Z 會整筆消失而不是一段一段。 */
  const eraseStart = useCallback((e) => {
    if (!bgImage) return;
    e.stopPropagation();
    const sp = svgPt(e);
    setEraseDraft({ w: eraseWidth, pts: [[Math.round(sp.x), Math.round(sp.y)]] });
  }, [bgImage, eraseWidth, svgPt]);

  const eraseMoveTo = useCallback((e) => {
    if (!eraseDraft) return;
    const sp = svgPt(e);
    setEraseDraft(d => {
      if (!d) return d;
      const last = d.pts[d.pts.length - 1];
      // 每 3px 才記一點：省掉大量幾乎重疊的座標，存檔才不會膨脹
      if (Math.abs(sp.x - last[0]) < 3 && Math.abs(sp.y - last[1]) < 3) return d;
      return { ...d, pts: [...d.pts, [Math.round(sp.x), Math.round(sp.y)]] };
    });
  }, [eraseDraft, svgPt]);

  const eraseEnd = useCallback(() => {
    if (!eraseDraft) return;
    const stroke = { id: 'er_' + Date.now(), ...eraseDraft };
    setEraseDraft(null);
    setBgErase(prev => [...prev, stroke]);
  }, [eraseDraft, setBgErase]);

  /* 沒有底圖就不該還停在橡皮擦模式（例如剛按了復原把底圖收回去） */
  useEffect(() => { if (!bgImage && eraseMode) setEraseMode(false); }, [bgImage, eraseMode]);

  const eraseStrokes = eraseDraft ? [...bgErase, eraseDraft] : bgErase;

  /* ===== SVG 尺寸計算 ===== */
  const allX = nodes.map(n => positions[n.id]?.x ?? n.dx).concat(texts.map(t => t.x + 100), freeNodes.map(fn => {
    if (fn.type === 'eco') return fn.x + ecoRx(fn.text);
    return fn.x + 100;
  }));
  const allY = nodes.map(n => positions[n.id]?.y ?? n.dy).concat(texts.map(t => t.y + 100), freeNodes.map(fn => fn.y + 100));
  const bgBox = bgImageBox(bgImage);
  const svgW = Math.max(800, (allX.length ? Math.max(...allX) : 0) + 160, bgBox ? bgBox.x + bgBox.w + 60 : 0);
  const svgH = Math.max(520, (allY.length ? Math.max(...allY) : 0) + 80, bgBox ? bgBox.y + bgBox.h + 60 : 0);

  /* ===== 介面渲染 ===== */
  return (
    <div className="app-layout">
      {/* 左側面板 */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <h2>資料輸入面板</h2>
          </div>
          <div className="panel-header-actions">
            {/* 一鍵速下載：點按鈕本體直接存高解析 PNG，其他格式收在箭頭底下 */}
            <div className="export-menu split-btn" ref={exportMenuRef}>
              <button className="btn-action btn-primary" onClick={downloadPNG}
                      title="直接下載高解析 PNG（3 倍圖、白底）">⬇ 下載</button>
              <button className="btn-action btn-primary split-caret"
                      onClick={() => setExportOpen(o => !o)}
                      aria-expanded={exportOpen} aria-haspopup="true"
                      title="其他格式與列印" aria-label="其他下載與列印選項">▼</button>
              {exportOpen && (
                <ul className="export-menu-list">
                  <li><button onClick={() => { downloadJPG(); setExportOpen(false); }}>🖼️ JPG 圖片</button></li>
                  <li><button onClick={() => { downloadPNGTransparent(); setExportOpen(false); }}>🪄 PNG（透明背景）</button></li>
                  <li><button onClick={() => { printA4(); setExportOpen(false); }}>🖨️ 列印／存成 PDF（A4）</button></li>
                </ul>
              )}
            </div>
            {/* 重置走 patchDoc，整批算一筆歷史，所以誤按可以用復原救回來 */}
            <button className="btn-action btn-danger" onClick={() => {
              if (!window.confirm('確定重置？重置後可用「復原」還原。')) return;
              patchDoc({
                gen2Str: '', gen2Cfg: [], indexId: null, cohabMembers: [], nodeAttrs: {}, lineAttrs: {},
                cohabSolid: false, polygons: [], texts: [], ages: {},
                freeNodes: [], customLinks: [], positions: {}, ipStyle: 'filled',
                bgImage: null, bgErase: [],
              }, '__reset');
            }}>重置</button>
          </div>
        </div>

        <div className="quick-tool-panel">
          <div className="quick-tool-header">
            <span className="quick-tool-title">快捷列表</span>
            <InfoTip text="點按鈕進入模式，再點畫布上的目標套用；年齡模式下點人物可直接輸入。下面的符號列可以拖到人物／婚姻線上放開，或先選取再點目標。要移除標記，把同一個符號再套一次就是取消。" />
            {/* 清除模式（mode === 'clear'）的邏輯完整保留在 onClick 分支與
                clearNodeAttrs／clearLineAttr 裡，只是目前不給入口——擴充個體本來
                就能雙擊刪除，原生節點的標記用「同一個符號再套一次」也能取消。
                要放回來就在這裡加一顆按鈕，並在快捷鍵那段補一行
                （Q／W／E 已被案主／同住／年齡用掉，得另挑一個鍵）。 */}
          </div>

          {/* 快捷鍵小抄。按鈕上不再帶「[Q]」這種標示（三顆要並排在 276px 的
              面板裡，帶標示會擠成兩行），改用這排淡灰小字補回來。自成一行而
              不是塞在標題列右邊：這串量起來 255px，標題列扣掉標題與 ⓘ 只剩
              195px，硬塞會撐破面板。 */}
          <div className="quick-key-legend">
            {[['Q', '案主'], ['W', '同住'], ['E', '年齡'], ['A', '啟用符號列'], ['S/D', '切換符號']].map(([k, label]) => (
              <span key={k}>[{k}]{label}</span>
            ))}
          </div>

          <div className="quick-tool-rows">
            {/* 案主／同住／年齡三個畫布模式，快捷鍵 Q／W／E，跟下面符號列的
                A/S/D 是各自獨立的開關。三顆必須排在同一行——面板內容寬只有
                276px，按鈕上若再帶「[Q]」這種快捷鍵標示，三組量起來要 343px，
                光收內距最多降到 290px 還是會擠成兩行。所以標示改放 title
                （滑過就看得到），ⓘ 與說明書也都列著。 */}
            <div className="quick-tool-row-group">
              <div className="quick-tool-row">
                <button className={`quick-tool-btn tone-blue ${mode === 'index' ? 'active' : ''}`}
                        onClick={() => setMode(mode === 'index' ? null : 'index')}
                        title="案主 [Q]：進入模式後點畫布上的人物指定案主">
                  案主
                </button>
                <span className="status-badge" data-status={ipStyle}
                      onClick={() => setIpStyle(ipStyle === 'filled' ? 'double' : 'filled')}
                      ref={el => wheelRef(el, ['filled', 'double'], ipStyle, setIpStyle)}>
                  {ipStyle === 'filled' ? '填滿' : '雙線'}
                </span>
              </div>

              <div className="quick-tool-row">
                <button className={`quick-tool-btn tone-amber ${mode === 'cohab' ? 'active' : ''}`}
                        onClick={() => setMode(mode === 'cohab' ? null : 'cohab')}
                        title="同住 [W]：進入模式後圈出同住範圍">
                  同住
                </button>
                <span className="status-badge" data-status={cohabMode}
                      onClick={() => setCohabMode(cohabMode === 'auto' ? 'poly' : 'auto')}
                      ref={el => wheelRef(el, ['auto', 'poly'], cohabMode, setCohabMode)}>
                  {cohabMode === 'auto' ? '自動' : '點繪'}
                </span>
                <span className="status-badge" data-status={cohabSolid ? 'solid' : 'dashed'}
                      onClick={() => setCohabSolid(!cohabSolid)}
                      ref={el => wheelRef(el, [false, true], cohabSolid, setCohabSolid)}>
                  {cohabSolid ? '實線' : '虛線'}
                </span>
              </div>

              {/* 年齡沒有狀態標籤：填過的年齡一律畫在節點上，沒有「隱藏」這個
                  狀態，按鈕亮起來只代表「現在點人物是輸入年齡」。原本那顆顯示
                  開關會讓下載的 PNG 跟著少掉年齡（匯出是直接序列化當下的 SVG），
                  拿掉之後就不會有那個陷阱。 */}
              <div className="quick-tool-row">
                <button className={`quick-tool-btn tone-teal ${mode === 'age' ? 'active' : ''}`}
                        onClick={() => setMode(m => m === 'age' ? null : 'age')}
                        title="年齡 [E]：進入模式後點人物直接輸入年齡">
                  年齡
                </button>
              </div>
            </div>
          </div>

          {/* === 快捷標記（死亡／身障／慢性病／正向親密／衝突／關係惡化） ===
              拖曳到人物／婚姻線上放開即套用；或按 A 進入選取、S／D 左右切換，
              選中後直接點畫布上的目標套用。點圖示本身也可以直接選中它。
              已套用的標記再套一次（拖曳或點選後點同一個目標）即取消——見
              toggleNodeAttr／toggleLineAttr。只用原生 title 顯示短名稱，
              不再用長文字懸浮框。 */}
          <div className="quick-mark-row">
            {QUICK_SYMBOLS.map(s => (
              <button
                key={s.key}
                className={`quick-mark-chip ${mode === s.key ? 'active' : ''} ${symbolDrag?.key === s.key ? 'dragging' : ''}`}
                title={s.label}
                aria-label={s.label}
                aria-pressed={mode === s.key}
                onPointerDown={e => startSymbolDrag(e, s.key)}
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = QUICK_KEYS.indexOf(s.key);
                  setQuickIdx(idx);
                  setMode(m => m === s.key ? null : s.key);
                }}
              >
                <SymbolPreview symbol={s} size={26} />
              </button>
            ))}
          </div>
        </div>

        {/* 第一代與第二代是同一條主線上的兩張卡，標題列結構刻意寫成一樣的
            （section-title-row + label + ⓘ），字級與顏色才不會各走各的 */}
        <div className="section">
          <div className="section-title-row">
            <label>第一代（父母）</label>
            <InfoTip text="系統預設一對父母（■ 父、● 母）。右側標籤可點擊切換婚姻狀態，滑鼠停在上面滾動滾輪也可以。子女人數變動時，父母會自動對回整排子女的正中央；位置被拉亂時，手動拖曳會吸附中線，出現綠色虛線就是對準了。" />
            <span className="status-badge" data-status={g1Status}
                  onClick={cycleOnClick(G1_STATUSES, g1Status, setG1Status)}
                  ref={el => wheelRef(el, G1_STATUSES, g1Status, setG1Status)}
                  style={{ marginLeft: 'auto' }}>{G1_LABELS[g1Status]}</span>
          </div>
        </div>

        <div className="section">
          <div className="section-title-row">
            <label>第二代子女順序</label>
            <InfoTip text="輸入「男/女」(中文)、「M/F」(英文) 或「1/2」(數字)，即時產生子代節點。" />
          </div>
          <input type="text" value={gen2Str} onChange={e => onGen2Change(e.target.value)} placeholder="例：女女男男女 或 FFMMF 或 11221" />
        </div>

        {gen2Cfg.length > 0 && (
          <div className="section">
            <label>第二代成員設定</label>
            {gen2Cfg.map((c, i) => (
              <div key={i}>
                <div className="child-row">
                  <span className={`child-icon ${c.gender === 'M' ? 'm' : 'f'}`}>{c.gender === 'M' ? '■' : '●'}</span>
                  <span className={`child-name ${c.gender === 'M' ? 'm' : 'f'}`}>{getGen2Title(i, gen2Cfg, indexId)}</span>
                  <div className="chk-wrap">
                    <label><input type="checkbox" checked={c.isMulti || false} onChange={() => toggleMulti(i)} /> 多胞胎</label>
                    <span className="status-badge" data-status={c.partner || 'none'}
                          onClick={cycleOnClick(G2_STATUSES, c.partner || 'none', v => changePartner(i, v))}
                          ref={el => wheelRef(el, G2_STATUSES, c.partner || 'none', v => changePartner(i, v))}
                          style={{ marginLeft: '8px' }}>{G2_LABELS[c.partner || 'none']}</span>
                  </div>
                </div>
                {c.partner !== 'none' && (
                  <div className="gen3-block">
                    <label>↳ 第三代 (例: 男/女 或 M/F 或 1/2)</label>
                    <input type="text" value={c.g3Str} onChange={e => setG3(i, e.target.value)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="section section-inline">
          <label style={{ margin: 0 }}>📝 文字方塊</label>
          <InfoTip text="單擊選取文字方塊（顯示框線）；雙擊可編輯內容；選取後可刪除或拖曳右下角縮放。" />
          <span className="status-badge" data-status={textDirection}
                onClick={cycleOnClick(TEXT_DIRS, textDirection, setTextDirection)}
                ref={el => wheelRef(el, TEXT_DIRS, textDirection, setTextDirection)}
                title="點擊或滾輪切換：橫式/直式">{TEXT_DIR_LABELS[textDirection]}</span>
          <button className="btn-soft tone-sage" onClick={addText} style={{ marginLeft: 'auto' }}>新增</button>
        </div>

        <div className="section">
          <div className="section-title-row">
            <label>🧩 自由擴充區</label>
            <InfoTip text="男性／女性／三角／生態圖：點按鈕即在畫布上新增一個獨立個體。把新增的個體拖到目標人物上疊在一起放開，就會自動產生連線；生態圖新增後預設連結案主。按下「編輯」會把擴充個體改用藍色畫，方便跟原本的家系區分。" />
          </div>
          <div className="btn-row">
            <button className="btn-soft tone-dust" onClick={() => addFreeNode('M')}>男性</button>
            <button className="btn-soft tone-rose" onClick={() => addFreeNode('F')}>女性</button>
            <button className="btn-soft tone-mauve" onClick={() => addStandaloneNode('pregnancy')}>三角</button>
            <button className="btn-soft tone-teal" onClick={addEcoNode}>生態圖</button>
            {/* 原本是個只能用滾輪切換的標籤（看起來像 tag，也沒人知道可以滾）。
                改成真的按鈕：點一下切換，滾輪仍然可用。 */}
            <button
              className={`btn-toggle ${extColorMode === 'blue' ? 'on' : ''}`}
              onClick={() => setExtColorMode(extColorMode === 'blue' ? 'black' : 'blue')}
              ref={el => wheelRef(el, EXT_COLOR_MODES, extColorMode, setExtColorMode)}
              title="切換擴充個體的顏色：一般／編輯（滾輪亦可）"
              aria-pressed={extColorMode === 'blue'}
            >{EXT_COLOR_LABELS[extColorMode]}</button>
          </div>
        </div>

        <ImagePatchPanel
          bgImage={bgImage} setBgImage={setBgImage}
          bgErase={bgErase} setBgErase={setBgErase}
          eraseMode={eraseMode} setEraseMode={setEraseMode}
          eraseWidth={eraseWidth} setEraseWidth={setEraseWidth}
        />

        <CaseBar
          cases={cases} activeCaseId={activeCaseId} activeCase={activeCase} isSaved={isSaved}
          switchCase={switchCase} saveCase={saveCase} renameCase={renameCase}
          deleteCase={deleteCase} exportCase={exportCase} importCase={importCase}
          snapshots={snapshots} takeSnapshot={takeSnapshot}
          restoreSnapshot={restoreSnapshot} removeSnapshot={removeSnapshot}
        />

        {customLinks.length > 0 && (
          <div className="section">
            <label>🔗 擴充連線設定</label>
            {customLinks.map(lnk => {
              const isEcoLink = lnk.type === 'eco';
              const isAnnotationLink = lnk.type === 'annotation';
              const isSpecialLink = isEcoLink || isAnnotationLink;
              const srcNode = nodes.find(n => n.id === lnk.sourceId) || freeNodes.find(n => n.id === lnk.sourceId);
              const tgtNode = nodes.find(n => n.id === lnk.targetId) || freeNodes.find(n => n.id === lnk.targetId);
              const linkNodeLabel = (node) => {
                if (!node) return '?';
                if (node.type === 'eco') return node.text || '生態圖';
                if (STANDALONE_TYPES.includes(node.type)) return SYMBOL_MAP[node.type]?.label || node.type;
                return node.label || (node.gender === 'M' ? '■' : '●');
              };
              const srcLabel = linkNodeLabel(srcNode);
              const tgtLabel = linkNodeLabel(tgtNode);
              return (
                <div key={lnk.id} className={`link-card ${isEcoLink ? 'eco' : isAnnotationLink ? 'annotation' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span>{isEcoLink ? '🌐 ' : isAnnotationLink ? '📎 ' : ''}{srcLabel} ↔ {tgtLabel}</span>
                    {!isSpecialLink && (
                      <span className="status-badge" data-status={lnk.status}
                            onClick={cycleOnClick(CUSTOM_LINK_STATUSES, lnk.status, v => updateCustomLink(lnk.id, 'status', v))}
                            ref={el => wheelRef(el, CUSTOM_LINK_STATUSES, lnk.status, v => updateCustomLink(lnk.id, 'status', v))}
>{CUSTOM_LINK_LABELS[lnk.status]}</span>
                    )}
                    <button className="btn-soft tone-clay btn-soft-xs" onClick={() => deleteCustomLink(lnk.id)} style={{ marginLeft: 'auto' }}>刪除</button>
                  </div>
                  {!isSpecialLink && (
                    <>
                      <div style={{ marginTop: '4px' }}>
                        <input type="text" value={lnk.kidsStr || ''} onChange={e => {
                          const val = e.target.value;
                          const gs = parseGenders(val);
                          const newKidsCfg = gs.map((g, i) => (lnk.kidsCfg?.[i]?.gender === g) ? lnk.kidsCfg[i] : { gender: g, partner: 'none', g3Str: '' });
                          setCustomLinks(prev => prev.map(l => l.id === lnk.id ? { ...l, kidsStr: val, kidsCfg: newKidsCfg } : l));
                        }} placeholder="子代 (例: 男女 或 MF 或 12)" style={{ width: '100%', fontSize: '12px' }} />
                      </div>
                      {lnk.kidsCfg && lnk.kidsCfg.length > 0 && (
                        <div style={{ marginTop: '6px', paddingLeft: '8px', borderLeft: '2px solid #e2e8f0' }}>
                          {lnk.kidsCfg.map((kc, ki) => (
                            <div key={ki}>
                              <div className="child-row">
                                <span className={`child-icon ${kc.gender === 'M' ? 'm' : 'f'}`}>{kc.gender === 'M' ? '■' : '●'}</span>
                                <span className={`child-name ${kc.gender === 'M' ? 'm' : 'f'}`}>{getRelativeTitle(kc.gender, ki, lnk.kidsCfg)}</span>
                                <div className="chk-wrap">
                                  <span className="status-badge" data-status={kc.partner || 'none'}
                                        onClick={cycleOnClick(G2_STATUSES, kc.partner || 'none', v => setCustomLinks(prev => prev.map(l => l.id === lnk.id ? { ...l, kidsCfg: l.kidsCfg.map((k, idx) => idx === ki ? { ...k, partner: v, g3Str: v === 'none' ? '' : k.g3Str } : k) } : l)))}
                                        ref={el => wheelRef(el, G2_STATUSES, kc.partner || 'none', v => setCustomLinks(prev => prev.map(l => l.id === lnk.id ? { ...l, kidsCfg: l.kidsCfg.map((k, idx) => idx === ki ? { ...k, partner: v, g3Str: v === 'none' ? '' : k.g3Str } : k) } : l)))}
>{G2_LABELS[kc.partner || 'none']}</span>
                                </div>
                              </div>
                              {kc.partner !== 'none' && (
                                <div className="gen3-block">
                                  <label>↳ 第三代 (例: 男/女 或 M/F 或 1/2)</label>
                                  <input type="text" value={kc.g3Str || ''} onChange={e => setCustomLinks(prev => prev.map(l => l.id === lnk.id ? { ...l, kidsCfg: l.kidsCfg.map((k, idx) => idx === ki ? { ...k, g3Str: e.target.value } : k) } : l))} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* SVG 畫布 */}
      <div className="canvas-wrap">
        <svg ref={svgRef} width={svgW} height={svgH}
             onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onPointerCancel={onUp}
             onClick={(e) => {
               setSelectedTextId(null); setSelectedPolyId(null);
               /* 清除模式點在婚姻線上：清掉那條線的關係品質標記。點在人物上
                  不會走到這裡（節點的 onClick 已經 stopPropagation 並自行處理）。 */
               if (mode === 'clear') {
                 const lineId = hitTestLine(svgPt(e));
                 if (lineId) clearLineAttr(lineId);
                 return;
               }
               // 快捷列表選中「關係線」或「獨立個體」這兩類符號時，點畫布即套用
               // ——點在節點上不會走到這裡（onClick(e,id) 已經 stopPropagation）。
               const sym = mode && SYMBOL_MAP[mode];
               if (!sym) return;
               const sp = svgPt(e);
               if (sym.kind === 'relLine') {
                 const lineId = hitTestLine(sp);
                 if (lineId) { toggleLineAttr(lineId, mode); recordUse(mode); }
               } else if (sym.kind === 'standalone') {
                 if (!hitTestNode(sp)) {
                   setFreeNodes(prev => [...prev, { id: 'f_' + Date.now(), type: mode, x: sp.x, y: sp.y }]);
                   recordUse(mode);
                 }
               }
             }}
             style={{ background: '#fefefe', minWidth: '600px', cursor: mode === 'cohab' && cohabMode === 'poly' ? 'crosshair' : undefined }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="0.5" /></pattern>
            {/* 橡皮擦遮罩：白＝留下、黑＝挖掉。用遮罩而不是在底圖上塗白色，
                去背 PNG 匯出時擦過的地方才會是真的透明，而不是白色筆跡 */}
            {bgImage && (
              <mask id="bg-erase-mask" maskUnits="userSpaceOnUse"
                    x={BG_X} y={BG_Y} width={bgBox.w} height={bgBox.h}>
                <rect x={BG_X} y={BG_Y} width={bgBox.w} height={bgBox.h} fill="white" />
                {eraseStrokes.map((st, i) => (
                  <polyline
                    key={st.id || `draft${i}`}
                    points={st.pts.map(pt => pt.join(',')).join(' ')}
                    fill="none" stroke="black" strokeWidth={st.w}
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                ))}
              </mask>
            )}
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* 舊圖底圖：畫在所有內容底下，新疊上去的符號才會蓋在舊圖上面 */}
          {bgImage && (
            <image
              href={bgImage.src} x={BG_X} y={BG_Y}
              width={bgBox.w} height={bgBox.h}
              opacity={bgImage.opacity ?? 0.55}
              mask="url(#bg-erase-mask)"
              preserveAspectRatio="none"
              style={{ pointerEvents: 'none' }}
            />
          )}

          {mode === 'cohab' && cohabMode === 'poly' && (
            <rect width="100%" height="100%" fill="transparent" style={{ cursor: 'crosshair' }} onClick={e => { e.stopPropagation(); const sp = svgPt(e); const pt = { x: sp.x, y: sp.y }; if (draftPoly.length >= 3 && Math.sqrt(Math.pow(pt.x - draftPoly[0].x,2) + Math.pow(pt.y - draftPoly[0].y,2)) < 15) { setPolygons(p => [...p, { id: 'pg_' + Date.now(), pts: draftPoly }]); setDraftPoly([]); setMousePos(null); return; } setDraftPoly(p => [...p, pt]); }} />
          )}

          {cohabitationBox && cohabitationBox.type === 'single' && <rect x={cohabitationBox.x} y={cohabitationBox.y} width={cohabitationBox.w} height={cohabitationBox.h} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray={cohabSolid ? "0" : "8,6"} rx="15" />}
          {cohabitationBox && cohabitationBox.type === 'poly' && <path d={getSmoothPath(cohabitationBox.points, true)} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray={cohabSolid ? "0" : "8,6"} strokeLinejoin="round" />}

          {polygons.map(pg => (
            <g key={pg.id}>
              <path d={getSmoothPath(pg.pts, true)} fill="rgba(239, 68, 68, 0.05)" stroke="#ef4444" strokeWidth="2.5" strokeDasharray={cohabSolid ? "0" : "8,6"} strokeLinejoin="round" style={{ cursor: !mode ? 'pointer' : undefined }} onClick={e => { if (!mode) { e.stopPropagation(); setSelectedPolyId(pg.id); } }} onDoubleClick={e => { e.stopPropagation(); setPolygons(p => p.filter(x => x.id !== pg.id)); setSelectedPolyId(null); }} />
              {selectedPolyId === pg.id && pg.pts.map((pt, idx) => <circle key={`v${idx}`} cx={pt.x} cy={pt.y} r={6} fill="#3b82f6" stroke="white" strokeWidth="1.5" style={{ cursor: 'crosshair', touchAction: 'none' }} onPointerDown={e => { e.stopPropagation(); const sp = svgPt(e); setDragVertex({ polyId: pg.id, index: idx, ox: sp.x - pt.x, oy: sp.y - pt.y }); }} />)}
            </g>
          ))}

          {draftPoly.length > 0 && (
            <g>
              {draftPoly.length >= 2 && <path d={getSmoothPath(draftPoly, false)} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="8,6" strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />}
              {mousePos && <line x1={draftPoly[draftPoly.length - 1].x} y1={draftPoly[draftPoly.length - 1].y} x2={mousePos.x} y2={mousePos.y} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.6" pointerEvents="none" />}
              {draftPoly.map((pt, i) => <circle key={`d${i}`} cx={pt.x} cy={pt.y} r={i === 0 && draftPoly.length >= 3 ? 8 : 5} fill={i === 0 ? '#10b981' : '#ef4444'} stroke="white" strokeWidth="1.5" pointerEvents="none" />)}
            </g>
          )}

          <text x="16" y={GEN_Y[0] + 5} fontSize="12" fill="#b0b8c4" fontWeight="600" style={{fontFamily: TEXT_FONT}}>G1</text>
          {gen2Cfg.length > 0 && <text x="16" y={GEN_Y[1] + 5} fontSize="12" fill="#b0b8c4" fontWeight="600" style={{fontFamily: TEXT_FONT}}>G2</text>}
          {gen2Cfg.some(d => d.partner !== 'none' && d.g3Str) && <text x="16" y={GEN_Y[2] + 5} fontSize="12" fill="#b0b8c4" fontWeight="600" style={{fontFamily: TEXT_FONT}}>G3</text>}

          {lines.map(ln => {
            const lineColor = ln.isExt && extColorMode === 'blue' ? '#3b82f6' : '#444';
            if (ln.type === 'marry') {
              const a = pos(ln.a), b = pos(ln.b);
              const x1 = a.x + R, x2 = b.x - R, midX = (x1 + x2) / 2, midY = a.y;
              const els = [<line key={ln.id} x1={x1} y1={a.y} x2={x2} y2={b.y} stroke={lineColor} strokeWidth="2" strokeDasharray={ln.status === 'cohab' ? "8,6" : "0"} />];
              if (ln.status === 'separated') els.push(<line key={`${ln.id}-s`} x1={midX-6} y1={midY+12} x2={midX+6} y2={midY-12} stroke={lineColor} strokeWidth="2" />);
              if (ln.status === 'divorced') els.push(<line key={`${ln.id}-d1`} x1={midX-8} y1={midY-8} x2={midX+8} y2={midY+8} stroke={lineColor} strokeWidth="2" />, <line key={`${ln.id}-d2`} x1={midX-8} y1={midY+8} x2={midX+8} y2={midY-8} stroke={lineColor} strokeWidth="2" />);
              return <g key={ln.id}>{els}</g>;
            }
            if (ln.type === 'pc') {
              const pA = pos(ln.pa), pB = pos(ln.pb), midX = (pA.x + pB.x) / 2, parentY = Math.max(pA.y, pB.y);
              const kidPos = ln.kids.map(k => pos(k)); if (kidPos.length === 0) return null;
              const barY = (parentY + R + kidPos[0].y - R) / 2, els = [];
              els.push(<line key={`${ln.id}-v`} x1={midX} y1={parentY} x2={midX} y2={barY} stroke={lineColor} strokeWidth="2" />);
              const groups = []; let cur = []; ln.kids.forEach((k, i) => { if (nodes.find(n => n.id === k)?.isMulti) cur.push(i); else { if (cur.length >= 2) groups.push(cur); cur = []; } }); if (cur.length >= 2) groups.push(cur);
              // 計算水平線端點：多胞胎用匯集中心點，非多胞胎用個體 X
              const barXs = kidPos.map((kp, j) => { const g = groups.find(x => x.includes(j)); return g ? g.map(i => kidPos[i].x).reduce((a, b) => a + b, 0) / g.length : kp.x; });
              els.push(<line key={`${ln.id}-h`} x1={Math.min(midX, ...barXs)} y1={barY} x2={Math.max(midX, ...barXs)} y2={barY} stroke={lineColor} strokeWidth="2" />);
              kidPos.forEach((kp, j) => {
                const g = groups.find(x => x.includes(j));
                if (g) els.push(<line key={`${ln.id}-m${j}`} x1={g.map(i=>kidPos[i].x).reduce((a,b)=>a+b,0)/g.length} y1={barY} x2={kp.x} y2={kp.y - R} stroke={lineColor} strokeWidth="2" />);
                else els.push(<line key={`${ln.id}-k${j}`} x1={kp.x} y1={barY} x2={kp.x} y2={kp.y - R} stroke={lineColor} strokeWidth="2" strokeDasharray={kinshipDashFor(doc.nodeAttrs[ln.kids[j]])} />);
              });
              return <g key={ln.id}>{els}</g>;
            } return null;
          })}

          {/* 拖曳時的對齊參考線：綠色＝吸在中線上（例如父母正對子女中央），
              灰藍＝一般的對齊到其他人。放開滑鼠就消失，不會被匯出。 */}
          {snapGuide && (
            <g pointerEvents="none">
              {snapGuide.x != null && <line x1={snapGuide.x} y1="0" x2={snapGuide.x} y2={svgH} stroke={snapGuide.center ? '#10b981' : '#94a3b8'} strokeWidth="1.5" strokeDasharray="6,5" opacity="0.9" />}
              {snapGuide.y != null && <line x1="0" y1={snapGuide.y} x2={svgW} y2={snapGuide.y} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6,5" opacity="0.9" />}
            </g>
          )}

          {/* === 所有節點 (原生 + 自由人物) 共用渲染 === */}
          {[
            ...nodes.map(nd => ({ id: nd.id, gender: nd.gender, ...pos(nd.id), stroke: nd.isExt && extColorMode === 'blue' ? '#3b82f6' : '#333', dash: undefined, isFree: false })),
            ...freeNodes.filter(fn => fn.type !== 'eco' && !STANDALONE_TYPES.includes(fn.type)).map(fn => ({ id: fn.id, gender: fn.gender, x: fn.x, y: fn.y, stroke: extColorMode === 'blue' ? '#3b82f6' : '#333', dash: undefined, isFree: true }))
          ].map(nd => {
            const isIP = nd.id === indexId;
            const isDouble = isIP && ipStyle === 'double';
            const fill = isIP && !isDouble ? '#1e293b' : 'white';
            const txtC = isIP && !isDouble ? 'white' : '#333';
            const overlayDark = isIP && !isDouble ? 'white' : '#333';
            const isEditAge = editingAgeId === nd.id, ageVal = ages[nd.id] || '';
            return (
              <g key={nd.id} transform={`translate(${nd.x},${nd.y})`} style={{ cursor: drag?.id === nd.id ? 'grabbing' : 'grab', touchAction: 'none' }}
                 onPointerDown={e => onDown(e, nd.id)} onClick={e => onClick(e, nd.id)}
                 onDoubleClick={e => {
                   e.stopPropagation();
                   /* 雙擊固定代表「刪除擴充個體」，不再看年齡臉色——年齡已經是
                      獨立模式（單擊輸入），原本「年齡開著就不能雙擊刪除」的衝突
                      跟著消失。年齡模式下雙擊等於連點兩次，交給單擊處理就好。 */
                   if (mode === 'age' || !nd.isFree) return;
                   if (window.confirm('確定要刪除這個擴充個體嗎？(相關連線也會一併刪除)')) {
                     setCustomLinks(prev => prev.filter(l => l.sourceId !== nd.id && l.targetId !== nd.id));
                     setFreeNodes(prev => prev.filter(fn => fn.id !== nd.id));
                   }
                 }}>
                {isDouble && (nd.gender === 'M'
                  ? <rect x={-(R+5)} y={-(R+5)} width={SZ+10} height={SZ+10} fill="none" stroke={nd.stroke} strokeWidth="2.5" rx="3" pointerEvents="none" />
                  : <circle cx="0" cy="0" r={R+5} fill="none" stroke={nd.stroke} strokeWidth="2.5" pointerEvents="none" />)}
                {nd.gender === 'M'
                  ? <rect x={-R} y={-R} width={SZ} height={SZ} fill={fill} stroke={nd.stroke} strokeWidth="2.5" rx="2" strokeDasharray={nd.dash} />
                  : <circle cx="0" cy="0" r={R} fill={fill} stroke={nd.stroke} strokeWidth="2.5" strokeDasharray={nd.dash} />}
                {/* 健康狀況：半邊填色（左＝精神、右＝生理、下＝成癮，可並存）。
                    同一節點內一律同色，病因靠位置區分。分界線只畫在填色與
                    留白的交界，兩塊填色之間不畫 —— 否則「左半＋下半」會在
                    正中央被畫出一個十字（見 divisionSegments 的說明）。 */}
                {(() => {
                  const halves = healthHalvesFor(doc.nodeAttrs[nd.id]);
                  if (!halves.length) return null;
                  return (
                    <g pointerEvents="none">
                      {halves.map(side => (
                        <path key={side} d={halfPath(nd.gender, side, R)} fill={CLINICAL_FILL} />
                      ))}
                      {divisionSegments(halves, R).map(([x1, y1, x2, y2], i) => (
                        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                              stroke={CLINICAL_STROKE} strokeWidth={CLINICAL_STROKE_W} />
                      ))}
                    </g>
                  );
                })()}
                {/* 慢性病：左上四分之一填色，跟「身心障礙」的半邊實心同色，
                    不用淡紫色系以免被誤認成精神／生理疾病那組標記。
                    跟上面的半邊系統各自獨立畫——只有一個象限，套不進
                    「halves 組合」那套邏輯，也沒有必要畫額外的分界線。 */}
                {doc.nodeAttrs[nd.id]?.includes('chronicIllness') && (
                  <path d={quarterPath(nd.gender, R)} fill={overlayDark} pointerEvents="none" />
                )}
                {/* 工具箱拖曳經過時的高亮：只是預覽，放開才會真的貼上 */}
                {symbolDrag?.hoverId === nd.id && (nd.gender === 'M'
                  ? <rect x={-(R+8)} y={-(R+8)} width={SZ+16} height={SZ+16} rx="5" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="5,4" pointerEvents="none" />
                  : <circle cx="0" cy="0" r={R+8} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="5,4" pointerEvents="none" />)}
                {disabledIds.includes(nd.id) && (nd.gender === 'M'
                  ? <path d={`M 0,${-R} L ${-R+2},${-R} A 2,2 0 0,0 ${-R},${-R+2} L ${-R},${R-2} A 2,2 0 0,0 ${-R+2},${R} L 0,${R} Z`} fill={overlayDark} pointerEvents="none" />
                  : <path d={`M 0,${-R} A ${R},${R} 0 0,0 0,${R} Z`} fill={overlayDark} pointerEvents="none" />)}
                {isEditAge ? (
                  <foreignObject x={-R} y={-10} width={SZ} height={20}>
                    <input autoFocus defaultValue={ageVal}
                      onBlur={e => finishEditingAge(nd.id, e.target.value)}
                      onKeyDown={e => { e.stopPropagation(); if(e.key === 'Enter') finishEditingAge(nd.id, e.target.value); }}
                      style={{ width: '100%', height: '100%', textAlign: 'center', fontSize: '13px', fontFamily: TEXT_FONT, border: 'none', background: 'transparent', outline: 'none', color: txtC, fontWeight: 'bold', padding: 0 }} />
                  </foreignObject>
                ) : (
                  <>
                    {isIP && !ageVal && <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight={isIP && !isDouble ? 'normal' : 'bold'} fill={isDouble ? '#ef4444' : txtC} stroke={isIP && !isDouble ? '#1e293b' : 'white'} strokeWidth={isIP && !isDouble ? 0 : 3} paintOrder="stroke" strokeLinejoin="round" style={{fontFamily: TEXT_FONT, pointerEvents: 'none'}}>案主</text>}
                    {ageVal && <text x="0" y="4" textAnchor="middle" fontSize="13" fontWeight="bold" fill={txtC} stroke={isIP && !isDouble ? '#1e293b' : 'white'} strokeWidth={isIP && !isDouble ? 0 : 3} paintOrder="stroke" strokeLinejoin="round" style={{fontFamily: TEXT_FONT, pointerEvents: 'none'}}>{ageVal}</text>}
                  </>
                )}
                {deceasedIds.includes(nd.id) && <g pointerEvents="none">
                  <line x1={-R} y1={-R} x2={R} y2={R} stroke="white" strokeWidth="5" strokeLinecap="round" />
                  <line x1={R} y1={-R} x2={-R} y2={R} stroke="white" strokeWidth="5" strokeLinecap="round" />
                  <line x1={-R} y1={-R} x2={R} y2={R} stroke={overlayDark} strokeWidth="2.5" />
                  <line x1={R} y1={-R} x2={-R} y2={R} stroke={overlayDark} strokeWidth="2.5" />
                </g>}
              </g>
            );
          })}

          {/* === 生態圖節點 (鈷藍色動態橢圓) === */}
          {freeNodes.filter(fn => fn.type === 'eco').map(ecoNode => {
            const rx = ecoRx(ecoNode.text);
            const isEditingThis = editingEcoId === ecoNode.id;
            return (
              <g key={ecoNode.id} transform={`translate(${ecoNode.x},${ecoNode.y})`} style={{ cursor: drag?.id === ecoNode.id ? 'grabbing' : 'grab', touchAction: 'none' }}
                 onPointerDown={e => onDown(e, ecoNode.id)}
                 onDoubleClick={e => { e.stopPropagation(); setEditingEcoId(ecoNode.id); }}>
                <ellipse cx="0" cy="0" rx={rx} ry={ECO_RY} fill="#2563eb" stroke="#1e40af" strokeWidth="2.5" />
                {isEditingThis ? (
                  <foreignObject x={-rx + 4} y={-14} width={(rx - 4) * 2} height={28}>
                    <input autoFocus defaultValue={ecoNode.text || ''}
                      onBlur={e => finishEditingEco(ecoNode.id, e.target.value)}
                      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') finishEditingEco(ecoNode.id, e.target.value); }}
                      style={{ width: '100%', height: '100%', textAlign: 'center', fontSize: '13px', fontFamily: TEXT_FONT, border: 'none', background: 'transparent', outline: 'none', color: 'white', fontWeight: 'bold', padding: 0 }} />
                  </foreignObject>
                ) : (
                  <text x="0" y="4" textAnchor="middle" fontSize="13" fontWeight="bold" fill="white" style={{ fontFamily: TEXT_FONT, pointerEvents: 'none' }}>{ecoNode.text || ''}</text>
                )}
              </g>
            );
          })}

          {/* === 獨立個體節點 (懷孕／流產／死產，三角形) === */}
          {freeNodes.filter(fn => STANDALONE_TYPES.includes(fn.type)).map(fn => {
            const r = standaloneRadius(fn.type);
            const hasCross = fn.type !== 'pregnancy';
            return (
              <g key={fn.id} transform={`translate(${fn.x},${fn.y})`} style={{ cursor: drag?.id === fn.id ? 'grabbing' : 'grab', touchAction: 'none' }}
                 onPointerDown={e => onDown(e, fn.id)}
                 onDoubleClick={e => {
                   e.stopPropagation();
                   if (window.confirm('確定要刪除這個標記嗎？(相關連線也會一併刪除)')) {
                     setCustomLinks(prev => prev.filter(l => l.sourceId !== fn.id && l.targetId !== fn.id));
                     setFreeNodes(prev => prev.filter(f => f.id !== fn.id));
                   }
                 }}>
                <path d={trianglePath(r)} fill="white" stroke="#333" strokeWidth="2.5" strokeLinejoin="round" />
                {hasCross && triangleCrossLines(r).map(([x1, y1, x2, y2], i) => (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#333" strokeWidth="1.5" pointerEvents="none" />
                ))}
                <title>{SYMBOL_MAP[fn.type]?.label}</title>
              </g>
            );
          })}

          {/* === 自訂連線 (customLinks) === */}
          {customLinks.map(lnk => {
            const sp = pos(lnk.sourceId), tp = pos(lnk.targetId);
            const isEcoLink = lnk.type === 'eco';
            const isAnnotationLink = lnk.type === 'annotation';

            if (isEcoLink || isAnnotationLink) {
              // 生態圖／獨立個體註記連線：三角函數邊緣偵測，線條精準停在半徑邊緣
              const srcNode = nodes.find(n => n.id === lnk.sourceId) || freeNodes.find(fn => fn.id === lnk.sourceId);
              const tgtNode = nodes.find(n => n.id === lnk.targetId) || freeNodes.find(fn => fn.id === lnk.targetId);

              const dx = tp.x - sp.x, dy = tp.y - sp.y;
              const angle = Math.atan2(dy, dx);

              const getRadius = (node, ang) => {
                if (node?.type === 'eco') {
                  const rx = ecoRx(node.text);
                  return (rx * ECO_RY) / Math.sqrt(Math.pow(ECO_RY * Math.cos(ang), 2) + Math.pow(rx * Math.sin(ang), 2));
                }
                if (STANDALONE_TYPES.includes(node?.type)) return standaloneRadius(node.type);
                if (node?.gender === 'M') {
                  const cosA = Math.abs(Math.cos(ang)), sinA = Math.abs(Math.sin(ang));
                  return cosA > sinA ? R / cosA : R / sinA;
                }
                return R;
              };

              const r1 = getRadius(srcNode, angle);
              const r2 = getRadius(tgtNode, angle + Math.PI);

              const x1 = sp.x + Math.cos(angle) * r1, y1 = sp.y + Math.sin(angle) * r1;
              const x2 = tp.x - Math.cos(angle) * r2, y2 = tp.y - Math.sin(angle) * r2;

              const cStroke = isEcoLink ? '#2563eb' : '#8b5cf6';
              return (
                <g key={lnk.id}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={cStroke} strokeWidth={isEcoLink ? '2' : '1.5'} />
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="12" style={{ cursor: 'pointer' }} onDoubleClick={e => { e.stopPropagation(); deleteCustomLink(lnk.id); }} />
                </g>
              );
            }

            const isSpLeft = sp.x < tp.x;
            const x1 = isSpLeft ? sp.x + R : sp.x - R;
            const x2 = isSpLeft ? tp.x - R : tp.x + R;
            const midX = (x1 + x2) / 2, midY = (sp.y + tp.y) / 2;
            const cStroke = extColorMode === 'blue' ? '#3b82f6' : '#444';
            return (
              <g key={lnk.id}>
                <line x1={x1} y1={sp.y} x2={x2} y2={tp.y} stroke={cStroke} strokeWidth="2" />
                {lnk.status === 'divorced' && <>
                  <line x1={midX-8} y1={midY-8} x2={midX+8} y2={midY+8} stroke={cStroke} strokeWidth="2" />
                  <line x1={midX-8} y1={midY+8} x2={midX+8} y2={midY-8} stroke={cStroke} strokeWidth="2" />
                </>}
                <line x1={x1} y1={sp.y} x2={x2} y2={tp.y} stroke="transparent" strokeWidth="12" style={{ cursor: 'pointer' }} onDoubleClick={e => { e.stopPropagation(); deleteCustomLink(lnk.id); }} />
              </g>
            );
          })}

          {/* 工具箱拖曳「關係品質」符號經過時的高亮：只是預覽，放開才會真的貼上 */}
          {symbolDrag?.hoverLineId && (() => {
            const seg = marriageLineSegs.find(s => s.id === symbolDrag.hoverLineId);
            if (!seg) return null;
            const pa = pos(seg.a), pb = pos(seg.b);
            return <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#3b82f6" strokeWidth="7" strokeDasharray="5,4" opacity="0.5" pointerEvents="none" />;
          })()}

          {/* === 關係品質標記 (疏離／衝突／斷絕／暴力，疊加在婚姻線上) === */}
          {Object.entries(doc.lineAttrs).map(([lineId, key]) => {
            const seg = marriageLineSegs.find(s => s.id === lineId);
            if (!seg) return null;
            const pa = pos(seg.a), pb = pos(seg.b);
            const isLeft = pa.x <= pb.x;
            const x1 = isLeft ? pa.x + R : pa.x - R, y1 = pa.y;
            const x2 = isLeft ? pb.x - R : pb.x + R, y2 = pb.y;
            const eraseW = 6;
            if (key === 'distant') return (
              <g key={`rel-${lineId}`} pointerEvents="none">
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth={eraseW} />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#444" strokeWidth="2" strokeDasharray={DISTANT_DASH} />
              </g>
            );
            if (key === 'conflict' || key === 'violence') {
              const isViolence = key === 'violence';
              return (
                <g key={`rel-${lineId}`} pointerEvents="none">
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth={eraseW} />
                  <polyline points={zigzagPoints(x1, y1, x2, y2, isViolence ? 6 : 5)} fill="none" stroke={isViolence ? '#dc2626' : '#444'} strokeWidth={isViolence ? '2.5' : '2'} />
                </g>
              );
            }
            if (key === 'cutoff') return (
              <g key={`rel-${lineId}`} pointerEvents="none">
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth={eraseW} />
                {gapSegments(x1, y1, x2, y2).map(([sx1, sy1, sx2, sy2], i) => (
                  <line key={i} x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke="#444" strokeWidth="2" />
                ))}
              </g>
            );
            if (key === 'closeRelationship') return (
              <g key={`rel-${lineId}`} pointerEvents="none">
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth={eraseW} />
                {doubleLineSegments(x1, y1, x2, y2).map(([sx1, sy1, sx2, sy2], i) => (
                  <line key={i} x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke="#444" strokeWidth="2" />
                ))}
              </g>
            );
            if (key === 'deteriorating') return (
              <g key={`rel-${lineId}`} pointerEvents="none">
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth={eraseW} />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#444" strokeWidth="2" />
                {hatchSegments(x1, y1, x2, y2).map(([sx1, sy1, sx2, sy2], i) => (
                  <line key={i} x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke="#444" strokeWidth="2" />
                ))}
              </g>
            );
            return null;
          })}

          {texts.map(t => {
            const lines = (t.text || '').split('\n');
            const maxLineLen = Math.max(...lines.map(l => l.length), 1);
            const estW = t.vertical ? t.fontSize * 1.5 * lines.length : maxLineLen * t.fontSize * 0.7;
            const estH = t.vertical ? maxLineLen * t.fontSize * 1.2 : t.fontSize * 1.3 * lines.length;
            const isSel = selectedTextId === t.id;
            const isEditing = editingTextId === t.id;

            return (
              <g key={t.id} transform={`translate(${t.x},${t.y})`}>
                {isSel && !isEditing && <rect x="-4" y={t.vertical ? -4 : -t.fontSize} width={estW + 12} height={estH + 8} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4,3" rx="3" />}

                {isEditing ? (
                  <foreignObject x="0" y={-t.fontSize} width={Math.max(estW, 150) + 20} height={Math.max(estH, 60) + 30}>
                    <textarea
                      autoFocus
                      defaultValue={t.text}
                      onBlur={(e) => finishEditingText(t.id, e.target.value)}
                      onKeyDown={(e) => { e.stopPropagation(); }}
                      style={{ width: '100%', height: '100%', fontSize: `${t.fontSize}px`, fontFamily: TEXT_FONT, border: '2px dashed #3b82f6', outline: 'none', background: 'rgba(255,255,255,0.95)', resize: 'both', borderRadius: '4px', padding: '4px' }}
                    />
                  </foreignObject>
                ) : (
                  <text style={{ fontFamily: TEXT_FONT, fontSize: t.fontSize, writingMode: t.vertical ? 'vertical-rl' : undefined, touchAction: 'none' }} fill="#333" cursor="move" onPointerDown={e => onTextDown(e, t.id)} onClick={e => onTextClick(e, t.id)} onDoubleClick={e => onTextDoubleClick(e, t.id)}>
                    {lines.map((line, idx) => (
                      <tspan key={idx} x={t.vertical ? undefined : "0"} dy={idx === 0 ? 0 : "1.2em"}>{line}</tspan>
                    ))}
                  </text>
                )}

                {isSel && !isEditing && (
                  <g>
                    <g transform={`translate(${estW+8},${t.vertical ? -4 : -t.fontSize})`} style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); deleteText(t.id); }}><circle r="10" fill="white" stroke="#ef4444" strokeWidth="1.5" /><text y="4" textAnchor="middle" fontSize="11" fill="#ef4444" style={{fontFamily: TEXT_FONT}}>✕</text></g>
                    <g transform={`translate(${estW+8},${t.vertical ? estH+4 : estH - t.fontSize + 4})`} style={{ cursor: 'nwse-resize', touchAction: 'none' }} onPointerDown={e => onResizeDown(e, t.id)}><circle r="8" fill="#3b82f6" /><text y="3.5" textAnchor="middle" fontSize="9" fill="white" style={{fontFamily: TEXT_FONT}}>↘</text></g>
                  </g>
                )}
              </g>
            );
          })}

          {/* 橡皮擦模式的擷取層：蓋在最上面，讓節點與文字方塊在擦除時不會被誤拖。
              fill 透明所以不影響匯出結果。 */}
          {eraseMode && bgImage && (
            <rect
              width="100%" height="100%" fill="transparent"
              style={{ cursor: 'crosshair', touchAction: 'none' }}
              onPointerDown={eraseStart}
              onPointerMove={eraseMoveTo}
              onPointerUp={eraseEnd}
              onPointerLeave={eraseEnd}
              onPointerCancel={eraseEnd}
              onClick={e => e.stopPropagation()}
            />
          )}
        </svg>
      </div>

      {/* 跟著游標的拖曳分身：讓使用者清楚知道手上拿著哪個符號 */}
      {symbolDrag && (
        <div className="sym-ghost" style={{ left: symbolDrag.x, top: symbolDrag.y }}>
          <SymbolPreview symbol={SYMBOL_MAP[symbolDrag.key]} size={18} />
          {SYMBOL_MAP[symbolDrag.key].label}
        </div>
      )}
    </div>
  );
};

export default GenogramTab;
