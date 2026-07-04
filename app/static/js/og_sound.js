// =============================================
//  오더앤고 사운드 피드백 (POS / KDS)
//  - Web Audio API로 비프음을 실시간 합성 (오디오 파일 불필요, 오프라인 동작)
//  - 버튼/카드 클릭 시 "삑" 입력 피드백 + 주요 이벤트 알림음
//  - 음소거: localStorage 'og_sound_off' = '1'  (window.ogSound.toggle())
// =============================================
(function () {
  var ctx = null;
  var master = null;

  function enabled() {
    try { return localStorage.getItem('og_sound_off') !== '1'; } catch (e) { return true; }
  }

  // 오디오 컨텍스트 준비 (자동재생 정책상 사용자 제스처에서 resume 필요)
  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(ctx.destination);
      } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  // 단일 톤 스케줄링
  function tone(freq, startAt, dur, vol, type) {
    var c = ensureCtx();
    if (!c) return;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    var t = c.currentTime + (startAt || 0);
    var v = vol != null ? vol : 0.06;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.004);   // 빠른 어택
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur); // 지수 감쇠
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // 연속 톤(멜로디)
  function seq(notes) {
    // notes: [{f, at, d, v, type}]
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      tone(n.f, n.at, n.d, n.v, n.type);
    }
  }

  var api = {
    // 버튼/카드 입력 — 짧고 또렷한 "삑"
    click: function () { if (enabled()) tone(1500, 0, 0.028, 0.05, 'square'); },
    // 부드러운 탭(보조)
    tap: function () { if (enabled()) tone(1100, 0, 0.022, 0.04, 'square'); },
    // 성공(주문 완료/결제 승인) — 상승 2음
    success: function () { if (enabled()) seq([{ f: 988, at: 0, d: 0.07, v: 0.06, type: 'triangle' }, { f: 1319, at: 0.075, d: 0.11, v: 0.06, type: 'triangle' }]); },
    // 오류/실패 — 하강 2음(낮은 버즈)
    error: function () { if (enabled()) seq([{ f: 320, at: 0, d: 0.12, v: 0.07, type: 'square' }, { f: 200, at: 0.12, d: 0.18, v: 0.07, type: 'square' }]); },
    // 새 주문 알림 — 맑은 딩동
    notify: function () { if (enabled()) seq([{ f: 784, at: 0, d: 0.09, v: 0.06, type: 'sine' }, { f: 1047, at: 0.10, d: 0.14, v: 0.06, type: 'sine' }]); },
    // 직원 호출 — 주의를 끄는 3연타
    call: function () { if (enabled()) seq([{ f: 1319, at: 0, d: 0.06, v: 0.06, type: 'square' }, { f: 1319, at: 0.12, d: 0.06, v: 0.06, type: 'square' }, { f: 1319, at: 0.24, d: 0.06, v: 0.06, type: 'square' }]); },
    // 조리 완료(KDS) — 상승 딩
    complete: function () { if (enabled()) seq([{ f: 1047, at: 0, d: 0.08, v: 0.06, type: 'triangle' }, { f: 1568, at: 0.085, d: 0.13, v: 0.06, type: 'triangle' }]); },

    setEnabled: function (on) { try { localStorage.setItem('og_sound_off', on ? '0' : '1'); } catch (e) {} },
    toggle: function () { var on = enabled(); this.setEnabled(!on); return !on; },
    isEnabled: enabled,
  };
  window.ogSound = api;

  // ── 전역 클릭 피드백 (버튼/카드/메뉴 등 상호작용 요소) ──
  // pointerdown = 누르는 즉시 피드백(터치·마우스 공통). 비활성 요소는 제외.
  var CLICKABLE = [
    'button', 'a[href]', 'input[type="submit"]', '[role="button"]', '[onclick]',
    '.item', '.menu', '.table_box', '.card', '.change_page_btn',
    '.table-card', '.view-card',            // POS 테이블 카드
    '.kds-card', '.card-footer button', '.btn-item-complete', // KDS 카드/버튼
    '.ob-chip', '.su-step', '.count_btns button', '.order_btns button',
    '.tab', '.btn', '[class*="btn"]', 'li[onclick]', 'nav li'
  ].join(',');

  function onDown(e) {
    var el = e.target && e.target.closest ? e.target.closest(CLICKABLE) : null;
    if (!el) return;
    if (el.disabled) return;
    if (el.getAttribute && el.getAttribute('data-active') === 'false') return; // 비활성 표시 버튼
    if (el.getAttribute && el.getAttribute('aria-disabled') === 'true') return;
    api.click();
  }
  document.addEventListener('pointerdown', onDown, true);
})();
