let _currentItem = null; // 현재 열려 있는 상세 결제 항목

window.addEventListener('DOMContentLoaded', () => {
  // 오늘 날짜로 date picker 초기화
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  document.querySelector('#date-picker').value = `${yyyy}-${mm}-${dd}`;

  fetchPaymentHistory();
});

// ─── 결제 내역 조회 ────────────────────────────────────────────────────────────

function fetchPaymentHistory() {
  const date = document.querySelector('#date-picker').value;
  const filter = document.querySelector('#filter-select').value;
  const sort = document.querySelector('#sort-select').value;

  _showLoading(true);

  fetch(`/store/get_payment_history?date=${date}&filter=${filter}&sort=${sort}`)
    .then(r => r.json())
    .then(data => {
      _renderSummary(data.summary);
      _renderList(data.list, date);
    })
    .catch(() => {
      _showLoading(false);
      alert('결제 내역을 불러오는 중 오류가 발생했습니다.');
    });
}

function _showLoading(show) {
  const loading = document.querySelector('.table_loading');
  const noData = document.querySelector('.no_data');
  loading.style.display = show ? 'flex' : 'none';
  noData.style.display = 'none';
  // 기존 데이터 행 제거
  if (show) {
    document.querySelectorAll('.payment_list li.table_row').forEach(el => el.remove());
  }
}

function _renderSummary(summary) {
  document.querySelector('#summary-count').textContent =
    `${summary.total_count}건 (결제 ${summary.paid_count}건 / 취소 ${summary.cancelled_count}건)`;
  document.querySelector('#summary-paid').textContent =
    `${summary.total_paid.toLocaleString()}원`;
  document.querySelector('#summary-cancelled').textContent =
    `${summary.total_cancelled.toLocaleString()}원`;
}

function _renderList(list, date) {
  _showLoading(false);
  const ul = document.querySelector('.payment_list');

  if (!list || list.length === 0) {
    document.querySelector('.no_data').style.display = 'flex';
    return;
  }

  list.forEach(item => {
    const methodSet = [...new Set(item.payments.map(p => p.method))].join(', ');
    const allCancelled = item.payments.length > 0 && item.payments.every(p => p.status === 2);
    const statusClass = allCancelled ? 'cancelled' : (item.has_cancelled ? 'partial' : 'paid');
    const statusText = allCancelled ? '취소' : (item.has_cancelled ? '부분취소' : '결제완료');

    const li = document.createElement('li');
    li.className = 'table_row';
    li.dataset.id = item.id;
    li.innerHTML = `
      <div>${item.payment_time}</div>
      <div>${item.table_name}</div>
      <div class="order-summary-cell ellipsis">${_getOrderSummary(item.order_items)}</div>
      <div>${methodSet}</div>
      <div class="amount">${item.total_paid.toLocaleString()}원</div>
      <div><span class="status_badge ${statusClass}">${statusText}</span></div>
    `;
    li.addEventListener('click', () => _openDetailModal(item, date));
    ul.appendChild(li);
  });
}

