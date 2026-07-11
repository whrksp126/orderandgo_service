// 키오스크 전체화면: 브라우저 정책상 로드 즉시 전체화면은 불가(사용자 제스처 필요)하므로
// 첫 탭/클릭/키입력 시 자동으로 전체화면 전환한다. (POS·KDS·테이블오더 공용)
// - iOS: 문서 전체화면 시 종료용 X가 강제로 떠서 자동 전체화면을 쓰지 않음(홈 화면 앱=PWA로 처리).
// - 안드로이드/데스크톱: 독립모드(PWA)여도 첫 탭에 requestFullscreen을 호출해 시스템바까지 숨긴 몰입형 전체화면.
(function () {
  // iOS(iPad/iPhone)는 스킵 → "홈 화면에 추가"(PWA)로 주소창·X 없는 전체화면 사용.
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return;

  function isFullscreen() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
  }
  function enterFullscreen() {
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (req && !isFullscreen()) {
      try {
        var p = req.call(el);
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (e) {}
    }
    cleanup();
  }
  function cleanup() {
    document.removeEventListener('click', enterFullscreen, true);
    document.removeEventListener('touchend', enterFullscreen, true);
    document.removeEventListener('keydown', enterFullscreen, true);
  }
  if (isFullscreen()) return;
  // capture 단계에서 듣되 preventDefault 하지 않으므로, 첫 클릭은 전체화면 + 원래 동작 모두 수행됨
  document.addEventListener('click', enterFullscreen, true);
  document.addEventListener('touchend', enterFullscreen, true);
  document.addEventListener('keydown', enterFullscreen, true);
})();
