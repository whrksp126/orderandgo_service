/* ═══════════════════════════════════════════════════
   KDS (주방 디스플레이 시스템) 메인 JS
═══════════════════════════════════════════════════ */

const STATION_ID = window.KDS_STATION_ID;
const STORE_ID = window.KDS_STORE_ID;
const STAFF_CALL_IDS = window.KDS_STAFF_CALL_IDS || [];

let pendingBatches = [];
let doneBatches = [];
let currentTab = 'pending';
let elapsedInterval = null;

// ── 초기화 ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);

  // 경과 시간 업데이트 (5초마다)
  elapsedInterval = setInterval(updateElapsed, 5000);

  loadOrders();
  loadCompleted();

  // SocketIO
  if (typeof socket !== 'undefined') {
    // 연결/재연결 시 항상 KDS 룸에 참여
    socket.on('connect', () => {
      socket.emit('join_kds', { store_id: STORE_ID });
    });

    socket.on('kds_new_order', () => {
      loadOrders();
    });

    socket.on('kds_order_completed', (data) => {
      // 완료된 order_ids를 pending에서 제거 후 재로드
      loadOrders();
      loadCompleted();
    });

    socket.on('staff_call_notification', (data) => {
      // 이 스테이션과 연동된 항목만 알림
      const itemId = data.staff_call_item_id;
      if (STAFF_CALL_IDS.length === 0 || STAFF_CALL_IDS.includes(itemId)) {
        showStaffCallPopup(data);
      }
    });
  }
});

// ── 시계 ──────────────────────────────────────────────────────────────────

function updateClock() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const el = document.getElementById('kdsClock');
  if (el) {
    el.textContent = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
}

// ── 데이터 로드 ───────────────────────────────────────────────────────────

async function loadOrders() {
  try {
    const res = await fetch(`/kds/api/orders?station_id=${STATION_ID}`);
    pendingBatches = await res.json();
    renderPendingBoard();
    updateCounts();
  } catch (e) {
    console.error('주문 로드 실패', e);
  }
}

async function loadCompleted() {
  try {
    const res = await fetch(`/kds/api/completed?station_id=${STATION_ID}`);
    doneBatches = await res.json();
    if (currentTab === 'done') renderDoneBoard();
    updateCounts();
  } catch (e) {
    console.error('완료 주문 로드 실패', e);
  }
}

