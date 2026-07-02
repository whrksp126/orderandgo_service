// 오더앤고 온보딩 위저드 (Duolingo식): 쉬운 입력 먼저 → 미리보기(가치) → 가입은 마지막
(function () {
  var KEY = 'og_onboarding';
  var INDUSTRIES = [
    { id: 'korean', name: '한식', icon: 'ph-bowl-food' },
    { id: 'chinese', name: '중식', icon: 'ph-cooking-pot' },
    { id: 'japanese', name: '일식', icon: 'ph-fish' },
    { id: 'western', name: '양식', icon: 'ph-hamburger' },
    { id: 'cafe', name: '카페·디저트', icon: 'ph-coffee' },
    { id: 'bunsik', name: '분식', icon: 'ph-pepper' },
    { id: 'pub', name: '치킨·주점', icon: 'ph-beer-bottle' },
    { id: 'etc', name: '기타', icon: 'ph-storefront' },
  ];

  var state = load() || { step: 0, industry: '', storeName: '', menus: [{ name: '', price: '' }], tables: 6 };

  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

  var TOTAL = 6;
  var stepEl = document.getElementById('obStep');
  var footEl = document.getElementById('obFoot');
  var barEl = document.getElementById('obBar');
  var backEl = document.getElementById('obBack');

  function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function won(v) { var n = parseInt(v, 10); return isNaN(n) ? '0원' : n.toLocaleString() + '원'; }

  function valid() {
    switch (state.step) {
      case 0: return !!state.industry;
      case 1: return state.storeName.trim().length > 0;
      case 2: return state.menus.some(function (m) { return m.name.trim() && parseInt(m.price, 10) > 0; });
      default: return true;
    }
  }

  function render() {
    barEl.style.width = ((state.step + 1) / TOTAL * 100) + '%';
    var h = '';
    if (state.step === 0) {
      h += '<span class="ob-eyebrow">STEP 1</span><h1 class="ob-title">어떤 매장을 운영하세요?</h1>' +
        '<p class="ob-sub">업종에 맞는 예시 메뉴와 화면을 준비해 드려요.</p><div class="ob-chips">';
      INDUSTRIES.forEach(function (it) {
        h += '<button class="ob-chip ' + (state.industry === it.id ? 'active' : '') + '" data-ind="' + it.id + '">' +
          '<i class="ph ' + it.icon + '"></i>' + it.name + '</button>';
      });
      h += '</div>';
    } else if (state.step === 1) {
      h += '<span class="ob-eyebrow">STEP 2</span><h1 class="ob-title">매장 이름을 알려주세요</h1>' +
        '<p class="ob-sub">손님에게 보이는 이름이에요. 나중에 바꿀 수 있어요.</p>' +
        '<label class="ob-label">매장 이름</label>' +
        '<input class="ob-input" id="obName" placeholder="예: 빨간중식" value="' + esc(state.storeName) + '" maxlength="30">';
    } else if (state.step === 2) {
      h += '<span class="ob-eyebrow">STEP 3</span><h1 class="ob-title">대표 메뉴를 추가해 주세요</h1>' +
        '<p class="ob-sub">2~3개만 넣어도 충분해요. 손님 주문 화면을 바로 보여드릴게요.</p><div id="obMenus">';
      state.menus.forEach(function (m, i) {
        h += '<div class="ob-menu-row" data-i="' + i + '">' +
          '<input class="ob-input name" placeholder="메뉴 이름" value="' + esc(m.name) + '">' +
          '<input class="ob-input price" placeholder="가격" inputmode="numeric" value="' + esc(m.price) + '">' +
          (state.menus.length > 1 ? '<button class="ob-menu-del" aria-label="삭제"><i class="ph ph-trash"></i></button>' : '') +
          '</div>';
      });
      h += '</div><button class="ob-add-menu" id="obAddMenu"><i class="ph ph-plus"></i> 메뉴 추가</button>';
    } else if (state.step === 3) {
      var items = state.menus.filter(function (m) { return m.name.trim(); });
      h += '<span class="ob-eyebrow">미리보기</span><h1 class="ob-title">손님에게는 이렇게 보여요</h1>' +
        '<p class="ob-sub">테이블 QR을 찍으면 손님이 바로 이 화면에서 주문해요.</p><div class="ob-preview-wrap"><div class="ob-phone"><div class="ob-phone-screen">' +
        '<div class="ob-phone-head">' + esc(state.storeName || '내 매장') + '<small>테이블 1번 · QR 주문</small></div><div class="ob-phone-body">';
      if (items.length) {
        items.forEach(function (m) {
          h += '<div class="ob-pv-item"><div class="ob-pv-thumb"><i class="ph ph-fork-knife"></i></div>' +
            '<div class="ob-pv-info"><div class="ob-pv-name">' + esc(m.name) + '</div><div class="ob-pv-price">' + won(m.price) + '</div></div>' +
            '<div class="ob-pv-add"><i class="ph ph-plus"></i></div></div>';
        });
      } else {
        h += '<div style="padding:40px 16px;text-align:center;color:#999;">메뉴를 추가하면 여기에 표시돼요</div>';
      }
      h += '</div></div></div></div>';
    } else if (state.step === 4) {
      h += '<span class="ob-eyebrow">STEP 4</span><h1 class="ob-title">테이블은 몇 개인가요?</h1>' +
        '<p class="ob-sub">POS 플로어맵과 테이블별 QR을 자동으로 만들어 드려요.</p>' +
        '<div class="ob-stepper"><button id="obMinus">−</button><span class="num" id="obTableNum">' + state.tables + '</span><button id="obPlus">+</button></div>';
    } else if (state.step === 5) {
      var mc = state.menus.filter(function (m) { return m.name.trim(); }).length;
      var indName = (INDUSTRIES.find(function (x) { return x.id === state.industry; }) || {}).name || '-';
      h += '<span class="ob-eyebrow">거의 다 됐어요!</span><h1 class="ob-title">' + esc(state.storeName || '내 매장') + ' 매장이 준비됐어요 🎉</h1>' +
        '<p class="ob-sub">지금 가입하면 아래 내용이 그대로 저장돼요.</p>' +
        '<div class="ob-summary">' +
        '<div class="ob-summary-row"><span>업종</span><strong>' + indName + '</strong></div>' +
        '<div class="ob-summary-row"><span>매장 이름</span><strong>' + esc(state.storeName || '-') + '</strong></div>' +
        '<div class="ob-summary-row"><span>등록 메뉴</span><strong>' + mc + '개</strong></div>' +
        '<div class="ob-summary-row"><span>테이블</span><strong>' + state.tables + '개</strong></div>' +
        '</div>' +
        '<p class="ob-sub" style="margin-bottom:8px;">가입 후 이어서 설정할 수 있어요:</p>' +
        '<ul class="ob-next-list">' +
        '<li><i class="ph ph-qr-code"></i> 테이블 QR 출력</li>' +
        '<li><i class="ph ph-credit-card"></i> 토스플레이스 단말기 연결</li>' +
        '<li><i class="ph ph-monitor"></i> 주방 KDS · 프린터 설정</li></ul>';
    }
    stepEl.innerHTML = h;
    renderFoot();
    wire();
  }

  function renderFoot() {
    if (state.step === 5) {
      footEl.innerHTML = '<button class="ob-btn" id="obNext">무료로 시작하고 저장하기</button>' +
        '<button class="ob-btn ghost" id="obLogin">이미 계정이 있어요</button>';
    } else {
      footEl.innerHTML = '<button class="ob-btn" id="obNext"' + (valid() ? '' : ' disabled') + '>다음</button>';
    }
  }

  function wire() {
    // 업종 칩
    stepEl.querySelectorAll('.ob-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        state.industry = c.dataset.ind; save();
        // 자동 진행(듀오링고식 즉시 반응)
        next();
      });
    });
    var nameInput = document.getElementById('obName');
    if (nameInput) nameInput.addEventListener('input', function () { state.storeName = nameInput.value; save(); refreshNext(); });

    // 메뉴 입력
    var menusWrap = document.getElementById('obMenus');
    if (menusWrap) {
      menusWrap.querySelectorAll('.ob-menu-row').forEach(function (row) {
        var i = +row.dataset.i;
        var nameEl = row.querySelector('.name'), priceEl = row.querySelector('.price'), delEl = row.querySelector('.ob-menu-del');
        nameEl.addEventListener('input', function () { state.menus[i].name = nameEl.value; save(); refreshNext(); });
        priceEl.addEventListener('input', function () { state.menus[i].price = priceEl.value.replace(/[^0-9]/g, ''); priceEl.value = state.menus[i].price; save(); refreshNext(); });
        if (delEl) delEl.addEventListener('click', function () { state.menus.splice(i, 1); save(); render(); });
      });
      var add = document.getElementById('obAddMenu');
      if (add) add.addEventListener('click', function () { if (state.menus.length < 12) { state.menus.push({ name: '', price: '' }); save(); render(); } });
    }

    // 테이블 스텝퍼
    var minus = document.getElementById('obMinus'), plus = document.getElementById('obPlus'), numEl = document.getElementById('obTableNum');
    if (minus) minus.addEventListener('click', function () { if (state.tables > 1) { state.tables--; numEl.textContent = state.tables; save(); } });
    if (plus) plus.addEventListener('click', function () { if (state.tables < 60) { state.tables++; numEl.textContent = state.tables; save(); } });

    var nextBtn = document.getElementById('obNext');
    if (nextBtn) nextBtn.addEventListener('click', onNext);
    var login = document.getElementById('obLogin');
    if (login) login.addEventListener('click', function () { location.href = '/login'; });
  }

  function refreshNext() {
    var n = document.getElementById('obNext');
    if (n && state.step < 5) n.disabled = !valid();
  }

  function onNext() {
    if (state.step === 5) {
      // 가입으로 인계 (온보딩 데이터는 localStorage 에 보관 → 가입/로그인 후 커밋)
      save();
      location.href = '/register_admin?from=onboarding';
      return;
    }
    if (!valid()) return;
    next();
  }

  function next() { if (state.step < 5) { state.step++; save(); render(); window.scrollTo(0, 0); } }
  function prev() {
    if (state.step === 0) { location.href = '/'; return; }
    state.step--; save(); render(); window.scrollTo(0, 0);
  }

  backEl.addEventListener('click', prev);
  render();
})();
