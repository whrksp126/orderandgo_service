// =============================================
//  오더앤고 사운드 피드백 (POS / KDS)
//  - 비프음을 JS로 합성. 즉시 반응을 위해 Web Audio(AudioBuffer) 우선 재생,
//    Web Audio가 막힌 기기(일부 iOS)에서는 HTML5 <audio>(WAV data-URI)로 폴백.
//  - 첫 사용자 제스처에서 HTML5로 오디오를 깨우고 AudioContext를 resume(둘 다 언락).
//  - 음소거: localStorage 'og_sound_off' = '1'  (window.ogSound.toggle())
// =============================================
(function () {
  var SR = 22050;

  function enabled() {
    try { return localStorage.getItem('og_sound_off') !== '1'; } catch (e) { return true; }
  }

  // 노트 시퀀스 → Float32 PCM 샘플
  function renderSamples(notes) {
    var total = 0.04;
    for (var i = 0; i < notes.length; i++) total = Math.max(total, notes[i].at + notes[i].d + 0.03);
    var N = Math.ceil(total * SR);
    var buf = new Float32Array(N);
    for (var j = 0; j < notes.length; j++) {
      var no = notes[j];
      var s0 = Math.floor((no.at || 0) * SR);
      var d = Math.floor(no.d * SR);
      var vol = (no.v != null ? no.v : 0.5);
      var ty = no.type || 'triangle';
      for (var i2 = 0; i2 < d; i2++) {
        var t = i2 / SR;
        var env = Math.min(1, t / 0.003) * Math.exp(-t / (no.d * 0.5)); // 빠른 어택 + 지수 감쇠
        var ph = 2 * Math.PI * no.f * t;
        var w;
        if (ty === 'square') w = Math.sin(ph) >= 0 ? 1 : -1;
        else if (ty === 'triangle') w = (2 / Math.PI) * Math.asin(Math.sin(ph));
        else w = Math.sin(ph);
        var idx = s0 + i2;
        if (idx < N) buf[idx] += w * vol * env;
      }
    }
    return buf;
  }

  // Float32 PCM → 16-bit WAV data-URI (HTML5 폴백용)
  function samplesToWavUri(buf) {
    var N = buf.length, dataLen = N * 2;
    var ab = new ArrayBuffer(44 + dataLen), dv = new DataView(ab);
    function ws(o, s) { for (var k = 0; k < s.length; k++) dv.setUint8(o + k, s.charCodeAt(k)); }
    ws(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); ws(8, 'WAVE');
    ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    ws(36, 'data'); dv.setUint32(40, dataLen, true);
    var off = 44;
    for (var i = 0; i < N; i++) { var s = Math.max(-1, Math.min(1, buf[i])); dv.setInt16(off, s * 0x7FFF, true); off += 2; }
    var bytes = new Uint8Array(ab), bin = '';
    for (var b = 0; b < bytes.length; b++) bin += String.fromCharCode(bytes[b]);
    return 'data:audio/wav;base64,' + btoa(bin);
  }

  // 사운드 정의 — POS에 어울리는 부드러운 톤(sine/triangle, 낮은 주파수, 짧게)
  var DEFS = {
    click: [{ f: 620, at: 0, d: 0.016, v: 0.42, type: 'triangle' }],
    tap: [{ f: 520, at: 0, d: 0.014, v: 0.32, type: 'triangle' }],
    success: [{ f: 784, at: 0, d: 0.08, v: 0.5, type: 'sine' }, { f: 1175, at: 0.08, d: 0.12, v: 0.5, type: 'sine' }],
    error: [{ f: 400, at: 0, d: 0.10, v: 0.5, type: 'triangle' }, { f: 300, at: 0.10, d: 0.16, v: 0.5, type: 'triangle' }],
    notify: [{ f: 660, at: 0, d: 0.09, v: 0.5, type: 'sine' }, { f: 988, at: 0.10, d: 0.14, v: 0.5, type: 'sine' }],
    call: [{ f: 880, at: 0, d: 0.07, v: 0.45, type: 'sine' }, { f: 880, at: 0.13, d: 0.07, v: 0.45, type: 'sine' }, { f: 880, at: 0.26, d: 0.07, v: 0.45, type: 'sine' }],
    complete: [{ f: 880, at: 0, d: 0.08, v: 0.5, type: 'sine' }, { f: 1319, at: 0.085, d: 0.13, v: 0.5, type: 'sine' }],
  };

  var SAMPLES = {}, URIS = {};
  for (var key in DEFS) {
    if (!DEFS.hasOwnProperty(key)) continue;
    try {
      SAMPLES[key] = renderSamples(DEFS[key]);
      URIS[key] = samplesToWavUri(SAMPLES[key]);
    } catch (e) { SAMPLES[key] = null; URIS[key] = null; }
  }

  // ── Web Audio (즉시 재생) ──
  var ac = null, WBUF = {};
  function initWebAudio() {
    if (ac) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC(); } catch (e) { ac = null; return; }
    for (var k in SAMPLES) {
      if (!SAMPLES[k]) continue;
      try {
        var b = ac.createBuffer(1, SAMPLES[k].length, SR);
        b.getChannelData(0).set(SAMPLES[k]);
        WBUF[k] = b;
      } catch (e) {}
    }
  }
  function playWebAudio(key) {
    if (!ac || ac.state !== 'running' || !WBUF[key]) return false;
    try {
      var s = ac.createBufferSource();
      s.buffer = WBUF[key];
      s.connect(ac.destination);
      if (s.start) s.start(0); else if (s.noteOn) s.noteOn(0);
      return true;
    } catch (e) { return false; }
  }

  // ── HTML5 폴백 (예열 링풀) ──
  var POOL_SIZE = 4, POOL = {}, RING = {};
  function buildPools() {
    for (var k in URIS) {
      if (!URIS[k] || POOL[k]) continue;
      POOL[k] = []; RING[k] = 0;
      for (var i = 0; i < POOL_SIZE; i++) { var a = new Audio(URIS[k]); a.preload = 'auto'; POOL[k].push(a); }
    }
  }
  function playHtml5(key) {
    var pool = POOL[key];
    if (!pool || !pool.length) return;
    var a = pool[RING[key]];
    RING[key] = (RING[key] + 1) % pool.length;
    try { a.volume = 1; a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }

  function play(key) {
    if (!enabled() || !SAMPLES[key]) return;
    if (playWebAudio(key)) return;   // 즉시(Web Audio)
    playHtml5(key);                   // 폴백(HTML5)
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

  // ── 첫 제스처에서 언락: HTML5로 오디오 하드웨어를 깨운 뒤 AudioContext resume ──
  var unlocked = false;
  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    // 1) HTML5 풀 구성 + 무음 예열 (iOS 오디오 세션 깨우기 + 폴백 대비)
    buildPools();
    for (var key in POOL) {
      if (!POOL.hasOwnProperty(key)) continue;
      for (var i = 0; i < POOL[key].length; i++) {
        (function (au) {
          try {
            au.volume = 0;
            var p = au.play();
            if (p && p.then) p.then(function () { au.pause(); au.currentTime = 0; au.volume = 1; }).catch(function () { au.volume = 1; });
            else { try { au.pause(); au.currentTime = 0; } catch (e) {} au.volume = 1; }
          } catch (e) { au.volume = 1; }
        })(POOL[key][i]);
      }
    }
    // 2) Web Audio 생성 + resume (HTML5로 하드웨어가 깨어난 직후라 성공 확률↑)
    initWebAudio();
    if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
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