// ── 탭 전환 ───────────────────────────────────────────────────────────────

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.kds-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.kds-tab[data-tab="${tab}"]`).classList.add('active');

  if (tab === 'pending') {
    renderPendingBoard();
  } else {
    loadCompleted();
    renderDoneBoard();
  }
}

// ── 렌더링 ────────────────────────────────────────────────────────────────

function renderPendingBoard() {
  const board = document.getElementById('kdsBoard');
  if (currentTab !== 'pending') return;

  if (pendingBatches.length === 0) {
    board.innerHTML = `
      <div class="kds-empty-state">
        <i class="ph ph-check-circle"></i>
        <p>대기 중인 주문이 없습니다</p>
      </div>`;
    return;
  }

  board.innerHTML = `<div class="kds-grid">${pendingBatches.map(renderCard).join('')}</div>`;
}

function renderDoneBoard() {
  const board = document.getElementById('kdsBoard');
  if (currentTab !== 'done') return;

  if (doneBatches.length === 0) {
    board.innerHTML = `
      <div class="kds-empty-state">
        <i class="ph ph-list-checks"></i>
        <p>완료된 주문이 없습니다</p>
      </div>`;
    return;
  }

  board.innerHTML = `<div class="kds-grid">${doneBatches.map(b => renderCard(b, true)).join('')}</div>`;
}

function renderCard(batch, isDone = false) {
  const elapsed = calcElapsed(batch.ordered_at);
  const urgencyClass = isDone ? 'done-card' : getUrgencyClass(elapsed);
  const elapsedText = formatElapsed(elapsed);
  const orderedTimeText = batch.ordered_at.substring(11, 16); // HH:MM

  const itemsHtml = batch.items.map(item => {
    const optionsHtml = item.options.length > 0
      ? `<div class="card-item-options">${item.options.map(o => `<span class="card-option-tag">${escHtml(o)}</span>`).join('')}</div>`
      : '';
    const itemCompleteBtn = isDone
      ? ''
      : `<button class="btn-item-complete" onclick="event.stopPropagation(); completeBatch(${JSON.stringify(item.order_ids)})" title="이 메뉴만 완료"><i class="ph ph-check"></i></button>`;
    return `
      <div>
        <div class="card-item">
          <span class="card-item-name">${escHtml(item.menu_name)}</span>
          <span class="card-item-qty">x${item.quantity}</span>
          ${itemCompleteBtn}
        </div>
        ${optionsHtml}
      </div>`;
  }).join('');

  const footerHtml = isDone
    ? `<div class="card-footer"><button class="btn-complete" disabled><i class="ph ph-check"></i> 완료됨</button></div>`
    : `<div class="card-footer"><button class="btn-complete" onclick="completeBatch(${JSON.stringify(batch.order_ids)})"><i class="ph ph-check"></i> 완료처리</button></div>`;

  return `
    <div class="order-card ${urgencyClass}" data-batch-key="${escHtml(batch.batch_key)}" data-ordered-at="${escHtml(batch.ordered_at)}">
      <div class="card-top">
        <span class="card-table-name">${escHtml(batch.table_name)}</span>
        <div class="card-time-info">
          <span class="card-ordered-time">${orderedTimeText}</span>
          <span class="card-elapsed" data-ordered-at="${escHtml(batch.ordered_at)}">⏱ ${elapsedText}</span>
        </div>
      </div>
      <div class="card-items">${itemsHtml}</div>
      ${footerHtml}
    </div>`;
}

// ── 완료 처리 ─────────────────────────────────────────────────────────────

async function completeBatch(orderIds) {
  try {
    const res = await fetch('/kds/api/complete_batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_ids: orderIds })
    });
    const data = await res.json();
    if (data.code === 200) {
      // 즉시 UI 반영
      pendingBatches = pendingBatches.filter(b => !orderIds.some(id => b.order_ids.includes(id)));
      loadOrders();
      renderPendingBoard();
      updateCounts();
      loadCompleted();
    } else {
      showToast('완료 처리 중 오류가 발생했습니다.', 'error');
    }
  } catch (e) {
    showToast('서버와의 통신에 실패했습니다.', 'error');
  }
}

// ── 카운트 뱃지 업데이트 ──────────────────────────────────────────────────

function updateCounts() {
  const pendingEl = document.getElementById('pendingCount');
  const doneEl = document.getElementById('doneCount');
  if (pendingEl) pendingEl.textContent = `대기 ${pendingBatches.length}건`;
  if (doneEl) doneEl.textContent = `완료 ${doneBatches.length}건`;
}

// ── 경과 시간 실시간 갱신 ─────────────────────────────────────────────────

function updateElapsed() {
  document.querySelectorAll('.card-elapsed[data-ordered-at]').forEach(el => {
    const elapsed = calcElapsed(el.dataset.orderedAt);
    el.textContent = `⏱ ${formatElapsed(elapsed)}`;

    const card = el.closest('.order-card');
    if (card && !card.classList.contains('done-card')) {
      card.classList.remove('warning', 'urgent');
      const cls = getUrgencyClass(elapsed);
      if (cls) card.classList.add(cls);
    }
  });
}

function calcElapsed(orderedAt) {
  const now = new Date();
  const ordered = new Date(orderedAt.replace('T', ' '));
  return Math.floor((now - ordered) / 1000);
}

function formatElapsed(seconds) {
  if (seconds < 60) return `${seconds}초`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

function getUrgencyClass(seconds) {
  if (seconds >= 300) return 'urgent';   // 5분 이상
  if (seconds >= 120) return 'warning';  // 2분 이상
  return '';
}

// ── 직원 호출 팝업 ────────────────────────────────────────────────────────

let popupTimeout = null;

function showStaffCallPopup(data) {
  const popup = document.getElementById('staffCallPopup');
  const tableEl = document.getElementById('popupTable');
  const itemEl = document.getElementById('popupItem');

  if (!popup) return;

  tableEl.textContent = data.table_name || '';
  itemEl.textContent = data.item_name ? ` · ${data.item_name}` : '';

  popup.classList.add('visible');

  if (popupTimeout) clearTimeout(popupTimeout);
  popupTimeout = setTimeout(() => closeStaffCallPopup(), 5000);
}

function closeStaffCallPopup() {
  const popup = document.getElementById('staffCallPopup');
  if (popup) popup.classList.remove('visible');
}

// ── 유틸 ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
