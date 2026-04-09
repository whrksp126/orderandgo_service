let _currentItem = null; // 현재 열려 있는 상세 결제 항목

// 무한 스크롤 상태
let _currentPage = 1;
let _isLoading = false;
let _hasMore = false;
let _summaryAccum = null; // 누적 요약 (날짜 미지정 모드)

// 단말기 환불 대기 중인 payment id
let _pendingRefundPaymentId = null;

window.addEventListener('DOMContentLoaded', () => {
  // 날짜 기본값 없이 최근 내역 바로 조회
  fetchPaymentHistory();

  // 무한 스크롤: .article_bottom 스크롤 감지
  const articleBottom = document.querySelector('.article_bottom');
  articleBottom.addEventListener('scroll', () => {
    if (_isLoading || !_hasMore) return;
    if (document.querySelector('#date-picker').value) return; // 날짜 지정 시 무한 스크롤 없음

    const el = articleBottom;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 150) {
      _currentPage++;
      fetchPaymentHistory(true);
    }
  });

  // 결제 이력 페이지 전용 소켓 룸 참여 + 환불 결과 수신
  if (typeof socket !== 'undefined' && typeof STORE_ID !== 'undefined' && STORE_ID) {
    socket.emit('store_history_login', { store_id: STORE_ID });

    socket.on('toss_history_cancel_result', async (data) => {
      const r = data.result || {};
      const tpl_id = data.table_payment_list_id || (_currentItem && _currentItem.id);
      const db_payment_id = data.db_payment_id || null;

      // 개별 결제 환불 버튼 찾기 (_pendingRefundPaymentId 또는 db_payment_id 기준)
      const pendingId = _pendingRefundPaymentId || db_payment_id;
      const btn = pendingId
        ? document.querySelector(`.refund-item-btn[data-payment-id="${pendingId}"]`)
        : null;

      const msgEl = document.getElementById('refund-status-msg');
      if (msgEl) msgEl.remove();

      if (r.type === 'SUCCESS' || r.type === 'CANCEL_SUCCESS') {
        // 프론트엔드가 API 호출로 DB 저장 확정
        if (tpl_id) {
          try {
            const body = { table_payment_list_id: tpl_id, result: r };
            if (db_payment_id) body.db_payment_id = db_payment_id;
            await fetch('/store/save_toss_cancel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
          } catch (e) {
            console.error('[CANCEL] save_toss_cancel error:', e);
          }
        }
        _pendingRefundPaymentId = null;
        if (btn) { btn.disabled = true; btn.textContent = '완료'; }
        showToast('환불이 완료되었습니다.', 'success');
        closeDetailModal();
        fetchPaymentHistory();
      } else {
        _pendingRefundPaymentId = null;
        if (btn) { btn.disabled = false; btn.textContent = '환불'; }
        showToast(`환불 실패: ${r.type || '알 수 없음'}${r.error ? ' — ' + r.error : ''}`, 'error');
      }
    });
  }
});

// ─── 결제 내역 조회 ────────────────────────────────────────────────────────────

function fetchPaymentHistory(append = false) {
  if (_isLoading) return;

  if (!append) {
    _currentPage = 1;
    _summaryAccum = null;
  }

  _isLoading = true;
  _showLoading(true, append);

  const date = document.querySelector('#date-picker').value;
  const filter = document.querySelector('#filter-select .btn-dropdown')?.dataset.id ?? 'all';
  const sort = document.querySelector('#sort-select .btn-dropdown')?.dataset.id ?? 'time_desc';

  let url = `/store/get_payment_history?filter=${filter}&sort=${sort}`;
  if (date) {
    url += `&date=${date}`;
  } else {
    url += `&page=${_currentPage}&per_page=20`;
  }

  fetch(url)
    .then(r => r.json())
    .then(data => {
      _renderSummary(data.summary, append);
      _renderList(data.list, append);
      _hasMore = !date && !!data.has_more;
      _isLoading = false;
      _showLoading(false, append);
    })
    .catch(() => {
      _isLoading = false;
      _showLoading(false, append);
      if (!append) alert('결제 내역을 불러오는 중 오류가 발생했습니다.');
    });
}

function _showLoading(show, append = false) {
  const loading = document.querySelector('.table_loading');
  const noData = document.querySelector('.no_data');
  const scrollLoading = document.querySelector('#scroll-loading');

  if (append) {
    if (scrollLoading) scrollLoading.style.display = show ? 'block' : 'none';
  } else {
    loading.style.display = show ? 'flex' : 'none';
    noData.style.display = 'none';
    if (scrollLoading) scrollLoading.style.display = 'none';
    if (show) {
      document.querySelectorAll('.payment_list li.table_row').forEach(el => el.remove());
    }
  }
}