function _getOrderSummary(orderItems) {
  if (!orderItems || orderItems.length === 0) return '-';
  const names = orderItems.map(i => i.name);
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} 외 ${names.length - 2}개`;
}

// ─── 상세 모달 ─────────────────────────────────────────────────────────────────

function _openDetailModal(item, date) {
  _currentItem = item;
  const modal = document.querySelector('#payment-detail-modal');
  modal.classList.remove('hidden');

  // 기본 정보
  document.querySelector('#detail-table-name').textContent = item.table_name;
  document.querySelector('#detail-first-order').textContent =
    item.first_order_time ? `${date} ${item.first_order_time}` : '-';
  document.querySelector('#detail-payment-time').textContent =
    item.payment_time ? `${date} ${item.payment_time}` : '-';

  // 주문 내역
  const orderListEl = document.querySelector('#detail-order-list');
  orderListEl.innerHTML = '';

  if (item.order_items && item.order_items.length > 0) {
    item.order_items.forEach(oi => {
      const itemTotal = oi.price * oi.count;
      const li = document.createElement('li');
      li.innerHTML = `<span>${oi.name}${oi.count > 1 ? ` × ${oi.count}` : ''}</span><span>${itemTotal.toLocaleString()}원</span>`;
      orderListEl.appendChild(li);

      (oi.options || []).forEach(opt => {
        const optLi = document.createElement('li');
        optLi.className = 'option_row';
        const optTotal = opt.price * opt.count;
        optLi.innerHTML = `<span>└ ${opt.name}${opt.count > 1 ? ` × ${opt.count}` : ''}</span><span>${optTotal.toLocaleString()}원</span>`;
        orderListEl.appendChild(optLi);
      });
    });
  } else {
    orderListEl.innerHTML = '<li style="color:#AAA;justify-content:center;">주문 내역 정보 없음</li>';
  }

  // 할인/추가 금액
  const discountRow = document.querySelector('#detail-discount-row');
  const extraRow = document.querySelector('#detail-extra-row');
  if (item.discount > 0) {
    discountRow.style.display = 'flex';
    document.querySelector('#detail-discount').textContent = `-${item.discount.toLocaleString()}원`;
  } else {
    discountRow.style.display = 'none';
  }
  if (item.extra_charge > 0) {
    extraRow.style.display = 'flex';
    document.querySelector('#detail-extra').textContent = `+${item.extra_charge.toLocaleString()}원`;
  } else {
    extraRow.style.display = 'none';
  }

  // 결제 수단별 내역
  const paymentListEl = document.querySelector('#detail-payment-list');
  paymentListEl.innerHTML = '';
  item.payments.forEach(p => {
    const isCancelled = p.status === 2;
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${p.method}</span>
      <div class="pay-right">
        <span>${p.amount.toLocaleString()}원</span>
        <span class="status_badge ${isCancelled ? 'cancelled' : 'paid'}">${isCancelled ? '취소' : '완료'}</span>
      </div>
    `;
    paymentListEl.appendChild(li);
  });

  // 합계
  document.querySelector('#detail-total').textContent = `${item.total_paid.toLocaleString()}원`;

  // 취소 버튼 상태
  const cancelBtn = document.querySelector('#detail-cancel-btn');
  const allCancelled = item.payments.length > 0 && item.payments.every(p => p.status === 2);
  cancelBtn.disabled = allCancelled;
  cancelBtn.textContent = allCancelled ? '취소 완료' : '결제 취소';
}

function closeDetailModal() {
  document.querySelector('#payment-detail-modal').classList.add('hidden');
  _currentItem = null;
}

// ─── 결제 취소 ─────────────────────────────────────────────────────────────────

async function cancelPayment() {
  if (!_currentItem) return;

  const hasCard = _currentItem.payments.some(p => p.method_id === 2 && p.status !== 2);
  let confirmMsg = '이 결제를 취소 처리하시겠습니까?';
  if (hasCard) {
    confirmMsg += '\n\n⚠️ 카드 결제가 포함되어 있습니다.\nDB 취소 처리 후 Toss 단말기에서 카드 승인 취소를 별도로 진행해주세요.';
  }
  if (!confirm(confirmMsg)) return;

  const cancelBtn = document.querySelector('#detail-cancel-btn');
  cancelBtn.disabled = true;
  cancelBtn.textContent = '취소 처리 중...';

  try {
    const res = await fetch('/store/cancel_payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_list_id: _currentItem.id }),
    });
    const data = await res.json();

    if (res.ok) {
      alert(data.message);
      closeDetailModal();
      fetchPaymentHistory();
    } else {
      alert(data.error || '취소 처리에 실패했습니다.');
      cancelBtn.disabled = false;
      cancelBtn.textContent = '결제 취소';
    }
  } catch (e) {
    alert('네트워크 오류가 발생했습니다.');
    cancelBtn.disabled = false;
    cancelBtn.textContent = '결제 취소';
  }
}
