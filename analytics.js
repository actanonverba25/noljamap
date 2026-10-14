/* 통합 애널리틱스 — GA4 + Amplitude. track(event, params)로 양쪽 동시 전송.
   지도(app.js)·놀자방(bang.js) 공용. 키 없으면 해당 도구만 조용히 비활성. */
(function () {
  // GA4
  const gid = window.GA_ID;
  if (gid) {
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + gid;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag("js", new Date());
    gtag("config", gid);
  }
  // Amplitude (Browser SDK 2 — autocapture: 페이지뷰·세션·클릭 자동수집)
  const akey = window.AMPLITUDE_API_KEY;
  if (akey) {
    const s = document.createElement("script");
    s.src = "https://cdn.amplitude.com/libs/analytics-browser-2.11.1-min.js.gz";
    s.onload = function () { try { window.amplitude.init(akey, { autocapture: true }); } catch (e) {} };
    document.head.appendChild(s);
  }
})();

// 커스텀 이벤트 — GA + Amplitude 동시 전송 (둘 다 꺼져있으면 조용히 무시)
window.track = function (event, params) {
  try { if (window.gtag) gtag("event", event, params || {}); } catch (e) {}
  try { if (window.amplitude && amplitude.track) amplitude.track(event, params || {}); } catch (e) {}
};
