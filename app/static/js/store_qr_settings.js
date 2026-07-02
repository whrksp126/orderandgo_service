// QR 주문 설정 — 매장 위치/지오펜스/세션 게이트

let _lat = null;
let _lng = null;

async function apiGet(url) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  return r.json();
}
async function apiPost(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return r.json();
}

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
    el.textContent = `설정됨 · ${Number(_lat).toFixed(6)}, ${Number(_lng).toFixed(6)}`;
    el.classList.add('set');
  } else {
    el.textContent = '좌표 미설정';
    el.classList.remove('set');
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

loadGeofence();
