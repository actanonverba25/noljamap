/* 지도 엔진 추상화 — KO=카카오 / EN=네이버(영어 타일).
   app.js는 kakao/naver SDK 직접 호출 대신 MAP. 메서드만 사용.
   레벨 스케일은 카카오 기준(1~14, 작을수록 확대)으로 통일 → 클러스터 임계값 공유.
   네이버 zoom(6~21, 클수록 확대)은 level = 19 - zoom 로 환산. */
(function () {
  const useNaver = (window.LANG === "en") && !!window.NAVER_CLIENT_ID;

  // 공통 LatLng 래퍼: {lat,lng,getLat(),getLng(),native}
  function makeLL(lat, lng, native) {
    return { lat, lng, getLat: () => lat, getLng: () => lng, native };
  }

  /* ---------- 카카오 ---------- */
  function KakaoEngine() {
    let map, geocoder, places, clickListener;
    return {
      engine: "kakao",
      load() {
        return new Promise((resolve, reject) => {
          const key = window.KAKAO_JS_KEY;
          if (!key) return reject(new Error("KAKAO_JS_KEY 없음"));
          const s = document.createElement("script");
          s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services,clusterer`;
          s.onload = () => kakao.maps.load(resolve);
          s.onerror = () => reject(new Error("kakao sdk load failed"));
          document.head.appendChild(s);
        });
      },
      createMap(el, center, level) {
        map = new kakao.maps.Map(el, { center: new kakao.maps.LatLng(center.lat, center.lng), level });
        geocoder = new kakao.maps.services.Geocoder();
        places = new kakao.maps.services.Places();
        return map;
      },
      latLng(lat, lng) { return makeLL(lat, lng, new kakao.maps.LatLng(lat, lng)); },
      setCenter(ll) { map.setCenter(ll.native); },
      setLevel(level, anchor) { anchor ? map.setLevel(level, { anchor: anchor.native }) : map.setLevel(level); },
      getLevel() { return map.getLevel(); },
      onZoom(cb) { kakao.maps.event.addListener(map, "zoom_changed", cb); },
      onIdle(cb) { kakao.maps.event.addListener(map, "idle", cb); },
      center() { const c = map.getCenter(); return { lat: c.getLat(), lng: c.getLng() }; },
      inBounds(lat, lng) { try { return map.getBounds().contain(new kakao.maps.LatLng(lat, lng)); } catch (e) { return true; } },
      onMapClick(cb) {
        clickListener = (e) => cb(makeLL(e.latLng.getLat(), e.latLng.getLng(), e.latLng));
        kakao.maps.event.addListener(map, "click", clickListener);
      },
      offMapClick() {
        if (clickListener) { kakao.maps.event.removeListener(map, "click", clickListener); clickListener = null; }
      },
      overlay(ll, el, opts) {
        opts = opts || {};
        const ov = new kakao.maps.CustomOverlay({
          position: ll.native, content: el,
          yAnchor: opts.yAnchor != null ? opts.yAnchor : 1,
          xAnchor: opts.xAnchor != null ? opts.xAnchor : 0.5,
          clickable: !!opts.clickable, zIndex: opts.zIndex,
        });
        return { setMap: (show) => ov.setMap(show ? map : null) };
      },
      pinMarker(ll) {
        const m = new kakao.maps.Marker({ position: ll.native });
        return { setMap: (show) => m.setMap(show ? map : null) };
      },
      geocode(query) {
        return new Promise((resolve) => {
          if (!query) return resolve(null);
          geocoder.addressSearch(query, (res, status) => {
            if (status === kakao.maps.services.Status.OK && res[0])
              return resolve({ lat: +res[0].y, lng: +res[0].x, address: res[0].address_name });
            places.keywordSearch(query, (r2, s2) => {
              if (s2 === kakao.maps.services.Status.OK && r2[0])
                resolve({ lat: +r2[0].y, lng: +r2[0].x, address: r2[0].road_address_name || r2[0].address_name || query });
              else resolve(null);
            });
          });
        });
      },
      // 장소 자동완성 (드롭다운용) — 전국 키워드 검색 상위 결과
      searchPlaces(query) {
        return new Promise((resolve) => {
          if (!query) return resolve([]);
          places.keywordSearch(query, (data, status) => {
            if (status !== kakao.maps.services.Status.OK) return resolve([]);
            resolve(data.slice(0, 6).map((d) => ({
              name: d.place_name, address: d.road_address_name || d.address_name || "",
              lat: +d.y, lng: +d.x,
            })));
          }, { size: 10 });
        });
      },
    };
  }

  /* ---------- 네이버 ---------- */
  function NaverEngine() {
    let map, clickListener, HtmlOverlay;
    const Z = (level) => 19 - level;       // level→zoom
    const L = (zoom) => Math.max(1, Math.round(19 - zoom)); // zoom→level
    return {
      engine: "naver",
      load() {
        return new Promise((resolve, reject) => {
          const id = window.NAVER_CLIENT_ID;
          if (!id) return reject(new Error("NAVER_CLIENT_ID 없음"));
          const s = document.createElement("script");
          s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${id}&language=en&submodules=geocoder`;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("naver sdk load failed"));
          document.head.appendChild(s);
        });
      },
      createMap(el, center, level) {
        map = new naver.maps.Map(el, {
          center: new naver.maps.LatLng(center.lat, center.lng),
          zoom: Z(level), minZoom: 6, scaleControl: false, mapDataControl: false, logoControlOptions: { position: naver.maps.Position.BOTTOM_LEFT },
        });
        // 라이브 DOM 호스팅 오버레이 (카카오 CustomOverlay 대체)
        HtmlOverlay = function (position, elNode, opts) { this.position = position; this.elNode = elNode; this.opts = opts || {}; this.setMap(null); };
        HtmlOverlay.prototype = new naver.maps.OverlayView();
        HtmlOverlay.prototype.onAdd = function () {
          this.elNode.style.position = "absolute";
          this.elNode.style.pointerEvents = "auto";
          this.getPanes().overlayLayer.appendChild(this.elNode);
        };
        HtmlOverlay.prototype.draw = function () {
          if (!this.getMap()) return;
          const pt = this.getProjection().fromCoordToOffset(this.position);
          const xA = this.opts.xAnchor != null ? this.opts.xAnchor : 0.5;
          const yA = this.opts.yAnchor != null ? this.opts.yAnchor : 1;
          this.elNode.style.left = (pt.x - this.elNode.offsetWidth * xA) + "px";
          this.elNode.style.top = (pt.y - this.elNode.offsetHeight * yA) + "px";
          if (this.opts.zIndex) this.elNode.style.zIndex = this.opts.zIndex;
        };
        HtmlOverlay.prototype.onRemove = function () {
          const p = this.elNode.parentNode; if (p) p.removeChild(this.elNode);
        };
        return map;
      },
      latLng(lat, lng) { return makeLL(lat, lng, new naver.maps.LatLng(lat, lng)); },
      setCenter(ll) { map.setCenter(ll.native); },
      setLevel(level, anchor) { if (anchor) map.setCenter(anchor.native); map.setZoom(Z(level), true); },
      getLevel() { return L(map.getZoom()); },
      onZoom(cb) { naver.maps.Event.addListener(map, "zoom_changed", cb); },
      onIdle(cb) { naver.maps.Event.addListener(map, "idle", cb); },
      center() { const c = map.getCenter(); return { lat: c.lat(), lng: c.lng() }; },
      inBounds(lat, lng) { try { return map.getBounds().hasLatLng(new naver.maps.LatLng(lat, lng)); } catch (e) { return true; } },
      onMapClick(cb) {
        clickListener = naver.maps.Event.addListener(map, "click", (e) =>
          cb(makeLL(e.coord.lat(), e.coord.lng(), e.coord)));
      },
      offMapClick() { if (clickListener) { naver.maps.Event.removeListener(clickListener); clickListener = null; } },
      overlay(ll, el, opts) {
        const ov = new HtmlOverlay(ll.native, el, opts || {});
        return { setMap: (show) => ov.setMap(show ? map : null) };
      },
      pinMarker(ll) {
        const m = new naver.maps.Marker({ position: ll.native });
        return { setMap: (show) => m.setMap(show ? map : null) };
      },
      geocode(query) {
        return new Promise((resolve) => {
          if (!query || !naver.maps.Service) return resolve(null);
          naver.maps.Service.geocode({ query }, (status, response) => {
            if (status !== naver.maps.Service.Status.OK) return resolve(null);
            const a = response.v2 && response.v2.addresses && response.v2.addresses[0];
            if (!a) return resolve(null);
            resolve({ lat: +a.y, lng: +a.x, address: a.roadAddress || a.jibunAddress || query });
          });
        });
      },
      searchPlaces(query) {
        return new Promise((resolve) => {
          if (!query || !naver.maps.Service) return resolve([]);
          naver.maps.Service.geocode({ query }, (status, response) => {
            if (status !== naver.maps.Service.Status.OK) return resolve([]);
            const arr = (response.v2 && response.v2.addresses) || [];
            resolve(arr.slice(0, 6).map((a) => ({
              name: a.roadAddress || a.jibunAddress || query, address: a.jibunAddress || "",
              lat: +a.y, lng: +a.x,
            })));
          });
        });
      },
    };
  }

  window.makeKakaoEngine = KakaoEngine;   // 폴백용
  window.makeNaverEngine = NaverEngine;
  window.MAP = useNaver ? NaverEngine() : KakaoEngine();
})();