function _renderSummary(summary, append = false) {
  if (!append || !_summaryAccum) {
    _summaryAccum = { ...summary };
  } else {
    _summaryAccum.total_count += summary.total_count;
    _summaryAccum.paid_count += summary.paid_count;
    _summaryAccum.cancelled_count += summary.cancelled_count;
    _summaryAccum.total_paid += summary.total_paid;
    _summaryAccum.total_cancelled += summary.total_cancelled;
  }
  const s = _summaryAccum;
  document.querySelector('#summary-count').textContent =
    `${s.total_count}건 (결제 ${s.paid_count}건 / 취소 ${s.cancelled_count}건)`;
  document.querySelector('#summary-paid').textContent =
    `${s.total_paid.toLocaleString()}원`;
  document.querySelector('#summary-cancelled').textContent =
    `${s.total_cancelled.toLocaleString()}원`;
}

function _renderList(list, append = false) {
  const ul = document.querySelector('.payment_list');

  if (!append && (!list || list.length === 0)) {
    document.querySelector('.no_data').style.display = 'flex';
    return;
  }

  if (!list || list.length === 0) return;

  list.forEach(item => {
    const methodSet = [...new Set(item.payments.map(p => p.method))].join(', ');
    const allCancelled = item.payments.length > 0 && item.payments.every(p => p.status === 2);
    const statusClass = allCancelled ? 'cancelled' : (item.has_cancelled ? 'partial' : 'paid');
    const statusText = allCancelled ? '취소' : (item.has_cancelled ? '부분취소' : '결제완료');
    // 원래 결제 금액 (취소 포함) 표시
    const originalTotal = item.total_paid + item.total_cancelled;

    const li = document.createElement('li');
    li.className = 'table_row';
    li.dataset.id = item.id;
    li.innerHTML = `
      <div>${item.payment_date ? item.payment_date.slice(5) : '-'}</div>
      <div>${item.payment_time}</div>
      <div>${item.table_name}</div>
      <div class="order-summary-cell ellipsis">${_getOrderSummary(item.order_items)}</div>
      <div>${methodSet}</div>
      <div class="amount">${originalTotal.toLocaleString()}원</div>
      <div><span class="status_badge ${statusClass}">${statusText}</span></div>
    `;
    li.addEventListener('click', () => _openDetailModal(item));
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

function _openDetailModal(item) {
  _currentItem = item;
  const modal = document.querySelector('#payment-detail-modal');
  modal.classList.remove('hidden');

  // 기본 정보
  const dateStr = item.payment_date || '';
  document.querySelector('#detail-table-name').textContent = item.table_name;
  document.querySelector('#detail-first-order').textContent =
    item.first_order_time ? `${dateStr} ${item.first_order_time}` : '-';
  document.querySelector('#detail-payment-time').textContent =
    item.payment_time ? `${dateStr} ${item.payment_time}` : '-';

  // 주문 내역
  const orderListEl = document.querySelector('#detail-order-list');
  orderListEl.innerHTML = '';

  if (item.order_items && item.order_items.length > 0) {
    item.order_items.forEach(oi => {
      const itemTotal = oi.price * oi.count;
      const li = document.createElement('li');
      li.innerHTML = `<span>${oi.name} × ${oi.count}</span><span>${itemTotal.toLocaleString()}원</span>`;
      orderListEl.appendChild(li);

      (oi.options || []).forEach(opt => {
        const optLi = document.createElement('li');
        optLi.className = 'option_row';
        const optTotal = opt.price * opt.count;
        optLi.innerHTML = `<span>└ ${opt.name} × ${opt.count}</span><span>${optTotal.toLocaleString()}원</span>`;
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
    const pi = p.payment_info || {};
    const hasToss = !!(pi.toss_details || (pi.toss_payment_key && pi.toss_cash_receipt));
    const li = document.createElement('li');
    li.className = 'payment-item-row';
    li.innerHTML = `
      <div class="pay-item-left">
        <span class="pay-method-name">${p.method}</span>
        <span class="pay-status-label ${isCancelled ? 'cancelled' : 'paid'}">${isCancelled ? '취소' : '완료'}</span>
      </div>
      <div class="pay-item-right">
        <span class="pay-amount-text">${p.amount.toLocaleString()}원</span>
        ${!isCancelled ? `
          <div class="pay-item-actions">
            <button class="btn-item-receipt" title="영수증 출력" data-payment-id="${p.id}">
              <i class="ph ph-printer"></i>
            </button>
            <button class="btn-item-refund refund-item-btn" data-payment-id="${p.id}" data-has-toss="${hasToss}">
              환불
            </button>
          </div>` : ''}
      </div>
    `;
    paymentListEl.appendChild(li);
  });
  paymentListEl.onclick = (e) => {
    const receiptBtn = e.target.closest('.btn-item-receipt');
    if (receiptBtn) {
      const paymentId = parseInt(receiptBtn.dataset.paymentId);
      const payment = _currentItem.payments.find(p => p.id === paymentId);
      if (payment) _openPaymentReceipt(payment);
      return;
    }
    const refundBtn = e.target.closest('.refund-item-btn');
    if (refundBtn) {
      const paymentId = parseInt(refundBtn.dataset.paymentId);
      const hasToss = refundBtn.dataset.hasToss === 'true';
      _processItemRefund(paymentId, hasToss);
    }
  };

  // 합계: 원래 결제 금액 (취소 포함)
  const originalTotal = item.total_paid + item.total_cancelled;
  document.querySelector('#detail-total').textContent = `${originalTotal.toLocaleString()}원`;

  // Toss 결제 상세 정보 표시
  const ph = item.payment_history || {};
  const hasTossCard = !!ph.toss_details;
  const hasTossCash = !!(ph.toss_payment_key && ph.toss_cash_receipt);
  const hasRefund = !!ph.toss_cancel_result || !!ph.cancelled_at;

  const existingTossSection = document.querySelector('#detail-toss-section');
  if (existingTossSection) existingTossSection.remove();

  if (hasTossCard || hasTossCash) {
    const tossSection = document.createElement('div');
    tossSection.id = 'detail-toss-section';
    tossSection.className = 'detail-section';

    let tossHtml = '<h3>단말기 결제 정보</h3>';
    if (hasTossCard) {
      const card = ph.toss_details?.card || {};
      tossHtml += `
        <div class="info-row"><span class="info-label">승인번호</span><span class="info-value">${ph.toss_approval_no || '-'}</span></div>
        ${card.number ? `<div class="info-row"><span class="info-label">카드번호</span><span class="info-value">${card.number}</span></div>` : ''}
      `;
    }
    if (hasTossCash) {
      const receipt = ph.toss_cash_receipt || {};
      tossHtml += `<div class="info-row"><span class="info-label">영수증 승인번호</span><span class="info-value">${receipt.approvalNumber || '-'}</span></div>`;
    }
    if (hasRefund && ph.toss_cancel_time) {
      tossHtml += `
        <div class="info-row"><span class="info-label">환불 시각</span><span class="info-value cancel-color">${ph.toss_cancel_time.slice(0, 19).replace('T', ' ')}</span></div>
      `;
    }
    tossSection.innerHTML = tossHtml;

    const modalActions = document.querySelector('.modal-actions');
    modalActions.parentNode.insertBefore(tossSection, modalActions);
  }

  // 진행 중 메시지 초기화
  const oldMsg = document.getElementById('refund-status-msg');
  if (oldMsg) oldMsg.remove();
}

function closeDetailModal() {
  document.querySelector('#payment-detail-modal').classList.add('hidden');
  _currentItem = null;
}

// ─── 영수증 출력 ────────────────────────────────────────────────────────────────

function _openReceipt() {
  if (!_currentItem) return;
  const item = _currentItem;
  const storeInfo = window.STORE_INFO || {};
  const orderData = { tableName: item.table_name, items: item.order_items };
  const activePay = item.payments.find(p => p.status !== 2);
  const method = activePay && activePay.method.includes('현금') ? 1 : 2;
  const paymentInfo = {
    price: item.total_paid + item.total_cancelled,
    method,
    discount: item.discount || 0,
    extra_charge: item.extra_charge || 0,
  };
  ReceiptEngine.openReceiptModal(storeInfo, orderData, paymentInfo);
}

function _openPaymentReceipt(payment) {
  if (!_currentItem) return;
  const item = _currentItem;
  const storeInfo = window.STORE_INFO || {};
  const orderData = { tableName: item.table_name, items: item.order_items };
  const paymentInfo = {
    price: payment.amount,
    method: payment.method.includes('현금') ? 1 : 2,
  };
  ReceiptEngine.openReceiptModal(storeInfo, orderData, paymentInfo);
}

// ─── 개별 결제 환불 ─────────────────────────────────────────────────────────────

function _processItemRefund(paymentId, hasToss) {
  if (!confirm('이 결제 건만 환불하시겠습니까?')) return;
  const btn = document.querySelector(`.refund-item-btn[data-payment-id="${paymentId}"]`);
  if (hasToss) {
    _processTossItemRefund(paymentId, btn);
  } else {
    _processCashItemRefund(paymentId, btn);
  }
}

async function _processCashItemRefund(paymentId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '처리 중...'; }
  try {
    const res = await fetch('/store/cancel_payment_item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: paymentId }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast('환불이 완료되었습니다.', 'success');
      closeDetailModal();
      fetchPaymentHistory();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = '환불'; }
      alert(data.error || '환불 처리에 실패했습니다.');
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '환불'; }
    alert('네트워크 오류가 발생했습니다.');
  }
}

async function _processTossItemRefund(paymentId, btn) {
  _pendingRefundPaymentId = paymentId;
  if (btn) { btn.disabled = true; btn.textContent = '대기 중...'; }
  try {
    const res = await fetch('/store/cancel_toss_payment_item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: paymentId }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || '환불 요청에 실패했습니다.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '환불'; }
      _pendingRefundPaymentId = null;
      return;
    }
    if (btn) btn.textContent = '처리 중...';
    const actionsEl = document.querySelector('.modal-actions');
    if (actionsEl) {
      const msgEl = document.createElement('p');
      msgEl.id = 'refund-status-msg';
      msgEl.style.cssText = 'color:#888;font-size:13px;margin-top:8px;text-align:center;';
      msgEl.textContent = '단말기에서 환불을 진행해주세요...';
      actionsEl.after(msgEl);
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '환불'; }
    _pendingRefundPaymentId = null;
    alert('네트워크 오류가 발생했습니다.');
  }
}
