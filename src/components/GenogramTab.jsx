import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  SZ, R, COUPLE_GAP, SIBLING_GAP, GEN_Y, TEXT_FONT,
  G2_STATUSES, G2_LABELS, G1_STATUSES, G1_LABELS,
  TEXT_DIRS, TEXT_DIR_LABELS,
  parseGenders, getSmoothPath, getRelativeTitle
} from '../utils/helpers';

const CUSTOM_LINK_STATUSES = ['married', 'divorced'];
const CUSTOM_LINK_LABELS = { married: '已婚', divorced: '離婚' };
const EXT_COLOR_MODES = ['black', 'blue'];
const EXT_COLOR_LABELS = { black: '一般', blue: '編輯' };

const ecoRx = (text) => Math.max(35, (text?.length || 1) * 9 + 15);
const ECO_RY = 28;

const GenogramTab = ({
  gen2Str, setGen2Str, gen2Cfg, setGen2Cfg,
  indexId, setIndexId,
  cohabMembers, setCohabMembers,
  deceasedIds, setDeceasedIds,
  disabledIds, setDisabledIds,
  g1Status, setG1Status,
  freeNodes, setFreeNodes,
  customLinks, setCustomLinks
}) => {
  /* --- 家系圖本地狀態 --- */
  const [positions, setPositions] = useState({});
  const [drag, setDrag] = useState(null);
  const [mode, setMode] = useState(null);
  const [cohabMode, setCohabMode] = useState('auto');
  const [cohabSolid, setCohabSolid] = useState(false);
  const [ipStyle, setIpStyle] = useState('filled');
  const [polygons, setPolygons] = useState([]);
  const [draftPoly, setDraftPoly] = useState([]);
  const [selectedPolyId, setSelectedPolyId] = useState(null);
  const [dragVertex, setDragVertex] = useState(null);

  // 持續同步的 ref，讓 useMemo / useCallback 可讀取最新值，但不觸發多餘的 re-compute
  const freeNodesRef = useRef(freeNodes);
  freeNodesRef.current = freeNodes;
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const [texts, setTexts] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [textDrag, setTextDrag] = useState(null);
  const [textResize, setTextResize] = useState(null);
  const [textDirection, setTextDirection] = useState('horizontal');
  const textDragMoved = useRef(false);
  const [mousePos, setMousePos] = useState(null);

  /* --- 擴充區顏色模式 --- */
  const [extColorMode, setExtColorMode] = useState('black');

  /* --- 年齡與文字編輯狀態 --- */
  const [showAgeMode, setShowAgeMode] = useState(false);
  const [ages, setAges] = useState({});
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      if (key === 'q') setMode(p => p === 'index' ? null : 'index');
      if (key === 'w') setMode(p => p === 'disabled' ? null : 'disabled');
      if (key === 'e') setMode(p => p === 'deceased' ? null : 'deceased');
      if (key === 'r') setMode(p => p === 'cohab' ? null : 'cohab');
      if (e.key === 'Enter' && mode === 'cohab' && cohabMode === 'poly' && draftPoly.length >= 3) {
        setPolygons(prev => [...prev, { id: 'pg_' + Date.now(), pts: draftPoly }]); setDraftPoly([]); setMousePos(null);
      }
      if (e.key === 'Escape' && draftPoly.length > 0) { setDraftPoly([]); setMousePos(null); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftPoly, mode, cohabMode]);

  const onGen2Change = (val) => {
    setGen2Str(val);
    const gs = parseGenders(val);
    setGen2Cfg(prev => gs.map((g, i) => (prev[i] && prev[i].gender === g) ? prev[i] : { gender: g, partner: 'none', g3Str: '', isMulti: false }));
  };

  const changePartner = (i, status) => setGen2Cfg(p => p.map((d, j) => j === i ? { ...d, partner: status, g3Str: status === 'none' ? '' : d.g3Str } : d));
  const setG3 = (i, v) => setGen2Cfg(p => p.map((d, j) => j === i ? { ...d, g3Str: v } : d));
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
    const units = gen2Cfg.map((c, i) => {
      const isMarried = c.partner !== 'none';
      const g3 = isMarried ? parseGenders(c.g3Str) : [];
      let w = !isMarried ? SIBLING_GAP : Math.max(COUPLE_GAP + SZ, g3.length > 0 ? (g3.length - 1) * SIBLING_GAP + SZ : 0) + 50;
      return { ...c, idx: i, g3, w, isMarried };
    });
    const totalW = units.reduce((s, u) => s + u.w, 0) || 200;
    const originX = Math.max(120, 420 - totalW / 2);
    const fX = originX + totalW / 2 - COUPLE_GAP / 2, mX = originX + totalW / 2 + COUPLE_GAP / 2, parentMidX = (fX + mX) / 2;
    N.push({ id: 'fa', gender: 'M', gen: 0, dx: fX, dy: GEN_Y[0], label: '父' }, { id: 'mo', gender: 'F', gen: 0, dx: mX, dy: GEN_Y[0], label: '母' });
    L.push({ id: 'ml-g1', type: 'marry', a: 'fa', b: 'mo', status: g1Status });

    let cx = originX; const g2ids = [];
    units.forEach((u, i) => {
      const cid = `c${i}`, midU = cx + u.w / 2;
      if (u.isMarried) {
        const lx = units.length === 1 ? parentMidX : midU - COUPLE_GAP / 2;
        const rx = units.length === 1 ? parentMidX + COUPLE_GAP : midU + COUPLE_GAP / 2;
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
        N.push({ id: cid, gender: u.gender, gen: 1, dx: midU, dy: GEN_Y[1], label: `${u.gender === 'M'?'子':'女'}${i+1}`, isMulti: u.isMulti });
        g2ids.push(cid);
      }
      cx += u.w;
    });
    if (g2ids.length > 0) L.push({ id: 'pc-g1', type: 'pc', pa: 'fa', pb: 'mo', kids: g2ids });

    // === customLink kidsCfg → 整合為完全體節點 ===
    customLinks.forEach(lnk => {
      if (lnk.type === 'eco') return; // 生態圖連線不參與節點生成
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

  const onDown = useCallback((e, id) => {
    e.stopPropagation(); const sp = svgPt(e); const p = pos(id);
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

  const onMove = useCallback((e) => {
    const sp = svgPt(e);
    if (draftPoly.length > 0) setMousePos({ x: sp.x, y: sp.y });
    if (dragVertex) { setPolygons(p => p.map(pg => pg.id !== dragVertex.polyId ? pg : { ...pg, pts: pg.pts.map((pt, i) => i === dragVertex.index ? { x: sp.x - dragVertex.ox, y: sp.y - dragVertex.oy } : pt) })); return; }
    if (textResize) { setTexts(p => p.map(t => t.id === textResize.id ? { ...t, fontSize: Math.max(10, Math.min(72, Math.round(textResize.startSize + (sp.y - textResize.startY) * 0.3))) } : t)); return; }
    if (textDrag) { textDragMoved.current = true; setTexts(p => p.map(t => t.id === textDrag.id ? { ...t, x: sp.x - textDrag.ox, y: sp.y - textDrag.oy } : t)); return; }
    if (!drag) return;

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

      // 2. 沒吸到伴侶時，啟動 12px 全域磁吸 (對齊網格上其他人)
      if (!matchedPartner) {
        for (const p of allSnaps) {
          if (Math.abs(newX - p.x) < 12) newX = p.x;
          if (Math.abs(newY - p.y) < 12) newY = p.y;
        }
      }
      setFreeNodes(prev => prev.map(fn => fn.id === drag.id ? { ...fn, x: newX, y: newY } : fn));
    } else {
      // 原生節點：啟動 12px 全域磁吸
      setPositions(prev => { 
        let nX = sp.x - drag.ox, nY = sp.y - drag.oy; 
        for (const p of allSnaps) { 
          if (Math.abs(nX - p.x) < 12) nX = p.x; 
          if (Math.abs(nY - p.y) < 12) nY = p.y; 
        } 
        return { ...prev, [drag.id]: { x: nX, y: nY } }; 
      });
    }
  }, [drag, textDrag, textResize, dragVertex, draftPoly, svgPt, setFreeNodes, customLinks, nodes]);

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
            const newLinkType = draggedIsEco ? 'eco' : undefined;
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
    setDragVertex(null); setDrag(null); setTextDrag(null); setTextResize(null);
  }, [drag, freeNodes, nodes, pos, customLinks, setCustomLinks, setFreeNodes]);

  const onClick = (e, id) => {
    e.stopPropagation();
    if (mode === 'index') setIndexId(p => p === id ? null : id);
    else if (mode === 'cohab' && cohabMode === 'auto') setCohabMembers(p => p.includes(id) ? p.filter(m => m !== id) : [...p, id]);
    else if (mode === 'deceased') setDeceasedIds(p => p.includes(id) ? p.filter(m => m !== id) : [...p, id]);
    else if (mode === 'disabled') setDisabledIds(p => p.includes(id) ? p.filter(m => m !== id) : [...p, id]);
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

  const downloadJPG = () => {
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
    if (cohabitationBox && cohabitationBox.type === 'single') { allXs.push(cohabitationBox.x, cohabitationBox.x + cohabitationBox.w); allYs.push(cohabitationBox.y, cohabitationBox.y + cohabitationBox.h); }
    else if (cohabitationBox && cohabitationBox.type === 'poly') { cohabitationBox.points.forEach(pt => { allXs.push(pt.x); allYs.push(pt.y); }); }
    if (allXs.length === 0) return;
    const minX = Math.min(...allXs) - PAD, minY = Math.min(...allYs) - PAD, cropW = Math.max(...allXs) + PAD - minX, cropH = Math.max(...allYs) + PAD - minY;
    const cloned = svgRef.current.cloneNode(true); cloned.setAttribute('width', cropW); cloned.setAttribute('height', cropH); cloned.setAttribute('viewBox', `${minX} ${minY} ${cropW} ${cropH}`);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(cloned)], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = cropW * 3; canvas.height = cropH * 3;
      const ctx = canvas.getContext('2d'); ctx.scale(3, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cropW, cropH); ctx.drawImage(img, 0, 0, cropW, cropH);
      URL.revokeObjectURL(url); canvas.toBlob(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'genogram.jpg'; a.click(); URL.revokeObjectURL(a.href); }, 'image/jpeg', 1.0);
    }; img.src = url;
  };

  /* ===== SVG 尺寸計算 ===== */
  const allX = nodes.map(n => positions[n.id]?.x ?? n.dx).concat(texts.map(t => t.x + 100), freeNodes.map(fn => {
    if (fn.type === 'eco') return fn.x + ecoRx(fn.text);
    return fn.x + 100;
  }));
  const allY = nodes.map(n => positions[n.id]?.y ?? n.dy).concat(texts.map(t => t.y + 100), freeNodes.map(fn => fn.y + 100));
  const svgW = Math.max(800, (allX.length ? Math.max(...allX) : 0) + 160);
  const svgH = Math.max(520, (allY.length ? Math.max(...allY) : 0) + 80);

  /* ===== 介面渲染 ===== */
  return (
    <div className="app-layout">
      {/* 左側面板 */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <h2>資料輸入面板</h2>
            <label className="toggle-switch" title="切換是否在節點上顯示年齡">
              <span className="toggle-text">年齡</span>
              <input type="checkbox" checked={showAgeMode} onChange={() => setShowAgeMode(!showAgeMode)} />
              <span className="toggle-track" aria-hidden="true"></span>
            </label>
          </div>
          <div className="panel-header-actions">
            <button className="btn-action btn-primary" onClick={downloadJPG}>下載</button>
            <button className="btn-action btn-danger" onClick={() => { if(window.confirm('確定重置？')) { setGen2Str(''); setGen2Cfg([]); setIndexId(null); setCohabMembers([]); setDeceasedIds([]); setDisabledIds([]); setCohabSolid(false); setPolygons([]); setTexts([]); setAges({}); setFreeNodes([]); setCustomLinks([]); setPositions({}); setIpStyle('filled'); } }}>重置</button>
          </div>
        </div>

        <div className="quick-tool-panel">
          <div className="quick-tool-header">
            <span className="quick-tool-title">快捷操作工具列</span>
            <span className="quick-tool-hint">點擊或按 [Q / W / E / R] 切換。</span>
          </div>

          <div className="quick-tool-rows">

            {/* 排 1: 案主 [Q] + 身障 [W] */}
            <div className="quick-tool-row-group">
              <div className="quick-tool-row">
                <button className={`quick-tool-btn tone-blue ${mode === 'index' ? 'active' : ''}`}
                        onClick={() => setMode(mode === 'index' ? null : 'index')}>
                  案主 [Q]
                </button>
                <span className="status-badge" onClick={() => setIpStyle(ipStyle === 'filled' ? 'double' : 'filled')} ref={el => wheelRef(el, ['filled', 'double'], ipStyle, setIpStyle)}
                      style={{ fontSize: '12px', padding: '2px 10px', margin: 0, cursor: 'pointer', borderRadius: '999px', userSelect: 'none', transition: 'all 0.2s',
                               background: ipStyle === 'filled' ? '#dbeafe' : '#e0e7ff', color: ipStyle === 'filled' ? '#1e40af' : '#3730a3', border: `1px solid ${ipStyle === 'filled' ? '#bfdbfe' : '#c7d2fe'}` }}>
                  {ipStyle === 'filled' ? '填滿' : '雙線'}
                </span>
              </div>
              <div className="quick-tool-row">
                <button className={`quick-tool-btn tone-purple ${mode === 'disabled' ? 'active' : ''}`}
                        onClick={() => setMode(mode === 'disabled' ? null : 'disabled')}>
                  身障 [W]
                </button>
              </div>
            </div>

            {/* 排 2: 死亡 [E] + 同住 [R] */}
            <div className="quick-tool-row-group">
              <div className="quick-tool-row">
                <button className={`quick-tool-btn tone-red ${mode === 'deceased' ? 'active' : ''}`}
                        onClick={() => setMode(mode === 'deceased' ? null : 'deceased')}>
                  死亡 [E]
                </button>
              </div>
              <div className="quick-tool-row">
                <button className={`quick-tool-btn tone-amber ${mode === 'cohab' ? 'active' : ''}`}
                        onClick={() => setMode(mode === 'cohab' ? null : 'cohab')}>
                  同住 [R]
                </button>
                <span className="status-badge" onClick={() => setCohabMode(cohabMode === 'auto' ? 'poly' : 'auto')} ref={el => wheelRef(el, ['auto', 'poly'], cohabMode, setCohabMode)}
                      style={{ fontSize: '12px', padding: '2px 10px', margin: 0, cursor: 'pointer', borderRadius: '999px', userSelect: 'none', transition: 'all 0.2s',
                               background: cohabMode === 'auto' ? '#fef3c7' : '#ffedd5', color: cohabMode === 'auto' ? '#b45309' : '#c2410c', border: `1px solid ${cohabMode === 'auto' ? '#fde68a' : '#fed7aa'}` }}>
                  {cohabMode === 'auto' ? '自動' : '點繪'}
                </span>
                <span className="status-badge" onClick={() => setCohabSolid(!cohabSolid)} ref={el => wheelRef(el, [false, true], cohabSolid, setCohabSolid)}
                      style={{ fontSize: '12px', padding: '2px 10px', margin: 0, cursor: 'pointer', borderRadius: '999px', userSelect: 'none', transition: 'all 0.2s',
                               background: cohabSolid ? '#e0f2fe' : '#f3f4f6', color: cohabSolid ? '#0369a1' : '#4b5563', border: `1px solid ${cohabSolid ? '#bae6fd' : '#e5e7eb'}` }}>
                  {cohabSolid ? '實線' : '虛線'}
                </span>
              </div>
            </div>

          </div>
        </div>

        <div className="section">
          <label>第一代（父母）</label>
          <div className="sub" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="hint" style={{ margin: 0 }}>系統預設一對父母 ■ 父 ● 母</span>
            <span className="status-badge" data-status={g1Status} ref={el => wheelRef(el, G1_STATUSES, g1Status, setG1Status)}>{G1_LABELS[g1Status]}</span>
          </div>
        </div>

        <div className="section">
          <label>第二代子女順序</label>
          <input type="text" value={gen2Str} onChange={e => onGen2Change(e.target.value)} placeholder="例：女女男男女 或 FFMMF 或 11221" />
          <div className="hint" style={{marginTop: '6px'}}>輸入「男/女」(中文)、「M/F」(英文) 或「1/2」(數字)，即時產生子代節點。</div>
        </div>

        {gen2Cfg.length > 0 && (
          <div className="section">
            <label>第二代成員設定</label>
            {gen2Cfg.map((c, i) => (
              <div key={i}>
                <div className="child-row">
                  <span className={`child-icon ${c.gender === 'M' ? 'm' : 'f'}`}>{c.gender === 'M' ? '■' : '●'}</span>
                  <span className={`child-name ${c.gender === 'M' ? 'm' : 'f'}`}>{getRelativeTitle(c.gender, i, gen2Cfg)}</span>
                  <div className="chk-wrap">
                    <label><input type="checkbox" checked={c.isMulti || false} onChange={() => toggleMulti(i)} /> 多胞胎</label>
                    <span className="status-badge" data-status={c.partner || 'none'} ref={el => wheelRef(el, G2_STATUSES, c.partner || 'none', v => changePartner(i, v))} style={{marginLeft: '8px'}}>{G2_LABELS[c.partner || 'none']}</span>
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

        <div className="section" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <label style={{ margin: 0 }}>📝 文字方塊</label>
          <span className="status-badge" data-status={textDirection} ref={el => wheelRef(el, TEXT_DIRS, textDirection, setTextDirection)} title="滾輪切換：橫式/直式">{TEXT_DIR_LABELS[textDirection]}</span>
          <button onClick={addText} style={{ padding: '4px 10px', fontSize: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto' }}>➕ 新增</button>
          <div className="hint" style={{ width: '100%', marginTop: '0' }}>單擊選取文字方塊（顯示框線）；雙擊可編輯內容；選取後可刪除或拖曳右下角縮放。</div>
        </div>

        <div className="section">
          <label>🧩 自由擴充區</label>
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => addFreeNode('M')} style={{ padding: '5px 10px', fontSize: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>➕ 男性</button>
            <button onClick={() => addFreeNode('F')} style={{ padding: '5px 10px', fontSize: '12px', background: '#ec4899', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>➕ 女性</button>
            <button onClick={addEcoNode} style={{ padding: '5px 10px', fontSize: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>➕ 生態圖</button>
            <span className="status-badge" data-status={extColorMode === 'blue' ? 'horizontal' : 'none'} ref={el => wheelRef(el, EXT_COLOR_MODES, extColorMode, setExtColorMode)} title="滾輪切換：一般/編輯">{EXT_COLOR_LABELS[extColorMode]}</span>
          </div>
          <div className="hint" style={{ marginTop: '6px' }}>拖曳擴充個體碰撞目標即可產生連線；生態圖新增後預設連結案主。</div>
        </div>

        {customLinks.length > 0 && (
          <div className="section">
            <label>🔗 擴充連線設定</label>
            {customLinks.map(lnk => {
              const isEcoLink = lnk.type === 'eco';
              const srcNode = nodes.find(n => n.id === lnk.sourceId) || freeNodes.find(n => n.id === lnk.sourceId);
              const tgtNode = nodes.find(n => n.id === lnk.targetId) || freeNodes.find(n => n.id === lnk.targetId);
              const srcLabel = srcNode?.type === 'eco' ? (srcNode?.text || '生態圖') : (srcNode?.label || (srcNode?.gender === 'M' ? '■' : '●'));
              const tgtLabel = tgtNode?.type === 'eco' ? (tgtNode?.text || '生態圖') : (tgtNode?.label || (tgtNode?.gender === 'M' ? '■' : '●'));
              return (
                <div key={lnk.id} style={{ background: isEcoLink ? '#eff6ff' : '#f8fafc', border: `1px solid ${isEcoLink ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: '6px', padding: '8px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span>{isEcoLink ? '🌐 ' : ''}{srcLabel} ↔ {tgtLabel}</span>
                    {!isEcoLink && <span className="status-badge" data-status={lnk.status} ref={el => wheelRef(el, CUSTOM_LINK_STATUSES, lnk.status, v => updateCustomLink(lnk.id, 'status', v))}>{CUSTOM_LINK_LABELS[lnk.status]}</span>}
                    <button onClick={() => deleteCustomLink(lnk.id)} style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '11px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>刪除</button>
                  </div>
                  {!isEcoLink && (
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
                                  <span className="status-badge" data-status={kc.partner || 'none'} ref={el => wheelRef(el, G2_STATUSES, kc.partner || 'none', v => setCustomLinks(prev => prev.map(l => l.id === lnk.id ? { ...l, kidsCfg: l.kidsCfg.map((k, idx) => idx === ki ? { ...k, partner: v, g3Str: v === 'none' ? '' : k.g3Str } : k) } : l)))}>{G2_LABELS[kc.partner || 'none']}</span>
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

        <div className="section">
          <label>操作說明</label>
          <div className="info-box">
            快捷鍵切換模式：[Q] 案主 / [W] 身障 / [E] 死亡 / [R] 同住<br/>
            ■ / ●：點擊節點切換案主；雙擊可輸入年齡。<br/>
            狀態切換：滑鼠停在狀態標籤上【上下滾動滾輪】即可切換。<br/>
            文字方塊：單擊選取/縮放；雙擊直接打字 (可 Enter 換行)。<br/>
            自由連線：拖曳【🧩擴充個體】去碰撞目標即可產生連線；雙擊關係線可刪除。<br/>
            生態圖：新增後預設連結案主，雙擊圖形可編輯文字，清空文字即刪除；雙擊關係線可刪除連線並重新拖曳碰撞。
          </div>
        </div>
      </div>

      {/* SVG 畫布 */}
      <div className="canvas-wrap">
        <svg ref={svgRef} width={svgW} height={svgH} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onClick={() => { setSelectedTextId(null); setSelectedPolyId(null); }} style={{ background: '#fefefe', minWidth: '600px', cursor: mode === 'cohab' && cohabMode === 'poly' ? 'crosshair' : undefined }}>
          <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="0.5" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {mode === 'cohab' && cohabMode === 'poly' && (
            <rect width="100%" height="100%" fill="transparent" style={{ cursor: 'crosshair' }} onClick={e => { e.stopPropagation(); const sp = svgPt(e); const pt = { x: sp.x, y: sp.y }; if (draftPoly.length >= 3 && Math.sqrt(Math.pow(pt.x - draftPoly[0].x,2) + Math.pow(pt.y - draftPoly[0].y,2)) < 15) { setPolygons(p => [...p, { id: 'pg_' + Date.now(), pts: draftPoly }]); setDraftPoly([]); setMousePos(null); return; } setDraftPoly(p => [...p, pt]); }} />
          )}

          {cohabitationBox && cohabitationBox.type === 'single' && <rect x={cohabitationBox.x} y={cohabitationBox.y} width={cohabitationBox.w} height={cohabitationBox.h} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray={cohabSolid ? "0" : "8,6"} rx="15" />}
          {cohabitationBox && cohabitationBox.type === 'poly' && <path d={getSmoothPath(cohabitationBox.points, true)} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray={cohabSolid ? "0" : "8,6"} strokeLinejoin="round" />}

          {polygons.map(pg => (
            <g key={pg.id}>
              <path d={getSmoothPath(pg.pts, true)} fill="rgba(239, 68, 68, 0.05)" stroke="#ef4444" strokeWidth="2.5" strokeDasharray={cohabSolid ? "0" : "8,6"} strokeLinejoin="round" style={{ cursor: !mode ? 'pointer' : undefined }} onClick={e => { if (!mode) { e.stopPropagation(); setSelectedPolyId(pg.id); } }} onDoubleClick={e => { e.stopPropagation(); setPolygons(p => p.filter(x => x.id !== pg.id)); setSelectedPolyId(null); }} />
              {selectedPolyId === pg.id && pg.pts.map((pt, idx) => <circle key={`v${idx}`} cx={pt.x} cy={pt.y} r={6} fill="#3b82f6" stroke="white" strokeWidth="1.5" style={{ cursor: 'crosshair' }} onMouseDown={e => { e.stopPropagation(); const sp = svgPt(e); setDragVertex({ polyId: pg.id, index: idx, ox: sp.x - pt.x, oy: sp.y - pt.y }); }} />)}
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
                else els.push(<line key={`${ln.id}-k${j}`} x1={kp.x} y1={barY} x2={kp.x} y2={kp.y - R} stroke={lineColor} strokeWidth="2" />);
              });
              return <g key={ln.id}>{els}</g>;
            } return null;
          })}

          {/* === 所有節點 (原生 + 自由人物) 共用渲染 === */}
          {[
            ...nodes.map(nd => ({ id: nd.id, gender: nd.gender, ...pos(nd.id), stroke: nd.isExt && extColorMode === 'blue' ? '#3b82f6' : '#333', dash: undefined, isFree: false })),
            ...freeNodes.filter(fn => fn.type !== 'eco').map(fn => ({ id: fn.id, gender: fn.gender, x: fn.x, y: fn.y, stroke: extColorMode === 'blue' ? '#3b82f6' : '#333', dash: undefined, isFree: true }))
          ].map(nd => {
            const isIP = nd.id === indexId;
            const isDouble = isIP && ipStyle === 'double';
            const fill = isIP && !isDouble ? '#1e293b' : 'white';
            const txtC = isIP && !isDouble ? 'white' : '#333';
            const overlayDark = isIP && !isDouble ? 'white' : '#333';
            const isEditAge = editingAgeId === nd.id, ageVal = ages[nd.id] || '';
            return (
              <g key={nd.id} transform={`translate(${nd.x},${nd.y})`} style={{ cursor: drag?.id === nd.id ? 'grabbing' : 'grab' }}
                 onMouseDown={e => onDown(e, nd.id)} onClick={e => onClick(e, nd.id)}
                 onDoubleClick={e => {
                   e.stopPropagation();
                   if(showAgeMode) {
                     setEditingAgeId(nd.id);
                   } else if(nd.isFree) {
                     if(window.confirm('確定要刪除這個擴充個體嗎？(相關連線也會一併刪除)')) {
                       setCustomLinks(prev => prev.filter(l => l.sourceId !== nd.id && l.targetId !== nd.id));
                       setFreeNodes(prev => prev.filter(fn => fn.id !== nd.id));
                     }
                   }
                 }}>
                {isDouble && (nd.gender === 'M'
                  ? <rect x={-(R+5)} y={-(R+5)} width={SZ+10} height={SZ+10} fill="none" stroke={nd.stroke} strokeWidth="2.5" rx="3" pointerEvents="none" />
                  : <circle cx="0" cy="0" r={R+5} fill="none" stroke={nd.stroke} strokeWidth="2.5" pointerEvents="none" />)}
                {nd.gender === 'M'
                  ? <rect x={-R} y={-R} width={SZ} height={SZ} fill={fill} stroke={nd.stroke} strokeWidth="2.5" rx="2" strokeDasharray={nd.dash} />
                  : <circle cx="0" cy="0" r={R} fill={fill} stroke={nd.stroke} strokeWidth="2.5" strokeDasharray={nd.dash} />}
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
                    {isIP && (!showAgeMode || !ageVal) && <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="bold" fill={isDouble ? '#ef4444' : txtC} stroke="white" strokeWidth="3" paintOrder="stroke" strokeLinejoin="round" style={{fontFamily: TEXT_FONT, pointerEvents: 'none'}}>案主</text>}
                    {showAgeMode && ageVal && <text x="0" y="4" textAnchor="middle" fontSize="13" fontWeight="bold" fill={txtC} stroke={isIP && !isDouble ? '#1e293b' : 'white'} strokeWidth={isIP && !isDouble ? 0 : 3} paintOrder="stroke" strokeLinejoin="round" style={{fontFamily: TEXT_FONT, pointerEvents: 'none'}}>{ageVal}</text>}
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
              <g key={ecoNode.id} transform={`translate(${ecoNode.x},${ecoNode.y})`} style={{ cursor: drag?.id === ecoNode.id ? 'grabbing' : 'grab' }}
                 onMouseDown={e => onDown(e, ecoNode.id)}
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

          {/* === 自訂連線 (customLinks) === */}
          {customLinks.map(lnk => {
            const sp = pos(lnk.sourceId), tp = pos(lnk.targetId);
            const isEcoLink = lnk.type === 'eco';

            if (isEcoLink) {
              // 生態圖連線：三角函數邊緣偵測，線條精準停在半徑邊緣
              const srcNode = nodes.find(n => n.id === lnk.sourceId) || freeNodes.find(fn => fn.id === lnk.sourceId);
              const tgtNode = nodes.find(n => n.id === lnk.targetId) || freeNodes.find(fn => fn.id === lnk.targetId);

              const dx = tp.x - sp.x, dy = tp.y - sp.y;
              const angle = Math.atan2(dy, dx);

              const getRadius = (node, ang) => {
                if (node?.type === 'eco') {
                  const rx = ecoRx(node.text);
                  return (rx * ECO_RY) / Math.sqrt(Math.pow(ECO_RY * Math.cos(ang), 2) + Math.pow(rx * Math.sin(ang), 2));
                }
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

              const cStroke = '#2563eb';
              return (
                <g key={lnk.id}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={cStroke} strokeWidth="2" />
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
                  <text style={{ fontFamily: TEXT_FONT, fontSize: t.fontSize, writingMode: t.vertical ? 'vertical-rl' : undefined }} fill="#333" cursor="move" onMouseDown={e => onTextDown(e, t.id)} onClick={e => onTextClick(e, t.id)} onDoubleClick={e => onTextDoubleClick(e, t.id)}>
                    {lines.map((line, idx) => (
                      <tspan key={idx} x={t.vertical ? undefined : "0"} dy={idx === 0 ? 0 : "1.2em"}>{line}</tspan>
                    ))}
                  </text>
                )}

                {isSel && !isEditing && (
                  <g>
                    <g transform={`translate(${estW+8},${t.vertical ? -4 : -t.fontSize})`} style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); deleteText(t.id); }}><circle r="10" fill="white" stroke="#ef4444" strokeWidth="1.5" /><text y="4" textAnchor="middle" fontSize="11" fill="#ef4444" style={{fontFamily: TEXT_FONT}}>✕</text></g>
                    <g transform={`translate(${estW+8},${t.vertical ? estH+4 : estH - t.fontSize + 4})`} style={{ cursor: 'nwse-resize' }} onMouseDown={e => onResizeDown(e, t.id)}><circle r="8" fill="#3b82f6" /><text y="3.5" textAnchor="middle" fontSize="9" fill="white" style={{fontFamily: TEXT_FONT}}>↘</text></g>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default GenogramTab;
