// 오더앤고 인증 화면 공통 스크립트 (로그인 · 회원가입 · 비밀번호 재설정 · 매장 선택/생성)
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var MIN_PW = 8;

  // ── 공통 UI ──
  function toast(msg, type) {
    var wrap = $('toast_wrap');
    if (!wrap) return;
    var el = document.createElement('div');
    el.className = 'au-toast ' + (type || 'success');
    el.innerHTML = '<i class="ph ' + (type === 'error' ? 'ph-warning-circle' : 'ph-check-circle') + '"></i><span></span>';
    el.querySelector('span').textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      el.addEventListener('animationend', function () { el.remove(); });
    }, 3000);
  }

  function showMsg(id, msg, type) {
    var el = $(id);
    if (!el) return;
    type = type || 'error';
    el.className = 'au-msg';
    void el.offsetWidth; // 같은 메시지가 다시 떠도 흔들림 애니메이션 재생
    el.className = 'au-msg show ' + type;
    el.innerHTML = '<span></span>';
    el.querySelector('span').textContent = msg;
  }
  function hideMsg(id) { var el = $(id); if (el) el.className = 'au-msg'; }

  // 처리 중: 버튼 안에 스피너를 띄우고 재클릭을 막음
  function setLoading(btn, on) {
    if (!btn) return;
    btn.classList.toggle('is-loading', on);
    btn.disabled = on;
  }

  function digits(v) { return String(v || '').replace(/\D/g, ''); }
  function formatTel(v) {
    var d = digits(v).slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return d.slice(0, 3) + '-' + d.slice(3);
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  }
  function validTel(v) { return /^01\d{8,9}$/.test(digits(v)); }

  function post(url, fields) {
    var fd = new FormData();
    Object.keys(fields).forEach(function (k) { if (fields[k] != null) fd.append(k, fields[k]); });
    return fetch(url, { method: 'POST', body: fd }).then(function (r) { return r.json(); });
  }

  function enterPanel(el) {
    el.hidden = false;
    el.classList.remove('is-entering');
    void el.offsetWidth;
    el.classList.add('is-entering');
  }

  // 휴대폰 번호 자동 하이픈
  document.querySelectorAll('.js-tel').forEach(function (input) {
    input.addEventListener('input', function () { input.value = formatTel(input.value); });
  });

  // 비밀번호 보기 토글
  document.querySelectorAll('.js-eye').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = btn.parentElement.querySelector('input');
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.querySelector('i').className = 'ph ' + (show ? 'ph-eye-slash' : 'ph-eye');
      btn.setAttribute('aria-label', show ? '비밀번호 숨기기' : '비밀번호 보기');
    });
  });

  // 로그아웃
  document.querySelectorAll('.js-logout').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.disabled = true;
      fetch('/logout').then(function () { location.href = '/login'; }).catch(function () { location.href = '/login'; });
    });
  });

  // ── 로그인 ──
  var tabs = $('loginTabs');
  if (tabs) {
    var TAB_KEY = 'og_login_tab';
    var panels = { owner: $('form_owner'), device: $('form_device') };
    var selectTab = function (name, animate) {
      tabs.dataset.active = name;
      tabs.querySelectorAll('.au-seg-btn').forEach(function (b) {
        var on = b.dataset.tab === name;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== name; });
      if (animate) enterPanel(panels[name]);
      try { localStorage.setItem(TAB_KEY, name); } catch (e) {}
    };
    tabs.querySelectorAll('.au-seg-btn').forEach(function (b) {
      b.addEventListener('click', function () { selectTab(b.dataset.tab, true); });
    });
    var saved = null;
    try { saved = localStorage.getItem(TAB_KEY); } catch (e) {}
    if (saved === 'device') selectTab('device', false);

    var wireLogin = function (form, idEl, pwEl, msgId, fields, idOk) {
      var btn = form.querySelector('.au-btn');
      var refresh = function () { if (!btn.classList.contains('is-loading')) btn.disabled = !(idOk(idEl.value) && pwEl.value.length > 0); };
      [idEl, pwEl].forEach(function (el) { el.addEventListener('input', function () { hideMsg(msgId); refresh(); }); });
      refresh();
      // 브라우저 자동완성은 input 이벤트 없이 값만 채우는 경우가 있어 한 번 더 확인
      setTimeout(refresh, 400);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (btn.disabled) return;
        setLoading(btn, true);
        post('/login', fields())
          .then(function (data) {
            if (data.code === 200) { location.href = data.redirect || '/dashboard'; return; }
            setLoading(btn, false);
            showMsg(msgId, data.message || '로그인에 실패했습니다.');
            pwEl.select();
          })
          .catch(function () { setLoading(btn, false); showMsg(msgId, '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'); });
      });
    };
    wireLogin(panels.owner, $('owner_tel'), $('owner_password'), 'msg_owner',
      function () { return { admin_tel: digits($('owner_tel').value), password: $('owner_password').value }; }, validTel);
    wireLogin(panels.device, $('store_id'), $('store_password'), 'msg_device',
      function () { return { store_id: $('store_id').value.trim(), password: $('store_password').value }; },
      function (v) { return v.trim().length > 0; });
  }

  // ── 휴대폰 인증 흐름 (회원가입 / 비밀번호 재설정) ──
  var flow = $('phoneFlow');
  if (flow) {
    var mode = flow.dataset.mode;
    var telEl = $('flow_tel'), codeEl = $('flow_code'), pwEl = $('flow_password'), pw2El = $('flow_password2');
    var sendBtn = $('sendCodeBtn'), verifyBtn = $('verifyCodeBtn'), resendBtn = $('resendBtn'), finishBtn = $('finishBtn');
    var verifiedToken = null, cooldownTimer = null;
    var SEND_ERRORS = {
      'auth/billing-not-enabled': '현재 문자 발송이 일시적으로 불가합니다. 고객센터로 문의해 주세요.',
      'auth/quota-exceeded': '오늘 문자 발송 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
      'auth/too-many-requests': '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      'auth/invalid-phone-number': '휴대폰 번호 형식이 올바르지 않습니다.',
      'auth/captcha-check-failed': '보안 확인에 실패했습니다. 새로고침 후 다시 시도해 주세요.',
      'auth/network-request-failed': '네트워크 연결을 확인해 주세요.'
    };

    var goStep = function (n) {
      flow.querySelectorAll('.au-step').forEach(function (s) { s.hidden = +s.dataset.step !== n; });
      enterPanel(flow.querySelector('.au-step[data-step="' + n + '"]'));
      $('flowProgress').querySelectorAll('span').forEach(function (s, i) { s.classList.toggle('on', i < n); });
    };

    // 온보딩에서 넘어온 경우: 저장될 매장 안내
    var fromOnboarding = mode === 'register' && new URLSearchParams(location.search).get('from') === 'onboarding';
    var onboardingRaw = null;
    if (fromOnboarding) {
      try { onboardingRaw = localStorage.getItem('og_onboarding'); } catch (e) {}
      try {
        var name = (JSON.parse(onboardingRaw) || {}).storeName;
        if (name) { $('onboardingStore').textContent = name; $('onboardingBanner').hidden = false; }
      } catch (e) {}
    }

    var startCooldown = function (sec) {
      clearTimeout(cooldownTimer);
      resendBtn.disabled = true;
      var tick = function () {
        if (sec <= 0) { resendBtn.disabled = false; resendBtn.textContent = '재전송'; return; }
        resendBtn.textContent = '재전송 ' + sec + '초';
        sec -= 1;
        cooldownTimer = setTimeout(tick, 1000);
      };
      tick();
    };

    // 발송 전에 가입 여부 확인 → Firebase 로 인증번호 발송
    var sendCode = function (btn, msgId) {
      var tel = digits(telEl.value);
      if (!window.ogFirebasePhone) { showMsg(msgId, '인증 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.'); return; }
      hideMsg(msgId);
      setLoading(btn, true);
      fetch('/check_tel?tel=' + encodeURIComponent(tel))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (mode === 'register' && d.exists) throw { friendly: '이미 가입된 번호예요. 로그인해 주세요.', login: true };
          if (mode === 'reset' && !d.exists) throw { friendly: '가입되지 않은 번호예요. 번호를 다시 확인해 주세요.' };
          return window.ogFirebasePhone.sendCode(tel);
        })
        .then(function () {
          setLoading(btn, false);
          $('sentTel').textContent = formatTel(tel);
          if (btn === sendBtn) goStep(2);
          codeEl.value = ''; verifyBtn.disabled = true; hideMsg('msg_step2');
          codeEl.focus();
          startCooldown(30);
          toast('인증번호를 보냈어요');
        })
        .catch(function (err) {
          setLoading(btn, false);
          if (btn === sendBtn) btn.disabled = !validTel(telEl.value);
          if (err && err.friendly) {
            showMsg(msgId, err.friendly);
            if (err.login) setTimeout(function () { location.href = '/login'; }, 1800);
            return;
          }
          console.error('[Firebase sendCode]', err);
          var code = (err && err.code) || '';
          showMsg(msgId, SEND_ERRORS[code] || ('인증번호 발송에 실패했습니다' + (code ? ' (' + code + ')' : '')));
        });
    };

    telEl.addEventListener('input', function () { hideMsg('msg_step1'); sendBtn.disabled = !validTel(telEl.value); });
    sendBtn.addEventListener('click', function () { sendCode(sendBtn, 'msg_step1'); });
    resendBtn.addEventListener('click', function () { resendBtn.disabled = true; sendCode(verifyBtn, 'msg_step2'); });
    $('changeTelBtn').addEventListener('click', function () { goStep(1); telEl.focus(); });

    var verifyCode = function () {
      if (verifyBtn.classList.contains('is-loading')) return;
      hideMsg('msg_step2');
      setLoading(verifyBtn, true);
      window.ogFirebasePhone.confirmCode(codeEl.value)
        .then(function (idToken) {
          verifiedToken = idToken;
          setLoading(verifyBtn, false);
          $('verifiedTel').textContent = formatTel(telEl.value);
          goStep(3);
          pwEl.focus();
        })
        .catch(function () {
          setLoading(verifyBtn, false);
          showMsg('msg_step2', '인증번호가 올바르지 않아요. 다시 확인해 주세요.');
          codeEl.select();
        });
    };
    codeEl.addEventListener('input', function () {
      codeEl.value = digits(codeEl.value).slice(0, 6);
      hideMsg('msg_step2');
      verifyBtn.disabled = codeEl.value.length !== 6;
      if (codeEl.value.length === 6) verifyCode(); // 6자리가 채워지면 바로 확인
    });
    verifyBtn.addEventListener('click', verifyCode);

    var refreshFinish = function () {
      var hint = $('pwMatchHint');
      var p = pwEl.value, p2 = pw2El.value;
      hint.className = 'au-field-hint';
      hint.textContent = '';
      if (p2.length) {
        var same = p === p2;
        hint.classList.add(same ? 'ok' : 'bad');
        hint.textContent = same ? '비밀번호가 일치해요' : '비밀번호가 일치하지 않아요';
      }
      if (!finishBtn.classList.contains('is-loading')) finishBtn.disabled = !(p.length >= MIN_PW && p === p2);
    };
    [pwEl, pw2El].forEach(function (el) { el.addEventListener('input', function () { hideMsg('msg_step3'); refreshFinish(); }); });

    // Enter 키: 단계에 맞는 버튼 실행
    flow.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing) return;
      if (e.target === telEl) { e.preventDefault(); if (!sendBtn.disabled) sendBtn.click(); }
      else if (e.target === codeEl) { e.preventDefault(); if (!verifyBtn.disabled) verifyBtn.click(); }
      else if (e.target === pwEl) { e.preventDefault(); pw2El.focus(); }
    });

    flow.addEventListener('submit', function (e) {
      e.preventDefault();
      if (finishBtn.disabled || !verifiedToken) return;
      setLoading(finishBtn, true);
      var tel = digits(telEl.value);
      var req = mode === 'register'
        ? post('/register_admin', { tel: tel, password: pwEl.value, firebase_id_token: verifiedToken, onboarding: onboardingRaw })
        : post('/find_password', { tel: tel, new_password: pwEl.value, firebase_id_token: verifiedToken });
      req.then(function (data) {
        if (data.code !== 200) { setLoading(finishBtn, false); showMsg('msg_step3', data.message || '처리 중 오류가 발생했습니다.'); return; }
        if (mode === 'register') {
          if (onboardingRaw) { try { localStorage.removeItem('og_onboarding'); } catch (err) {} }
          location.href = data.redirect || '/stores/new';
        } else {
          showMsg('msg_step3', '비밀번호를 변경했어요. 로그인 화면으로 이동합니다.', 'success');
          setTimeout(function () { location.href = '/login'; }, 900);
        }
      }).catch(function () { setLoading(finishBtn, false); showMsg('msg_step3', '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'); });
    });
  }

  // ── 매장 선택 ──
  var storeList = $('storeList');
  if (storeList) {
    storeList.querySelectorAll('button.au-store').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (storeList.classList.contains('is-busy')) return;
        storeList.classList.add('is-busy');
        btn.classList.add('is-loading');
        post('/stores/enter', { store_id: btn.dataset.storeId })
          .then(function (data) {
            if (data.code === 200 || data.redirect) { location.href = data.redirect || '/dashboard'; return; }
            throw new Error(data.message);
          })
          .catch(function (err) {
            storeList.classList.remove('is-busy');
            btn.classList.remove('is-loading');
            showMsg('msg_stores', (err && err.message) || '매장에 들어가지 못했어요. 다시 시도해주세요.');
          });
      });
    });
  }

  // ── 매장 만들기 ──
  var createForm = $('form_store_create');
  if (createForm) {
    var nameEl = $('new_store_name');
    var createBtn = createForm.querySelector('.au-btn');
    nameEl.addEventListener('input', function () {
      hideMsg('msg_store_create');
      nameEl.closest('.au-field').classList.remove('is-error');
      if (!createBtn.classList.contains('is-loading')) createBtn.disabled = nameEl.value.trim().length === 0;
    });
    createForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (createBtn.disabled) return;
      setLoading(createBtn, true);
      post('/register_store', { name: nameEl.value.trim() })
        .then(function (data) {
          if (data.code === 200) { location.href = data.redirect || '/dashboard'; return; }
          if (data.code === 401) { location.href = data.redirect || '/login'; return; }
          setLoading(createBtn, false);
          showMsg('msg_store_create', data.message || '매장을 만들지 못했어요.');
          nameEl.closest('.au-field').classList.add('is-error');
          nameEl.focus();
        })
        .catch(function () { setLoading(createBtn, false); showMsg('msg_store_create', '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'); });
    });
  }
})();
