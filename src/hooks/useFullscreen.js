import { useCallback, useEffect, useState } from 'react';

/* Safari（含 iPadOS）到現在仍只提供 webkit 前綴版本，Chrome／Edge／Firefox
 * 走標準版。兩套 API 的方法名不同、事件名不同、連「目前是否全螢幕」要讀的
 * 屬性名也不同，所以下面三組各自做一次擇一。 */

/** 目前處於全螢幕的元素（沒有則 null）。兩套 API 擇一。 */
const currentElement = () =>
  document.fullscreenElement ?? document.webkitFullscreenElement ?? null;

/** 取得 request 方法（綁定 this），瀏覽器完全不支援時回傳 null。 */
const requestOn = (el) => {
  const fn = el.requestFullscreen ?? el.webkitRequestFullscreen;
  return fn ? fn.bind(el) : null;
};

/** 取得 exit 方法（綁定 this），瀏覽器完全不支援時回傳 null。 */
const exitOn = () => {
  const fn = document.exitFullscreen ?? document.webkitExitFullscreen;
  return fn ? fn.bind(document) : null;
};

/**
 * iPhone 版 Safari 是唯一「有 API 形狀卻不能用在整份文件上」的例外——
 * 它只讓 <video> 進全螢幕，documentElement 上根本沒有 request 方法。
 * iPadOS 13 之後的 Safari 則是可以的，所以不能用 UA 判斷 iOS 就一律擋掉，
 * 要直接問 documentElement 有沒有這個方法，能力偵測才不會誤傷 iPad。
 */
const isSupported = () =>
  typeof document !== 'undefined' && !!requestOn(document.documentElement);

/**
 * 全螢幕切換。
 *
 * 回傳的 active 以瀏覽器事件為準而不是自己記帳——使用者按 Esc、或用系統
 * 手勢退出全螢幕時不會經過我們的 toggle，只有監聽 fullscreenchange 才追得到，
 * 否則按鈕會停在錯誤的狀態。
 *
 * @param {(msg: string) => void} onUnsupported 不支援或被瀏覽器拒絕時呼叫，
 *        由呼叫端決定怎麼提示使用者（本專案用 alert，與其他提示一致）。
 */
export const useFullscreen = (onUnsupported) => {
  const [active, setActive] = useState(() => !!currentElement());
  const [supported] = useState(isSupported);

  useEffect(() => {
    const sync = () => setActive(!!currentElement());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggle = useCallback(async () => {
    const notify = () => onUnsupported?.(
      '提示：iOS 裝置可透過『加入主畫面』享受全螢幕 App 體驗'
    );

    if (currentElement()) {
      const exit = exitOn();
      if (!exit) return;
      /* 退出失敗不必打擾使用者——畫面本來就還在，沒有「功能沒反應」的困惑。 */
      try { await exit(); } catch { /* 忽略 */ }
      return;
    }

    const request = requestOn(document.documentElement);
    if (!request) { notify(); return; }

    /* 標準版回傳 Promise、舊版 webkit 回傳 undefined，await 兩者都吃得下。
     * 權限政策擋下或使用者拒絕時是 reject，一樣導向溫馨提示。 */
    try {
      await request();
    } catch {
      notify();
    }
  }, [onUnsupported]);

  return { active, supported, toggle };
};
