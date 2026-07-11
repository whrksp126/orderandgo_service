/* ═══════════════════════════════════════════════════
   KDS (주방 디스플레이 시스템) 메인 JS
═══════════════════════════════════════════════════ */

const STATION_ID = window.KDS_STATION_ID;
const STORE_ID = window.KDS_STORE_ID;
const STAFF_CALL_IDS = window.KDS_STAFF_CALL_IDS || [];

let pendingBatches = [];
let doneBatches = [];
let cancelledBatches = [];
let cancelledOrderIds = new Set();
let doneItemOrderIds = new Set();  // 개별 완료 처리된 item의 order_ids 키 (시각적 상태)
let currentTab = 'pending';
let elapsedInterval = null;
let knownOrderIds = new Set();     // 알림음용: 이미 인지한 대기주문 order_id
let initialLoadDone = false;       // 최초 로드 시엔 알림음 재생 안 함

// ── 초기화 ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);

  // 경과 시간 업데이트 (1초마다)
  elapsedInterval = setInterval(updateElapsed, 1000);

  loadOrders();
  loadCompleted();

  // SocketIO
  if (typeof socket !== 'undefined') {
    // 연결/재연결 시 항상 KDS 룸에 참여
    socket.on('connect', () => {
      socket.emit('join_kds', { store_id: STORE_ID });
    });

    socket.on('kds_new_order', () => {
      // 서버가 이 스테이션 룸으로만 emit → 도달했다면 관련 주문. 실제 신규건 있을 때만 알림음.
      loadOrders({ notify: true });
    });

    socket.on('kds_order_completed', (data) => {
      // 완료된 order_ids를 pending에서 제거 후 재로드
      loadOrders();
      loadCompleted();
    });

    socket.on('kds_orders_cancelled', (data) => {
      (data.order_ids || []).forEach(id => cancelledOrderIds.add(id));

      let hasCancelled = false;
      pendingBatches.forEach(batch => {
        batch.items.forEach(item => {
          const cnt = item.order_ids.filter(id => cancelledOrderIds.has(id)).length;
          if (cnt > 0) { item.cancelled = true; item.cancelledQty = cnt; hasCancelled = true; }
        });
        batch.hasCancelledItems = batch.items.some(i => i.cancelled);
      });

      if (hasCancelled) {
        // 완전 취소 배치 → cancelledBatches로 이동
        const fullyCancelled = pendingBatches.filter(b => b.items.every(i => i.cancelled));
        pendingBatches = pendingBatches.filter(b => !b.items.every(i => i.cancelled));
        fullyCancelled.forEach(b => {
          b.isCancelled = true;
          if (!cancelledBatches.find(cb => cb.batch_key === b.batch_key)) {
            cancelledBatches.push(b);
          }
        });
        renderPendingBoard();
      }
    });

    socket.on('staff_call_notification', (data) => {
      // 이 스테이션과 연동된 항목만 알림
      const itemId = data.staff_call_item_id;
      if (STAFF_CALL_IDS.length === 0 || STAFF_CALL_IDS.includes(itemId)) {
        try { if (window.ogSound) ogSound.call(); } catch (e) {}
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

async function loadOrders(opts = {}) {
  try {
    const res = await fetch(`/kds/api/orders?station_id=${STATION_ID}`);
    pendingBatches = await res.json();

    // 신규 주문 감지 → 이 스테이션에 실제 새 주문이 생겼을 때만 알림음 재생
    const currentIds = new Set();
    pendingBatches.forEach(b => (b.order_ids || []).forEach(id => currentIds.add(id)));
    if (opts.notify && initialLoadDone) {
      let hasNew = false;
      currentIds.forEach(id => { if (!knownOrderIds.has(id)) hasNew = true; });
      if (hasNew) { try { if (window.ogSound) ogSound.notify(); } catch (e) {} }
    }
    knownOrderIds = currentIds;
    initialLoadDone = true;

    // 타이머 기준 시각 기록 (서버 elapsed_seconds + 이후 경과시간으로 계산)
    const loadedAt = Date.now();
    pendingBatches.forEach(b => { b._loadedAt = loadedAt; });

    // 기존에 취소된 항목 상태 재적용
    if (cancelledOrderIds.size > 0) {
      pendingBatches.forEach(batch => {
        batch.items.forEach(item => {
          const cnt = item.order_ids.filter(id => cancelledOrderIds.has(id)).length;
          if (cnt > 0) { item.cancelled = true; item.cancelledQty = cnt; }
        });
        batch.hasCancelledItems = batch.items.some(i => i.cancelled);
      });
      // 완전 취소 배치는 pending에서 제거 (cancelledBatches에 보관 중)
      pendingBatches = pendingBatches.filter(b => !b.items.every(i => i.cancelled));
    }

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

  if (pendingBatches.length === 0 && cancelledBatches.length === 0) {
    board.innerHTML = `
      <div class="kds-empty-state">
        <i class="ph ph-check-circle"></i>
        <p>대기 중인 주문이 없습니다</p>
      </div>`;
    return;
  }

  const pendingHtml = pendingBatches.map(b => renderCard(b)).join('');
  const cancelledHtml = cancelledBatches.map(b => renderCancelledCard(b)).join('');
  board.innerHTML = `<div class="kds-grid">${pendingHtml}${cancelledHtml}</div>`;
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
  // 타이머: 서버 elapsed_seconds + 로드 후 경과시간 (타임존 무관)
  const serverElapsed = batch.elapsed_seconds || 0;
  const loadedAt = batch._loadedAt || Date.now();
  const elapsed = isDone ? serverElapsed : serverElapsed + Math.floor((Date.now() - loadedAt) / 1000);
  const urgencyClass = isDone ? 'done-card' : getUrgencyClass(elapsed);
  const elapsedText = formatElapsed(elapsed);

  const orderedDate = new Date(batch.ordered_at);
  const orderedTimeText = `${String(orderedDate.getHours()).padStart(2, '0')}:${String(orderedDate.getMinutes()).padStart(2, '0')}`;

  const itemsHtml = batch.items.map(item => {
    const optionsHtml = item.options.length > 0
      ? `<div class="card-item-options">${item.options.map(o => `<span class="card-option-tag">${escHtml(o)}</span>`).join('')}</div>`
      : '';

    if (item.cancelled) {
      return `
        <div>
          <div class="card-item cancelled-item">
            <span class="card-item-name">${escHtml(item.menu_name)}</span>
            <span class="card-item-qty">x${item.cancelledQty || item.quantity}</span>
            <span class="item-cancel-badge">취소</span>
          </div>
          ${optionsHtml}
        </div>`;
    }

    if (isDone) {
      return `
        <div>
          <div class="card-item">
            <span class="card-item-name">${escHtml(item.menu_name)}</span>
            <span class="card-item-qty">x${item.quantity}</span>
          </div>
          ${optionsHtml}
        </div>`;
    }

    // 개별 완료 여부 확인
    const itemKey = item.order_ids.join(',');
    const isItemDone = doneItemOrderIds.has(itemKey);

    return `
      <div>
        <div class="card-item${isItemDone ? ' item-done' : ''}">
          <span class="card-item-name">${escHtml(item.menu_name)}</span>
          <span class="card-item-qty">x${item.quantity}</span>
          <button class="btn-item-complete${isItemDone ? ' checked' : ''}"
            onclick="event.stopPropagation(); toggleItemDone('${itemKey}')"
            title="${isItemDone ? '완료 취소' : '이 메뉴 완료'}">
            <i class="ph ph-check"></i>
          </button>
        </div>
        ${optionsHtml}
      </div>`;
  }).join('');

  const footerHtml = isDone
    ? `<div class="card-footer"><button class="btn-complete" disabled><i class="ph ph-check"></i> 완료됨</button></div>`
    : `<div class="card-footer"><button class="btn-complete" onclick="completeBatch(${JSON.stringify(batch.order_ids)})"><i class="ph ph-check"></i> 완료처리</button></div>`;

  const cancelledClass = (!isDone && batch.hasCancelledItems) ? ' has-cancelled' : '';

  return `
    <div class="order-card ${urgencyClass}${cancelledClass}" data-batch-key="${escHtml(batch.batch_key)}">
      <div class="card-top">
        <span class="card-table-name">${escHtml(batch.table_name)}</span>
        <div class="card-time-info">
          <span class="card-ordered-time">${orderedTimeText}</span>
          <span class="card-elapsed"
            data-server-elapsed="${serverElapsed}"
            data-loaded-at="${loadedAt}">${elapsedText}</span>
        </div>
      </div>
      <div class="card-items">${itemsHtml}</div>
      ${footerHtml}
    </div>`;
}

// ── 개별 메뉴 완료 토글 ───────────────────────────────────────────────────

function toggleItemDone(itemKey) {
  if (doneItemOrderIds.has(itemKey)) {
    doneItemOrderIds.delete(itemKey);
  } else {
    doneItemOrderIds.add(itemKey);
  }
  renderPendingBoard();
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
      try { if (window.ogSound) ogSound.complete(); } catch (e) {}
      // 즉시 UI에서 해당 배치 제거
      pendingBatches = pendingBatches.filter(b => !orderIds.some(id => b.order_ids.includes(id)));
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

// ── 취소 카드 렌더 및 닫기 ───────────────────────────────────────────────

function renderCancelledCard(batch) {
  const orderedDate = new Date(batch.ordered_at);
  const orderedTimeText = `${String(orderedDate.getHours()).padStart(2, '0')}:${String(orderedDate.getMinutes()).padStart(2, '0')}`;

  const itemsHtml = batch.items.map(item => {
    const optionsHtml = item.options && item.options.length > 0
      ? `<div class="card-item-options">${item.options.map(o => `<span class="card-option-tag">${escHtml(o)}</span>`).join('')}</div>`
      : '';
    return `
      <div>
        <div class="card-item cancelled-item">
          <span class="card-item-name">${escHtml(item.menu_name)}</span>
          <span class="card-item-qty">x${item.quantity}</span>
          <span class="item-cancel-badge">취소</span>
        </div>
        ${optionsHtml}
      </div>`;
  }).join('');

  return `
    <div class="order-card has-cancelled cancelled-card" data-batch-key="${escHtml(batch.batch_key)}">
      <div class="card-top">
        <span class="card-table-name">${escHtml(batch.table_name)}</span>
        <div class="card-time-info">
          <span class="card-ordered-time">${orderedTimeText}</span>
        </div>
      </div>
      <div class="card-items">${itemsHtml}</div>
      <div class="card-footer">
        <button class="btn-complete btn-cancel-confirm" onclick="dismissCancelledBatch('${escHtml(batch.batch_key)}')">
          <i class="ph ph-check"></i> 확인
        </button>
      </div>
    </div>`;
}

function dismissCancelledBatch(batchKey) {
  cancelledBatches = cancelledBatches.filter(b => b.batch_key !== batchKey);
  renderPendingBoard();
}

// ── 카운트 뱃지 업데이트 ──────────────────────────────────────────────────

function updateCounts() {
  const pendingEl = document.getElementById('pendingCount');
  const doneEl = document.getElementById('doneCount');
  if (pendingEl) pendingEl.textContent = `대기 ${pendingBatches.length}건`;
  if (doneEl) doneEl.textContent = `완료 ${doneBatches.length}건`;
}

// ── 경과 시간 실시간 갱신 (1초마다) ──────────────────────────────────────

function updateElapsed() {
  const now = Date.now();
  document.querySelectorAll('.card-elapsed[data-server-elapsed]').forEach(el => {
    const serverElapsed = parseInt(el.dataset.serverElapsed || '0');
    const loadedAt = parseInt(el.dataset.loadedAt || now);
    const elapsed = serverElapsed + Math.floor((now - loadedAt) / 1000);
    el.textContent = formatElapsed(elapsed);

    const card = el.closest('.order-card');
    if (card && !card.classList.contains('done-card') && !card.classList.contains('cancelled-card')) {
      card.classList.remove('warning', 'urgent');
      const cls = getUrgencyClass(elapsed);
      if (cls) card.classList.add(cls);
    }
  });
}

function formatElapsed(seconds) {
  if (seconds < 0) seconds = 0;
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) {                       // 1시간 미만 → 분 초
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}분 ${s}초` : `${m}분`;
  }
  if (seconds < 86400) {                       // 1일 미만 → 시간 분
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  }
  const d = Math.floor(seconds / 86400);       // 1일 이상 → 일 시간
  const h = Math.floor((seconds % 86400) / 3600);
  return h > 0 ? `${d}일 ${h}시간` : `${d}일`;
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
