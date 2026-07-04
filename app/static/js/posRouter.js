// =============================================
//  POS SPA-lite Router
//  공통 셸을 유지하고 콘텐츠 영역(#pos-content)만 교체
// =============================================

var POS_ROUTES = [
  { pattern: '/pos/tableList',         view: 'tableList',  depth: 0 },
  { pattern: '/pos/menuList/:tableId', view: 'menuList',   depth: 1 },
  { pattern: '/pos/payment/:tableId',  view: 'payment',    depth: 2 },
];

var _currentView = null;
var _currentParams = {};
var _currentDepth = -1;

// ─── 라우트 매칭 ────────────────────────────────────────────────────────────
function _matchRoute(pattern, path) {
  var patternParts = pattern.split('/');
  var pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) return null;
  var params = {};
  for (var i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

// ─── 네비게이션 ──────────────────────────────────────────────────────────────
function navigateTo(path, replace) {
  _cleanupCurrentView();

  if (replace) {
    history.replaceState({ path: path }, '', path);
  } else {
    history.pushState({ path: path }, '', path);
  }
  _routeTo(path, false);
}

// 뒤로가기/앞으로가기
window.addEventListener('popstate', function(e) {
  _cleanupCurrentView();
  _routeTo(e.state ? e.state.path : location.pathname, true);
});

// ─── 뷰 전환 (슬라이드 애니메이션) ──────────────────────────────────────────
function _routeTo(path, isPopState) {
  for (var i = 0; i < POS_ROUTES.length; i++) {
    var route = POS_ROUTES[i];
    var params = _matchRoute(route.pattern, path);
    if (params !== null) {
      var prevDepth = _currentDepth;
      _currentView = route.view;
      _currentParams = params;
      _currentDepth = route.depth;

      // lastPath 호환 유지
      window.lastPath = params.tableId || path.split('/').pop();

      // body/container 클래스 동적 변경
      _updateShellClasses(route.view);

      // 뒤로가기 버튼 동적 설정
      _updateBackButton(route.view, params.tableId);

      // 슬라이드 방향 결정
      var direction;
      if (prevDepth < 0) {
        direction = 'none'; // 초기 로드
      } else if (isPopState) {
        direction = route.depth < prevDepth ? 'back' : 'forward';
      } else {
        direction = route.depth <= prevDepth ? 'back' : 'forward';
      }

      _animateTransition(route, params, direction);
      return;
    }
  }
}

// ─── 애니메이션 클래스 일괄 제거 ────────────────────────────────────────────
var _animClasses = ['pos-exit-left', 'pos-exit-right', 'pos-enter-left', 'pos-enter-right', 'pos-enter-active'];
function _clearAnimClasses(el) {
  for (var i = 0; i < _animClasses.length; i++) {
    el.classList.remove(_animClasses[i]);
  }
}

// ─── 뷰 전환 (전환 효과 없이 즉시 교체) ─────────────────────────────────────
// 실영업 POS는 지연/슬라이드가 방해됨 → 클릭 즉시 필요한 부분만 바로 렌더한다.
function _animateTransition(route, params, direction) {
  var content = document.getElementById('pos-content');
  _clearAnimClasses(content); // 혹시 남아있을 수 있는 전환 클래스 제거
  _initView(route.view, params);
}

// ─── 뷰 초기화 ─────────────────────────────────────────────────────────────
function _initView(view, params) {
  if (view === 'tableList') {
    initTableListView();
  } else if (view === 'menuList') {
    initMenuListView(params);
  } else if (view === 'payment') {
    initPaymentView(params);
  }
}

// ─── 뷰 정리 ────────────────────────────────────────────────────────────────
function _cleanupCurrentView() {
  if (_currentView === 'tableList' && typeof cleanupTableListView === 'function') {
    cleanupTableListView();
  } else if (_currentView === 'menuList' && typeof cleanupMenuListView === 'function') {
    cleanupMenuListView();
  } else if (_currentView === 'payment' && typeof cleanupPaymentView === 'function') {
    cleanupPaymentView();
  }
}

// ─── 셸 클래스 업데이트 ─────────────────────────────────────────────────────
function _updateShellClasses(view) {
  var body = document.body;
  var container = document.getElementById('container');

  // 리셋
  body.classList.remove('payment');
  container.classList.remove('order');

  if (view === 'menuList') {
    container.classList.add('order');
  } else if (view === 'payment') {
    body.classList.add('payment');
    container.classList.add('order');
  }
}

// ─── 뒤로가기 버튼 업데이트 ─────────────────────────────────────────────────
function _updateBackButton(view, tableId) {
  var btn = document.getElementById('posBackBtn');
  if (!btn) return;

  // 이전 이벤트 제거를 위해 복제
  var newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  // 이전 뷰에서 설정한 href 제거
  newBtn.removeAttribute('href');

  if (view === 'tableList') {
    newBtn.addEventListener('click', function(e) {
      e.preventDefault();
      window.location.href = '/dashboard';
    });
  } else if (view === 'menuList') {
    newBtn.addEventListener('click', function(e) {
      e.preventDefault();
      navigateTo('/pos/tableList');
    });
  } else if (view === 'payment') {
    newBtn.addEventListener('click', function(e) {
      e.preventDefault();
      navigateTo('/pos/menuList/' + tableId);
    });
  }
}

// ─── 로고 클릭 ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var logoBtn = document.getElementById('posLogoBtn');
  if (logoBtn) {
    logoBtn.addEventListener('click', function() {
      navigateTo('/pos/tableList');
    });
  }
});

// ─── 초기 로드: 현재 URL 기반 라우팅 ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  history.replaceState({ path: location.pathname }, '', location.pathname);
  _routeTo(location.pathname, false);
});
