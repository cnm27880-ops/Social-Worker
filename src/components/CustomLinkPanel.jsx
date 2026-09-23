import { G2_STATUSES, G2_LABELS, parseGenders, getRelativeTitle } from '../utils/helpers';
import { SYMBOL_MAP } from '../utils/symbols';
import { cycleOnClick, wheelRef } from '../utils/statusBadge';
import { STANDALONE_TYPES } from '../utils/standalone';

/* ===========================================================================
 * 左側面板的「🔗 擴充連線設定」
 *
 * 從 GenogramTab.jsx 拆出來：每一條自由擴充的連線一張卡，可以切換婚姻
 * 狀態、填子代與第三代。只讀寫 customLinks，跟畫布的拖曳狀態無關。
 * =========================================================================== */

const CUSTOM_LINK_STATUSES = ['married', 'divorced'];
const CUSTOM_LINK_LABELS = { married: '已婚', divorced: '離婚' };

const CustomLinkPanel = ({
  customLinks, setCustomLinks, nodes, freeNodes, updateCustomLink, deleteCustomLink,
  childLinks = [], marriageLineSegs = [], removeChildLink,
}) => {
  const nodeById = (id) => nodes.find(n => n.id === id) || freeNodes.find(n => n.id === id);
  // 只列出婚姻線還在的親子關係；線被刪掉的那些畫布上本來就不畫
  const shownChildLinks = childLinks
    .map(cl => ({ cl, seg: marriageLineSegs.find(sg => sg.id === cl.lineId) }))
    .filter(x => x.seg);
  if (customLinks.length === 0 && shownChildLinks.length === 0) return null;
  const personLabel = (node) => {
    if (!node) return '?';
    if (STANDALONE_TYPES.includes(node.type)) return SYMBOL_MAP[node.type]?.label || node.type;
    return node.label || (node.gender === 'M' ? '■' : '●');
  };
  return (
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
      {shownChildLinks.length > 0 && (
        <>
          <label style={{ marginTop: '8px' }}>👶 掛在婚姻線下的子女</label>
          {shownChildLinks.map(({ cl, seg }) => (
            <div key={cl.id} className="link-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <span>{personLabel(nodeById(seg.a))}＋{personLabel(nodeById(seg.b))} → {personLabel(nodeById(cl.childId))}</span>
                <button className="btn-soft tone-clay btn-soft-xs" onClick={() => removeChildLink(cl.id)} style={{ marginLeft: 'auto' }}
                        title="只解除親子關係，人還留在畫布上">解除</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default CustomLinkPanel;
