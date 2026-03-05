import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  SZ, R, COUPLE_GAP, SIBLING_GAP, GEN_Y, TEXT_FONT,
  G2_STATUSES, G2_LABELS, G1_STATUSES, G1_LABELS,
  TEXT_DIRS, TEXT_DIR_LABELS,
  parseGenders, getSmoothPath, getRelativeTitle
} from '../utils/helpers';

const GenogramTab = ({
  gen2Str, setGen2Str, gen2Cfg, setGen2Cfg,
  indexId, setIndexId,
  cohabMembers, setCohabMembers,
  deceasedIds, setDeceasedIds,
  g1Status, setG1Status
}) => {
  /* --- 家系圖本地狀態 --- */
  const [positions, setPositions] = useState({});
  const [drag, setDrag] = useState(null);
  const [mode, setMode] = useState('drag');
  const [cohabMode, setCohabMode] = useState('auto');
  const [polygons, setPolygons] = useState([]);
  const [draftPoly, setDraftPoly] = useState([]);
  const [selectedPolyId, setSelectedPolyId] = useState(null);
  const [dragVertex, setDragVertex] = useState(null);

  const [texts, setTexts] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [textDrag, setTextDrag] = useState(null);
  const [textResize, setTextResize] = useState(null);
  const [textDirection, setTextDirection] = useState('horizontal');
  const textDragMoved = useRef(false);
  const [mousePos, setMousePos] = useState(null);

  /* --- 年齡與文字編輯狀態 --- */
  const [showAgeMode, setShowAgeMode] = useState(false);
  const [ages, setAges] = useState({});
  const [editingAgeId, setEditingAgeId] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);

  const finishEditingText = (id, newText) => {
    setTexts(prev => prev.map(t => t.id === id ? { ...t, text: newText } : t));
    setEditingTextId(null);
  };
  const finishEditingAge = (id, newAge) => {
    setAges(prev => ({ ...prev, [id]: newAge }));
    setEditingAgeId(null);
  };

  /* --- 快捷鍵狀態 --- */
  const DEFAULT_SHORTCUTS = { drag: 'q', index: 'w', cohab: 'e', deceased: 'r' };
  const [shortcuts, setShortcuts] = useState(() => {
    try { const saved = localStorage.getItem('genogram-shortcuts'); if (saved) return { ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) }; } catch {}
    return DEFAULT_SHORTCUTS;
  });
  useEffect(() => { try { localStorage.setItem('genogram-shortcuts', JSON.stringify(shortcuts)); } catch {} }, [shortcuts]);
  const updateShortcut = (modeName, key) => setShortcuts(prev => ({ ...prev, [modeName]: key }));

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
      if (key === shortcuts.drag) setMode('drag');
      if (key === shortcuts.index) setMode('index');
      if (key === shortcuts.cohab) setMode('cohab');
      if (key === shortcuts.deceased) setMode('deceased');
      if (e.key === 'Enter' && mode === 'cohab' && cohabMode === 'poly' && draftPoly.length >= 3) {
        setPolygons(prev => [...prev, { id: 'pg_' + Date.now(), pts: draftPoly }]); setDraftPoly([]); setMousePos(null);
      }
      if (e.key === 'Escape' && draftPoly.length > 0) { setDraftPoly([]); setMousePos(null); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, draftPoly, mode, cohabMode]);

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
    return { nodes: N, lines: L };
  }, [gen2Cfg, g1Status]);

  const structKey = useMemo(() => nodes.map(n => n.id).join(','), [nodes]);
  useEffect(() => { const m = {}; nodes.forEach(n => { m[n.id] = { x: n.dx, y: n.dy }; }); setPositions(m); }, [structKey]);

  const pos = useCallback((id) => { if (positions[id]) return positions[id]; const n = nodes.find(v => v.id === id); return n ? { x: n.dx, y: n.dy } : { x: 0, y: 0 }; }, [positions, nodes]);
  const svgPt = useCallback((e) => { const p = svgRef.current.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svgRef.current.getScreenCTM().inverse()); }, []);

  const onDown = useCallback((e, id) => {
    e.stopPropagation(); const sp = svgPt(e); const p = pos(id); setDrag({ id, ox: sp.x - p.x, oy: sp.y - p.y });
  }, [svgPt, pos]);

  const onTextDown = useCallback((e, id) => {
    e.stopPropagation(); textDragMoved.current = false; const sp = svgPt(e); const t = texts.find(t => t.id === id);
    if (t) setTextDrag({ id, ox: sp.x - t.x, oy: sp.y - t.y });
  }, [svgPt, texts]);

  const onTextClick = useCallback((e, id) => { e.stopPropagation(); if (textDragMoved.current) return; setSelectedTextId(id); }, []);
  const onTextDoubleClick = useCallback((e, id) => {
    e.stopPropagation(); setEditingTextId(id);
  }, []);

  const onResizeDown = useCallback((e, id) => {
    e.stopPropagation(); const sp = svgPt(e); const t = texts.find(t => t.id === id);
    if (t) setTextResize({ id, startY: sp.y, startSize: t.fontSize });
  }, [svgPt, texts]);

  const onMove = useCallback((e) => {
    const sp = svgPt(e);
    if (draftPoly.length > 0) setMousePos({ x: sp.x, y: sp.y });
    if (dragVertex) { setPolygons(p => p.map(pg => pg.id !== dragVertex.polyId ? pg : { ...pg, pts: pg.pts.map((pt, i) => i === dragVertex.index ? { x: sp.x - dragVertex.ox, y: sp.y - dragVertex.oy } : pt) })); return; }
    if (textResize) { setTexts(p => p.map(t => t.id === textResize.id ? { ...t, fontSize: Math.max(10, Math.min(72, Math.round(textResize.startSize + (sp.y - textResize.startY) * 0.3))) } : t)); return; }
    if (textDrag) { textDragMoved.current = true; setTexts(p => p.map(t => t.id === textDrag.id ? { ...t, x: sp.x - textDrag.ox, y: sp.y - textDrag.oy } : t)); return; }
    if (!drag) return;
    setPositions(prev => { let nX = sp.x - drag.ox, nY = sp.y - drag.oy; for (const [id, p] of Object.entries(prev)) { if (id === drag.id) continue; if (Math.abs(nX - p.x) < 12) nX = p.x; if (Math.abs(nY - p.y) < 12) nY = p.y; } return { ...prev, [drag.id]: { x: nX, y: nY } }; });
  }, [drag, textDrag, textResize, dragVertex, draftPoly, svgPt]);

  const onUp = () => { setDragVertex(null); setDrag(null); setTextDrag(null); setTextResize(null); };

  const onClick = (e, id) => {
    e.stopPropagation();
    if (mode === 'index') setIndexId(p => p === id ? null : id);
    else if (mode === 'cohab' && cohabMode === 'auto') setCohabMembers(p => p.includes(id) ? p.filter(m => m !== id) : [...p, id]);
    else if (mode === 'deceased') setDeceasedIds(p => p.includes(id) ? p.filter(m => m !== id) : [...p, id]);
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

  /* ===== 介面渲染 ===== */
  return (
    <div className="app-layout">
      {/* 左側面板 */}
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px', paddingBottom: '8px', borderBottom: '2px solid #3b82f6' }}>
          <h2 style={{ margin: 0, border: 'none', padding: 0 }}>資料輸入面板</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: showAgeMode ? '#10b981' : '#64748b', cursor: 'pointer', background: showAgeMode ? '#ecfdf5' : '#f1f5f9', padding: '4px 8px', borderRadius: '5px', border: '1px solid', borderColor: showAgeMode ? '#10b981' : '#cbd5e1' }}>
              <input type="checkbox" checked={showAgeMode} onChange={e => setShowAgeMode(e.target.checked)} style={{ cursor: 'pointer', accentColor: '#10b981' }} />
              年齡 {showAgeMode ? 'ON' : 'OFF'}
            </label>
            <button onClick={downloadJPG} style={{ padding: '5px 10px', fontSize: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>下載</button>
            <button onClick={() => { if(window.confirm('確定重置？')) { setGen2Str(''); setGen2Cfg([]); setIndexId(null); setCohabMembers([]); setDeceasedIds([]); setPolygons([]); setTexts([]); setAges({}); } }} style={{ padding: '5px 10px', fontSize: '12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>重置</button>
          </div>
        </div>

        <div className="section">
          <label> 畫布互動 (快捷鍵切換)</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '13px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="radio" checked={mode === 'drag'} onChange={() => setMode('drag')} /> 🤚 拖曳
              [<input type="text" maxLength="1" value={shortcuts.drag} onChange={e => updateShortcut('drag', e.target.value)} style={{ width: '18px', padding: '0', textAlign: 'center', fontSize: '11px', background: 'transparent', border: 'none', borderBottom: '1px solid #3b82f6', outline: 'none' }} />]
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="radio" checked={mode === 'index'} onChange={() => setMode('index')} /> 🎯 案主
              [<input type="text" maxLength="1" value={shortcuts.index} onChange={e => updateShortcut('index', e.target.value)} style={{ width: '18px', padding: '0', textAlign: 'center', fontSize: '11px', background: 'transparent', border: 'none', borderBottom: '1px solid #3b82f6', outline: 'none' }} />]
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="radio" checked={mode === 'cohab'} onChange={() => setMode('cohab')} /> 🏠 同住
              [<input type="text" maxLength="1" value={shortcuts.cohab} onChange={e => updateShortcut('cohab', e.target.value)} style={{ width: '18px', padding: '0', textAlign: 'center', fontSize: '11px', background: 'transparent', border: 'none', borderBottom: '1px solid #3b82f6', outline: 'none' }} />]
              <span className="status-badge" data-status="cohab" ref={el => wheelRef(el, ['auto', 'poly'], cohabMode, setCohabMode)} title="滾輪切換：自動 / 點繪">{cohabMode === 'auto' ? '自動' : '點繪'}</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="radio" checked={mode === 'deceased'} onChange={() => setMode('deceased')} /> ✝️ 打叉
              [<input type="text" maxLength="1" value={shortcuts.deceased} onChange={e => updateShortcut('deceased', e.target.value)} style={{ width: '18px', padding: '0', textAlign: 'center', fontSize: '11px', background: 'transparent', border: 'none', borderBottom: '1px solid #3b82f6', outline: 'none' }} />]
            </label>
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

        <div className="section">
          <label>📝 自由文字方塊</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>方向：</span>
            <span className="status-badge" data-status={textDirection} ref={el => wheelRef(el, TEXT_DIRS, textDirection, setTextDirection)}>{TEXT_DIR_LABELS[textDirection]}</span>
            <button onClick={addText} style={{ padding: '4px 12px', fontSize: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto' }}>➕ 新增至畫布</button>
          </div>
          <div className="hint" style={{marginTop: '6px'}}>單擊選取文字方塊（顯示框線與控制按鈕）；雙擊可編輯內容；選取後可刪除或拖曳右下角縮放。</div>
        </div>

        <div className="section">
          <label>操作說明</label>
          <div className="info-box">
            ■ = 男性（正方形）　● = 女性（圓形）<br/>
            點擊節點 → 標示 / 取消「案主」<br/>
            拖曳節點 → 微調位置，連線即時跟隨<br/>
            滑鼠滾輪於狀態標籤 → 循環切換狀態<br/>
            📝 文字方塊 → 可拖曳、編輯、縮放、刪除<br/>
            📥 下載 JPG → 自動裁切白邊並匯出
          </div>
        </div>
      </div>

      {/* SVG 畫布 */}
      <div className="canvas-wrap">
        <svg ref={svgRef} width={Math.max(800, (nodes.map(n => positions[n.id]?.x??n.dx).concat(texts.map(t=>t.x+100)).reduce((a,b)=>Math.max(a,b),0))+160)} height={Math.max(520, (nodes.map(n => positions[n.id]?.y??n.dy).concat(texts.map(t=>t.y+100)).reduce((a,b)=>Math.max(a,b),0))+80)} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onClick={() => { setSelectedTextId(null); setSelectedPolyId(null); }} style={{ background: '#fefefe', minWidth: '600px', cursor: mode === 'cohab' && cohabMode === 'poly' ? 'crosshair' : undefined }}>
          <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="0.5" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {mode === 'cohab' && cohabMode === 'poly' && (
            <rect width="100%" height="100%" fill="transparent" style={{ cursor: 'crosshair' }} onClick={e => { e.stopPropagation(); const sp = svgPt(e); const pt = { x: sp.x, y: sp.y }; if (draftPoly.length >= 3 && Math.sqrt(Math.pow(pt.x - draftPoly[0].x,2) + Math.pow(pt.y - draftPoly[0].y,2)) < 15) { setPolygons(p => [...p, { id: 'pg_' + Date.now(), pts: draftPoly }]); setDraftPoly([]); setMousePos(null); return; } setDraftPoly(p => [...p, pt]); }} />
          )}

          {cohabitationBox && cohabitationBox.type === 'single' && <rect x={cohabitationBox.x} y={cohabitationBox.y} width={cohabitationBox.w} height={cohabitationBox.h} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="8,6" rx="15" />}
          {cohabitationBox && cohabitationBox.type === 'poly' && <path d={getSmoothPath(cohabitationBox.points, true)} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="8,6" strokeLinejoin="round" />}

          {polygons.map(pg => (
            <g key={pg.id}>
              <path d={getSmoothPath(pg.pts, true)} fill="rgba(239, 68, 68, 0.05)" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="8,6" strokeLinejoin="round" style={{ cursor: mode === 'drag' ? 'pointer' : undefined }} onClick={e => { if (mode === 'drag') { e.stopPropagation(); setSelectedPolyId(pg.id); } }} onDoubleClick={e => { e.stopPropagation(); setPolygons(p => p.filter(x => x.id !== pg.id)); setSelectedPolyId(null); }} />
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
            if (ln.type === 'marry') {
              const a = pos(ln.a), b = pos(ln.b);
              const x1 = a.x + R, x2 = b.x - R, midX = (x1 + x2) / 2, midY = a.y;
              const els = [<line key={ln.id} x1={x1} y1={a.y} x2={x2} y2={b.y} stroke="#444" strokeWidth="2" strokeDasharray={ln.status === 'cohab' ? "8,6" : "0"} />];
              if (ln.status === 'separated') els.push(<line key={`${ln.id}-s`} x1={midX-6} y1={midY+12} x2={midX+6} y2={midY-12} stroke="#444" strokeWidth="2" />);
              if (ln.status === 'divorced') els.push(<line key={`${ln.id}-d1`} x1={midX-8} y1={midY-8} x2={midX+8} y2={midY+8} stroke="#444" strokeWidth="2" />, <line key={`${ln.id}-d2`} x1={midX-8} y1={midY+8} x2={midX+8} y2={midY-8} stroke="#444" strokeWidth="2" />);
              return <g key={ln.id}>{els}</g>;
            }
            if (ln.type === 'pc') {
              const pA = pos(ln.pa), pB = pos(ln.pb), midX = (pA.x + pB.x) / 2, parentY = Math.max(pA.y, pB.y);
              const kidPos = ln.kids.map(k => pos(k)); if (kidPos.length === 0) return null;
              const barY = (parentY + R + kidPos[0].y - R) / 2, els = [];
              els.push(<line key={`${ln.id}-v`} x1={midX} y1={parentY} x2={midX} y2={barY} stroke="#444" strokeWidth="2" />);
              els.push(<line key={`${ln.id}-h`} x1={Math.min(midX, ...kidPos.map(p=>p.x))} y1={barY} x2={Math.max(midX, ...kidPos.map(p=>p.x))} y2={barY} stroke="#444" strokeWidth="2" />);
              const groups = []; let cur = []; ln.kids.forEach((k, i) => { if (nodes.find(n => n.id === k)?.isMulti) cur.push(i); else { if (cur.length >= 2) groups.push(cur); cur = []; } }); if (cur.length >= 2) groups.push(cur);
              kidPos.forEach((kp, j) => {
                const g = groups.find(x => x.includes(j));
                if (g) els.push(<line key={`${ln.id}-m${j}`} x1={g.map(i=>kidPos[i].x).reduce((a,b)=>a+b,0)/g.length} y1={barY} x2={kp.x} y2={kp.y - R} stroke="#444" strokeWidth="2" />);
                else els.push(<line key={`${ln.id}-k${j}`} x1={kp.x} y1={barY} x2={kp.x} y2={kp.y - R} stroke="#444" strokeWidth="2" />);
              });
              return <g key={ln.id}>{els}</g>;
            } return null;
          })}

          {nodes.map(nd => {
            const p = pos(nd.id), isIP = nd.id === indexId, fill = isIP ? '#1e293b' : 'white', txtC = isIP ? 'white' : '#333';
            const isEditingAge = editingAgeId === nd.id;
            const ageVal = ages[nd.id] || '';

            return (
              <g key={nd.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: drag?.id === nd.id ? 'grabbing' : 'grab' }}
                 onMouseDown={e => onDown(e, nd.id)}
                 onClick={e => onClick(e, nd.id)}
                 onDoubleClick={e => { e.stopPropagation(); if(showAgeMode) setEditingAgeId(nd.id); }}>

                {nd.gender === 'M' ? <rect x={-R} y={-R} width={SZ} height={SZ} fill={fill} stroke="#333" strokeWidth="2.5" rx="2" /> : <circle cx="0" cy="0" r={R} fill={fill} stroke="#333" strokeWidth="2.5" />}

                {isEditingAge ? (
                  <foreignObject x={-R} y={-10} width={SZ} height={20}>
                    <input
                      autoFocus
                      defaultValue={ageVal}
                      onBlur={(e) => finishEditingAge(nd.id, e.target.value)}
                      onKeyDown={(e) => { e.stopPropagation(); if(e.key === 'Enter') finishEditingAge(nd.id, e.target.value); }}
                      style={{ width: '100%', height: '100%', textAlign: 'center', fontSize: '13px', fontFamily: TEXT_FONT, border: 'none', background: 'transparent', outline: 'none', color: txtC, fontWeight: 'bold', padding: 0 }}
                    />
                  </foreignObject>
                ) : (
                  <>
                    {isIP && (!showAgeMode || !ageVal) && <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="bold" fill={txtC} style={{fontFamily: TEXT_FONT, pointerEvents: 'none'}}>案主</text>}
                    {showAgeMode && ageVal && <text x="0" y="4" textAnchor="middle" fontSize="13" fontWeight="bold" fill={txtC} style={{fontFamily: TEXT_FONT, pointerEvents: 'none'}}>{ageVal}</text>}
                  </>
                )}
                {deceasedIds.includes(nd.id) && <g stroke={isIP ? 'white' : '#333'} strokeWidth="2.5" pointerEvents="none"><line x1={-R} y1={-R} x2={R} y2={R} /><line x1={R} y1={-R} x2={-R} y2={R} /></g>}
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
