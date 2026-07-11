// =============================================
//  오더앤고 사운드 피드백 (POS / KDS)
//  - 비프음을 JS로 WAV(PCM)로 합성 → data-URI → HTML5 <audio>로 재생 (오디오 파일 불필요)
//  - iOS Safari/홈앱(PWA)은 Web Audio 합성이 막히는 경우가 많아 HTML5 오디오로 재생한다.
//  - 첫 사용자 제스처에서 오디오를 언락(iOS 자동재생 정책).
//  - 음소거: localStorage 'og_sound_off' = '1'  (window.ogSound.toggle())
// =============================================
(function () {
  var SR = 22050;

  function enabled() {
    try { return localStorage.getItem('og_sound_off') !== '1'; } catch (e) { return true; }
  }

  // 노트 시퀀스를 16-bit PCM mono WAV data-URI 로 렌더링
  //  notes: [{f, at, d, v, type}]  (type: square|triangle|sine)
  function renderWav(notes) {
    var total = 0.04;
    for (var i = 0; i < notes.length; i++) total = Math.max(total, notes[i].at + notes[i].d + 0.03);
    var N = Math.ceil(total * SR);
    var buf = new Float32Array(N);
    for (var j = 0; j < notes.length; j++) {
      var no = notes[j];
      var s0 = Math.floor((no.at || 0) * SR);
      var d = Math.floor(no.d * SR);
      var vol = (no.v != null ? no.v : 0.5);
      var ty = no.type || 'square';
      for (var i = 0; i < d; i++) {
        var t = i / SR;
        var atk = Math.min(1, t / 0.004);              // 빠른 어택
        var dec = Math.exp(-t / (no.d * 0.5));          // 지수 감쇠
        var env = atk * dec;
        var ph = 2 * Math.PI * no.f * t;
        var w;
        if (ty === 'square') w = Math.sin(ph) >= 0 ? 1 : -1;
        else if (ty === 'triangle') w = (2 / Math.PI) * Math.asin(Math.sin(ph));
        else w = Math.sin(ph);
        var idx = s0 + i;
        if (idx < N) buf[idx] += w * vol * env;
      }
    }
    var dataLen = N * 2;
    var ab = new ArrayBuffer(44 + dataLen);
    var dv = new DataView(ab);
    function ws(off, s) { for (var k = 0; k < s.length; k++) dv.setUint8(off + k, s.charCodeAt(k)); }
    ws(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); ws(8, 'WAVE');
    ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    ws(36, 'data'); dv.setUint32(40, dataLen, true);
    var off = 44;
    for (var i2 = 0; i2 < N; i2++) {
      var s = Math.max(-1, Math.min(1, buf[i2]));
      dv.setInt16(off, s * 0x7FFF, true); off += 2;
    }
    var bytes = new Uint8Array(ab), bin = '';
    for (var b = 0; b < bytes.length; b++) bin += String.fromCharCode(bytes[b]);
    return 'data:audio/wav;base64,' + btoa(bin);
  }

  // 사운드 정의 (WebAudio 버전 대비 진폭을 키워 HTML5 재생에서 잘 들리게)
  var DEFS = {
    click: [{ f: 1500, at: 0, d: 0.028, v: 0.5, type: 'square' }],
    tap: [{ f: 1100, at: 0, d: 0.022, v: 0.4, type: 'square' }],
    success: [{ f: 988, at: 0, d: 0.07, v: 0.55, type: 'triangle' }, { f: 1319, at: 0.075, d: 0.11, v: 0.55, type: 'triangle' }],
    error: [{ f: 320, at: 0, d: 0.12, v: 0.6, type: 'square' }, { f: 200, at: 0.12, d: 0.18, v: 0.6, type: 'square' }],
    notify: [{ f: 784, at: 0, d: 0.09, v: 0.55, type: 'sine' }, { f: 1047, at: 0.10, d: 0.14, v: 0.55, type: 'sine' }],
    call: [{ f: 1319, at: 0, d: 0.06, v: 0.5, type: 'square' }, { f: 1319, at: 0.12, d: 0.06, v: 0.5, type: 'square' }, { f: 1319, at: 0.24, d: 0.06, v: 0.5, type: 'square' }],
    complete: [{ f: 1047, at: 0, d: 0.08, v: 0.55, type: 'triangle' }, { f: 1568, at: 0.085, d: 0.13, v: 0.55, type: 'triangle' }],
  };

  // 각 사운드를 data-URI 로 미리 렌더 + Audio 엘리먼트 생성
  var URIS = {}, POOL = {};
  for (var key in DEFS) {
    if (!DEFS.hasOwnProperty(key)) continue;
    try { URIS[key] = renderWav(DEFS[key]); } catch (e) { URIS[key] = null; }
    POOL[key] = [];
  }

  // 겹쳐 재생 가능하도록 사운드별 오디오 풀에서 재사용
  function getAudio(key) {
    var pool = POOL[key];
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].paused || pool[i].ended) return pool[i];
    }
    if (URIS[key] && pool.length < 6) {
      var a = new Audio(URIS[key]);
      a.preload = 'auto';
      pool.push(a);
      return a;
    }
    return pool[0] || null;
  }

  function play(key) {
    if (!enabled() || !URIS[key]) return;
    var a = getAudio(key);
    if (!a) return;
    try { a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }

  var api = {
    click: function () { play('click'); },
    tap: function () { play('tap'); },
    success: function () { play('success'); },
    error: function () { play('error'); },
    notify: function () { play('notify'); },
    call: function () { play('call'); },
    complete: function () { play('complete'); },
    setEnabled: function (on) { try { localStorage.setItem('og_sound_off', on ? '0' : '1'); } catch (e) {} },
    toggle: function () { var on = enabled(); this.setEnabled(!on); return !on; },
    isEnabled: enabled,
  };
  window.ogSound = api;

  // ── 첫 제스처에서 HTML5 오디오 언락 (iOS 자동재생 정책) ──
  var unlocked = false;
  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    for (var key in POOL) {
      if (!POOL.hasOwnProperty(key) || !URIS[key]) continue;
      var a = new Audio(URIS[key]);
      a.preload = 'auto';
      a.volume = 0;
      POOL[key].push(a);
      (function (au) {
        try {
          var p = au.play();
          if (p && p.then) p.then(function () { au.pause(); au.currentTime = 0; au.volume = 1; }).catch(function () { au.volume = 1; });
          else { try { au.pause(); au.currentTime = 0; } catch (e) {} au.volume = 1; }
        } catch (e) { au.volume = 1; }
      })(a);
    }
    document.removeEventListener('pointerdown', unlockAudio, true);
    document.removeEventListener('touchend', unlockAudio, true);
    document.removeEventListener('keydown', unlockAudio, true);
  }
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('touchend', unlockAudio, true);
  document.addEventListener('keydown', unlockAudio, true);

  // ── 전역 클릭 피드백 (버튼/카드/메뉴 등) ──
  var CLICKABLE = [
    'button', 'a[href]', 'input[type="submit"]', '[role="button"]', '[onclick]',
    '.item', '.menu', '.table_box', '.card', '.change_page_btn',
    '.table-card', '.view-card',
    '.kds-card', '.card-footer button', '.btn-item-complete',
    '.ob-chip', '.su-step', '.count_btns button', '.order_btns button',
    '.tab', '.btn', '[class*="btn"]', 'li[onclick]', 'nav li'
  ].join(',');

  function onDown(e) {
    var el = e.target && e.target.closest ? e.target.closest(CLICKABLE) : null;
    if (!el) return;
    if (el.disabled) return;
    if (el.getAttribute && el.getAttribute('data-active') === 'false') return;
    if (el.getAttribute && el.getAttribute('aria-disabled') === 'true') return;
    api.click();
  }
  document.addEventListener('pointerdown', onDown, true);
})();
