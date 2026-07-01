// 테이블 QR 발급 관리 페이지

let _lat = null;
let _lng = null;
let _currentQr = { png: null, url: null, title: null };

// ── API 헬퍼 ──
async function apiGet(url) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  return res.json();
}
async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

// ── 지오펜스 / 매장 위치 ──
async function loadGeofence() {
  const d = await apiGet('/store/get_store_location');
  if (d.code === 404) return;
  _lat = d.latitude;
  _lng = d.longitude;
  document.getElementById('geoRadius').value = d.geofence_radius_m || 200;
  document.getElementById('geoEnabled').checked = !!d.qr_geofence_enabled;
  document.getElementById('requireSession').checked = !!d.qr_require_open_session;
  renderCoords();
}

function renderCoords() {
  const el = document.getElementById('geoCoords');
  if (_lat != null && _lng != null) {
    el.textContent = `현재 좌표: ${Number(_lat).toFixed(6)}, ${Number(_lng).toFixed(6)}`;
  } else {
    el.textContent = '좌표 미설정';
  }
}

function setStoreLocationHere() {
  if (!navigator.geolocation) {
    alert('이 브라우저는 위치 기능을 지원하지 않습니다.');
    return;
  }
  const el = document.getElementById('geoCoords');
  el.textContent = '위치 확인 중...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      _lat = pos.coords.latitude;
      _lng = pos.coords.longitude;
      renderCoords();
    },
    (err) => {
      el.textContent = '위치 확인 실패 (권한을 허용해 주세요)';
      console.warn(err);
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  );
}

async function saveGeofence() {
  const body = {
    latitude: _lat,
    longitude: _lng,
    geofence_radius_m: parseInt(document.getElementById('geoRadius').value, 10) || 200,
    qr_geofence_enabled: document.getElementById('geoEnabled').checked,
    qr_require_open_session: document.getElementById('requireSession').checked,
  };
  const d = await apiPost('/store/set_store_location', body);
  alert(d.msg || '저장되었습니다.');
}

// ── 테이블 QR 목록 ──
async function loadTables() {
  const cats = await apiGet('/store/get_table_qr_list');
  const wrap = document.getElementById('qrTableList');
  if (!Array.isArray(cats) || cats.length === 0) {
    wrap.innerHTML = '<p style="color:#999;">등록된 테이블이 없습니다.</p>';
    return;
  }
  wrap.innerHTML = cats.map((cat) => `
    <div class="cat-block">
      <h3>${escapeHtml(cat.name || '카테고리')}</h3>
      <div class="table-grid">
        ${(cat.tables || []).map((t) => `
          <div class="table-cell">
            <div class="tname">${escapeHtml(t.name || ('테이블 ' + t.id))}</div>
            <div class="tstate ${t.has_qr ? 'on' : ''}">${t.has_qr ? 'QR 발급됨' : '미발급'}</div>
            <div class="cell-actions">
              <button class="btn brand small" onclick="generateQr(${t.id}, '${escapeAttr(t.name || '')}')">
                ${t.has_qr ? '재발급' : 'QR 발급'}
              </button>
              ${t.has_qr ? `<button class="btn ghost small" onclick="viewQr(${t.id})">보기</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

async function generateQr(tableId, tableName) {
  if (!confirm('QR을 발급/재발급하면 기존 QR은 더 이상 사용할 수 없습니다. 진행할까요?')) return;
  const d = await apiPost('/store/generate_table_qr', { table_id: tableId });
  if (d.code !== 200) {
    alert(d.msg || 'QR 발급에 실패했습니다.');
    return;
  }
  openQrModal(tableName || ('테이블 ' + tableId), d.qr_png, d.qr_url);
  loadTables();
}

async function viewQr(tableId) {
  const d = await apiGet('/store/get_table_qr/' + tableId);
  if (d.code !== 200) {
    alert(d.msg || 'QR을 불러오지 못했습니다.');
    return;
  }
  openQrModal(d.table_name || ('테이블 ' + tableId), d.qr_png, d.qr_url);
}

// ── QR 모달 ──
function openQrModal(title, png, url) {
  _currentQr = { png, url, title };
  document.getElementById('qrModalTitle').textContent = title;
  document.getElementById('qrModalImg').src = png;
  document.getElementById('qrModalUrl').textContent = url;
  document.getElementById('qrModal').classList.add('active');
}

function closeQrModal(event) {
  document.getElementById('qrModal').classList.remove('active');
}

function printCurrentQr() {
  if (!_currentQr.png) return;
  const w = window.open('', '_blank');
  w.document.write(`
    <html><head><title>${escapeHtml(_currentQr.title)}</title>
    <style>
      body { text-align:center; font-family: sans-serif; padding: 40px; }
      h2 { margin-bottom: 16px; }
      img { width: 320px; height: 320px; }
      .u { font-size: 11px; color:#666; margin-top: 12px; word-break: break-all; }
    </style></head>
    <body>
      <h2>${escapeHtml(_currentQr.title)}</h2>
      <img src="${_currentQr.png}">
      <div class="u">${escapeHtml(_currentQr.url)}</div>
      <script>window.onload = function(){ window.print(); }<\/script>
    </body></html>
  `);
  w.document.close();
}

function downloadCurrentQr() {
  if (!_currentQr.png) return;
  const a = document.createElement('a');
  a.href = _currentQr.png;
  a.download = `qr_${(_currentQr.title || 'table').replace(/\s+/g, '_')}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── util ──
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// 초기 로드
loadGeofence();
loadTables();
