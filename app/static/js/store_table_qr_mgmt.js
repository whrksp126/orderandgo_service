// 테이블 QR 발급 — 테이블 설정과 동일한 캔버스에서 카드 클릭 시 QR 표시(자동 생성)

const QR = { categories: [], curIndex: 0 };

// 캔버스 그리드 상수 (set_table / tableOrder와 동일)
const QR_COLS = 20, QR_ROWS = 12, QR_GAP = 16;
let QR_CELL_W = 60, QR_CELL_H = 60;

function updateCellSize() {
  const canvas = document.getElementById('table-canvas');
  if (!canvas) return;
  QR_CELL_W = (canvas.clientWidth + QR_GAP) / QR_COLS;
  QR_CELL_H = (canvas.clientHeight + QR_GAP) / QR_ROWS;
}

function applyRect(card) {
  const gx = Number(card.dataset.gx), gy = Number(card.dataset.gy);
  const gw = Number(card.dataset.gw), gh = Number(card.dataset.gh);
  card.style.left = `${gx * QR_CELL_W}px`;
  card.style.top = `${gy * QR_CELL_H}px`;
  card.style.width = `${gw * QR_CELL_W - QR_GAP}px`;
  card.style.height = `${gh * QR_CELL_H - QR_GAP}px`;
}

let _roTimer;
const _ro = new ResizeObserver(() => {
  clearTimeout(_roTimer);
  _roTimer = setTimeout(() => {
    updateCellSize();
    document.querySelectorAll('#table-canvas .table-card').forEach(applyRect);
  }, 60);
});

// ── API ──
async function apiGet(url) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  return r.json();
}
async function apiPost(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return r.json();
}

// ── 로드 & 렌더 ──
async function loadTables() {
  const cats = await apiGet('/store/get_table_qr_list');
  QR.categories = Array.isArray(cats) ? cats.sort((a, b) => (a.position || 0) - (b.position || 0)) : [];
  if (QR.curIndex >= QR.categories.length) QR.curIndex = 0;
  renderTabs();
  renderCanvas();
}

function renderTabs() {
  const ul = document.getElementById('qrCategoryTabs');
  ul.innerHTML = QR.categories.map((c, i) => `
    <li data-id="${c.id}" data-state="${i === QR.curIndex ? 'active' : ''}">
      <button onclick="changeCategory(${i})">${escapeHtml(c.name || '카테고리')}</button>
    </li>
  `).join('');
}

function changeCategory(i) {
  QR.curIndex = i;
  renderTabs();
  renderCanvas();
}

function renderCanvas() {
  updateCellSize();
  const canvas = document.getElementById('table-canvas');
  if (!canvas) return;
  canvas.innerHTML = '';
  const cat = QR.categories[QR.curIndex];
  const tables = (cat && cat.tables) || [];
  const placed = tables.filter(t => t.grid_x !== null && t.grid_x !== undefined);

  if (placed.length === 0) {
    canvas.innerHTML = `<div class="canvas-empty-state"><i class="ph ph-table"></i><p>배치된 테이블이 없습니다. (테이블 설정에서 먼저 배치하세요)</p></div>`;
    return;
  }

  placed.forEach((t) => {
    const name = t.name || ('테이블 ' + t.id);
    const card = document.createElement('div');
    card.className = 'table-card view-card qr-card';
    card.dataset.id = t.id;
    card.dataset.gx = t.grid_x;
    card.dataset.gy = t.grid_y;
    card.dataset.gw = t.grid_w || 2;
    card.dataset.gh = t.grid_h || 2;
    card.innerHTML = `<div class="card-title"><h2>${escapeHtml(name)}</h2></div>`;
    applyRect(card);
    card.addEventListener('click', () => openQrForTable(t.id, name));
    canvas.appendChild(card);
  });
}

// ── QR 모달 ──
let _currentQr = { png: null, url: null, filename: null, tableId: null };

function openQrForTable(tableId, name) {
  document.getElementById('qrModalTitle').textContent = name;
  const content = document.getElementById('qrModalContent');
  document.getElementById('qrModal').classList.add('active');
  content.innerHTML = '<div class="qr-empty-state">불러오는 중...</div>';

  // 이미 발급된 QR이 있으면 표시, 없으면 자동 생성
  apiGet('/store/get_table_qr/' + tableId).then(d => {
    if (d.code === 200) {
      renderQrView(d, tableId);
    } else {
      apiPost('/store/generate_table_qr', { table_id: tableId }).then(g => {
        if (g.code === 200) { renderQrView(g, tableId); }
        else content.innerHTML = `<div class="qr-empty-state">QR을 불러오지 못했습니다.</div>`;
      });
    }
  });
}

function renderQrView(d, tableId) {
  _currentQr = {
    png: d.qr_png,
    url: d.qr_url,
    filename: buildFilename(d),
    tableId: tableId,
  };
  document.getElementById('qrModalContent').innerHTML = `
    <div class="qr-frame"><img src="${d.qr_png}" alt="QR"></div>
    <div class="qr-url">${escapeHtml(d.qr_url)}</div>
    <div class="qr-modal-actions">
      <button class="qr-btn primary" onclick="downloadQrJpeg()"><i class="ph ph-printer"></i> 인쇄</button>
      <button class="qr-btn ghost" onclick="reissueQr()"><i class="ph ph-arrows-clockwise"></i> 재발급</button>
      <button class="qr-btn ghost" onclick="closeQrModal()">닫기</button>
    </div>`;
}

function reissueQr() {
  if (!_currentQr.tableId) return;
  if (!confirm('재발급하면 기존 QR은 더 이상 사용할 수 없습니다. 진행할까요?')) return;
  const tableId = _currentQr.tableId;
  const content = document.getElementById('qrModalContent');
  content.innerHTML = '<div class="qr-empty-state">재발급 중...</div>';
  apiPost('/store/generate_table_qr', { table_id: tableId }).then(g => {
    if (g.code === 200) renderQrView(g, tableId);
    else content.innerHTML = `<div class="qr-empty-state">재발급 실패</div>`;
  });
}

function closeQrModal(event) {
  document.getElementById('qrModal').classList.remove('active');
}

// 인쇄(= QR을 JPEG로 저장). 파일명: 매장_테이블카테고리_테이블명.jpg
function downloadQrJpeg() {
  if (!_currentQr.png) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    const jpeg = c.toDataURL('image/jpeg', 0.92);
    const a = document.createElement('a');
    a.href = jpeg;
    a.download = (_currentQr.filename || 'qr') + '.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  img.src = _currentQr.png;
}

function buildFilename(d) {
  const parts = [d.store_name, d.category_name, d.table_name].map(sanitizeName);
  return parts.filter(Boolean).join('_');
}
function sanitizeName(s) {
  return String(s == null ? '' : s).replace(/[\\/:*?"<>|]/g, '').trim();
}

// ── util ──
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── init ──
const _canvasEl = document.getElementById('table-canvas');
if (_canvasEl) _ro.observe(_canvasEl);
loadTables();
