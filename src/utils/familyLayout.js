/* ===========================================================================
 * 家系的節點與線條（排版結果）
 *
 * 從 GenogramTab.jsx 拆出來的純函式：主家系（第一代夫妻、第二代、第三代）
 * 依填表內容自動排版，擴充連線的子代依父母位置排開，再併進「掛在婚姻線／
 * 單親底下的子女」。
 *
 * 畫布與個案紀錄共用這一份：畫布拿來畫，個案紀錄拿來推算每個人跟案主的
 * 關係（見 utils/kinship.js）。兩邊各算各的，遲早會出現「圖上是子女、紀錄
 * 卻沒寫到」這種對不起來的狀況。
 *
 * 回傳 { nodes, lines }：
 *   nodes — [{ id, gender, gen, dx, dy, label, isMulti?, isExt? }]（dx/dy 是自動排版的預設位置）
 *   lines — [{ id, type: 'marry', a, b, status }] 或 [{ id, type: 'pc', pa, pb, kids }]
 * =========================================================================== */

import { SZ, COUPLE_GAP, SIBLING_GAP, GEN_Y, parseGenders, getRelativeTitle, computeMainLayout } from './helpers';
import { mergeChildLinks } from './childLinks';

export const buildFamily = ({
  gen2Cfg = [], g1Status = 'married', customLinks = [], mainFamily = true,
  childLinks = [], positions = {}, freeNodes = [],
}) => {
  const N = [], L = [];
  // 版面幾何（含第一代夫妻自動置中）與子女變動時的重新置中共用同一份計算
  const { units, fX, mX } = computeMainLayout(gen2Cfg);
  /* 舊圖修補模式（mainFamily === false）整組主家系都不產生：畫布上只剩
     自由擴充區、文字方塊與底圖。下面的 customLinks 區塊照跑 —— 舊圖上的
     人物就是靠它們加的，找不到主家系節點時會退回 freeNodes 的座標。 */
  if (mainFamily) {
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
  }

  // === customLink kidsCfg → 整合為完全體節點 ===
  customLinks.forEach(lnk => {
    if (lnk.type === 'eco' || lnk.type === 'annotation') return; // 生態圖／獨立個體連線不參與節點生成
    if (!lnk.kidsCfg || lnk.kidsCfg.length === 0) return;
    const srcN = N.find(n => n.id === lnk.sourceId); const srcF = freeNodes.find(fn => fn.id === lnk.sourceId);
    const tgtN = N.find(n => n.id === lnk.targetId); const tgtF = freeNodes.find(fn => fn.id === lnk.targetId);
    
    // 修正座標抓取：強制讀取拖曳後的實際視覺座標，防止兩段婚姻小孩擠在同一個中心點
    const spx = positions[lnk.sourceId]?.x ?? srcN?.dx ?? srcF?.x ?? 300;
    const spy = positions[lnk.sourceId]?.y ?? srcN?.dy ?? srcF?.y ?? 160;
    const tpx = positions[lnk.targetId]?.x ?? tgtN?.dx ?? tgtF?.x ?? 400;
    const tpy = positions[lnk.targetId]?.y ?? tgtN?.dy ?? tgtF?.y ?? 160;

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

  // 自由擴充的成員掛到某條婚姻線底下（子女）：併進那對夫妻的親子線
  const nodeIds = [...N.map(n => n.id), ...freeNodes.map(f => f.id)];
  return { nodes: N, lines: mergeChildLinks(L, customLinks, childLinks, nodeIds) };
};
