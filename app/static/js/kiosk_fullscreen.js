// 키오스크 전체화면: 브라우저 정책상 로드 즉시 전체화면은 불가(사용자 제스처 필요)하므로
// 첫 탭/클릭/키입력 시 자동으로 전체화면 전환한다. (POS·KDS·테이블오더 공용)
// 단, "홈 화면에 추가"한 PWA 독립모드로 실행 중이면 이미 주소창 없는 전체화면이므로
// requestFullscreen을 호출하지 않는다(그래야 iPad에서 종료용 X 버튼이 안 뜬다).
(function () {
  var isStandalone = (window.navigator.standalone === true) ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches);
  if (isStandalone) return;

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
