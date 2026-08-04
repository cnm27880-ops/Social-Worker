/**
 * 標題旁的 ⓘ 提示。
 *
 * 用來收納原本常駐在卡片裡的輔助說明文字 —— 那些說明第一次看有用，
 * 之後每次開啟都在佔垂直空間。改成 hover／focus 才顯示，面板高度大幅下降，
 * 但說明仍然在原本的位置附近找得到（完整說明另見右上角說明書）。
 *
 * 氣泡的水平位置對齊「所在的那一列」而不是 ⓘ 本身（見 styles.css：
 * 各標題列都是 position: relative，氣泡 left/right 都是 0），所以不論
 * ⓘ 落在列的哪個位置，氣泡都不會超出面板邊界被裁掉。
 *
 * 用 <span> 而非 <button>：它常常放在收合標題的按鈕旁邊，
 * 巢狀按鈕是無效的 HTML，而且這裡不需要「按下去會發生什麼」的語意。
 */
const InfoTip = ({ text }) => (
  <span className="infotip" tabIndex={0} role="note" aria-label={`說明：${text}`}>
    <span className="infotip-mark" aria-hidden="true">ⓘ</span>
    <span className="infotip-bubble" aria-hidden="true">{text}</span>
  </span>
);

export default InfoTip;
