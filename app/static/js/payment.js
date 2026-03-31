let order_history = undefined;
let payment_history = undefined;

// 현재 진행 중인 카드 결제 정보
let _currentCardPayment = null; // { payment_id, store_id }
// 승인 완료 후 확정 대기 중인 결제 정보
let _pendingApproval = null; // { payment_id, table_id, result }
// 현금 결제 단말기 payment_id (null = 오프라인)
let _cashPaymentId = null;

// ─── Toss 단말기 소켓 이벤트 ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (typeof socket === 'undefined') return;

  // 결제 결과 수신
  socket.on('toss_payment_result', async (data) => {
    if (String(data.table_id) !== String(lastPath)) return;

    _closeCardPaymentModal();
    _closeCashPaymentModal();
    _currentCardPayment = null;

    const _cardBtn = document.querySelector('.card_btn');
    if (_cardBtn) { _cardBtn.disabled = false; _cardBtn.style.opacity = ''; }

    const result = data.result;
    const isCash = data.payment_type === 'cash' || result.response?.paymentMethod === 'CASH';

    if (result.type !== 'SUCCESS') {
      // 취소/타임아웃 → 단말기가 display 모드로 복귀 중이므로 displayPaymentId 복원
      if (data.payment_id) {
        _displayPaymentId = data.payment_id;
      }
      if (isCash && _cashTablePaymentListId) {
        // 영수증 발급 취소 - 결제는 이미 저장됨
        showToast('현금영수증 발급이 취소되었습니다.', 'info');
        _closeCashReceiptModal();
      } else {
        showToast(`결제가 취소되었습니다.${result.error ? ' (' + result.error + ')' : ''}`, 'info');
      }
      return;
    }

    if (isCash) {
      if (_cashTablePaymentListId) {
        // 영수증 전용 모드: 결제는 이미 저장됨 → 영수증 정보만 업데이트
        if (result.response?.cash) {
          fetch('/pos/payment/update_cash_receipt', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table_payment_list_id: _cashTablePaymentListId,
              cash_receipt: result.response.cash,
            }),
          }).catch(() => {});
        }
        _closeCashReceiptModal();
      } else {
        // 기존 경로 (사전 저장 없이 terminal 결과로 DB 저장)
        const paymentData = setPayment(1);
        if (result.response?.cash) {
          paymentData.payment.payment_history.toss_cash_receipt = result.response.cash;
        }
        fetchData(`/pos/payment_history/${lastPath}`, 'POST', paymentData, (responseData) => {
          if (responseData.is_finished) {
            createCompletedPaymentModal({ preventDefault: () => {} }, 'CASH');
          } else {
            location.reload();
          }
        });
      }
    } else {
      // 카드 결제 — 승인 확정/취소 선택 모달
      _pendingApproval = { payment_id: data.payment_id, table_id: data.table_id, result };
      _openApprovalModal(data.payment_id, result);
    }
  });

  // 승인 취소 결과 수신
  socket.on('toss_cancel_result', (data) => {
    if (String(data.table_id) !== String(lastPath)) return;
    _closeApprovalModal();
    _pendingApproval = null;

    const r = data.result || {};
    if (r.type === 'SUCCESS' || r.type === 'CANCEL_SUCCESS') {
      alert('승인 취소가 완료되었습니다.');
    } else {
      alert(`승인 취소 결과: ${r.type || '알 수 없음'}${r.error ? ' — ' + r.error : ''}`);
    }
  });

  // 단말기 화면 상태 변경 → 모달 업데이트
  socket.on('terminal_status', (data) => {
    const statusMap = {
      'showing_order': '단말기에 주문 표시 중...',
      'processing': '카드 처리 중...',
      'idle': '대기 중',
    };
    const msg = statusMap[data.status] || data.status;
    const el = document.querySelector('#card-payment-modal .terminal-status-msg');
    if (el) el.textContent = msg;
  });

});

// ─── 단말기 온라인 상태 HTTP 폴링 (socket.io 불가 → last_polled_at 기반) ──────
let _terminalOnline = false;
let _cashTablePaymentListId = null;  // 영수증 모달 전 저장된 결제의 tpl_id
let _cashReceiptIsFinished = false;  // 결제 완료 여부 (영수증 처리 후 완료 모달용)

(function _startTerminalStatusPoll() {
  const poll = () => {
    fetch('/pos/toss/terminal_online')
      .then(r => r.json())
      .then(d => { _terminalOnline = !!d.online; })
      .catch(() => { _terminalOnline = false; });
  };
  poll();
  setInterval(poll, 3000);
})();

let _cardPaymentTimer = null;
const _CARD_TIMEOUT_SEC = 15;

function _openCardPaymentModal(paymentId, storeId) {
  _currentCardPayment = { payment_id: paymentId, store_id: storeId };
  document.querySelector('#card-payment-modal')?.remove();
  clearInterval(_cardPaymentTimer);

  const circumference = 2 * Math.PI * 40; // 251.33

  const modal = document.createElement('div');
  modal.id = 'card-payment-modal';
  modal.innerHTML = `
    <div class="card-modal-overlay">
      <div class="card-modal-box">
        <div class="card-timer-wrap">
          <svg class="card-timer-svg" viewBox="0 0 100 100">
            <circle class="card-timer-track" cx="50" cy="50" r="40"/>
            <circle class="card-timer-progress" cx="50" cy="50" r="40"
              style="stroke-dasharray:${circumference};stroke-dashoffset:0"/>
          </svg>
          <span class="card-timer-count">${_CARD_TIMEOUT_SEC}</span>
        </div>
        <h2>카드 결제 진행 중</h2>
        <p class="terminal-status-msg">단말기에 카드를 삽입해주세요</p>
        <p class="card-modal-hint">결제를 취소하려면 단말기에서 직접 뒤로가기를 눌러주세요</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  let remaining = _CARD_TIMEOUT_SEC;
  const progressEl = modal.querySelector('.card-timer-progress');
  const countEl = modal.querySelector('.card-timer-count');

  _cardPaymentTimer = setInterval(() => {
    if (!document.querySelector('#card-payment-modal')) { clearInterval(_cardPaymentTimer); return; }
    remaining--;
    if (remaining < 0) { clearInterval(_cardPaymentTimer); return; }
    countEl.textContent = remaining;
    progressEl.style.strokeDashoffset = circumference * (1 - remaining / _CARD_TIMEOUT_SEC);
  }, 1000);
}

function _closeCardPaymentModal() {
  clearInterval(_cardPaymentTimer);
  _cardPaymentTimer = null;
  document.querySelector('#card-payment-modal')?.remove();
}

function _openApprovalModal(paymentId, result) {
  document.querySelector('#approval-modal')?.remove();

  const resp = result.response || {};
  const approvalNo = resp.card?.approvalNo || resp.approvalNumber || '-';
  const amount = resp.totalAmount != null ? resp.totalAmount.toLocaleString() + '원' : '-';

  const modal = document.createElement('div');
  modal.id = 'approval-modal';
  modal.innerHTML = `
    <div class="card-modal-overlay">
      <div class="card-modal-box">
        <div class="card-modal-icon">✅</div>
        <h2>카드 승인 완료</h2>
        <p style="margin:8px 0;font-size:14px;color:#555;">승인번호: <b>${approvalNo}</b> / ${amount}</p>
        <p class="terminal-status-msg" style="color:#888;font-size:13px;">결제를 확정하거나 승인 취소할 수 있습니다.</p>
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button class="card-modal-cancel-btn" style="flex:1;background:#e74c3c;" onclick="cancelCardApproval()">승인 취소</button>
          <button class="card-modal-cancel-btn" style="flex:1;background:#27ae60;" onclick="confirmCardPayment()">결제 확정</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function _closeApprovalModal() {
  document.querySelector('#approval-modal')?.remove();
}

async function confirmCardPayment() {
  if (!_pendingApproval) return;
  const { payment_id, table_id, result } = _pendingApproval;

  // 서버에 확정 신호 전송
  await fetch('/pos/toss/confirm_approval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id }),
  }).catch(() => {});

  _closeApprovalModal();
  _pendingApproval = null;

  // DB 저장 + 완료 모달
  const paymentData = setPayment(2); // CARD
  if (result.response) {
    paymentData.payment.payment_history.toss_payment_key = result.response.paymentKey || '';
    paymentData.payment.payment_history.toss_approval_no = result.response.card?.approvalNo || result.response.approvalNumber || '';
    paymentData.payment.payment_history.toss_details = result.response;
  }

  fetchData(`/pos/payment_history/${lastPath}`, 'POST', paymentData, (responseData) => {
    if (responseData.is_finished) {
      createCompletedPaymentModal({ preventDefault: () => {} }, 'CARD');
    } else {
      location.reload();
    }
  });
}

async function cancelCardApproval() {
  if (!_pendingApproval) return;
  const { payment_id } = _pendingApproval;

  const btn = document.querySelector('#approval-modal .card-modal-box button[style*="e74c3c"]');
  if (btn) { btn.disabled = true; btn.textContent = '취소 요청 중...'; }

  const res = await fetch('/pos/toss/cancel_approval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id }),
  }).catch(() => null);

  if (!res || !res.ok) {
    alert('승인 취소 요청 실패. 다시 시도해주세요.');
    if (btn) { btn.disabled = false; btn.textContent = '승인 취소'; }
    return;
  }

  // 단말기가 requestPaymentCancel() 실행 → toss_cancel_result 소켓으로 결과 수신
  const statusMsg = document.querySelector('#approval-modal .terminal-status-msg');
  if (statusMsg) statusMsg.textContent = '단말기에서 승인 취소 처리 중...';
}

function clickCancelCardPayment() {
  if (!_currentCardPayment) return;
  fetch('/pos/toss/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: _currentCardPayment.payment_id }),
  }).catch(() => {});
  _closeCardPaymentModal();
  _currentCardPayment = null;

  const _cardBtn2 = document.querySelector('.card_btn');
  if (_cardBtn2) { _cardBtn2.disabled = false; _cardBtn2.style.opacity = ''; }

  // 단말기 화면을 주문 내역 표시로 복귀
  _initDisplayPending();
}
// ─── Display Pending (결제 페이지 진입 시 단말기에 주문 자동 표시) ────────────
let _displayPaymentId = null;

function _buildTerminalOrderData() {
  const totalPrice = payment_history.curPaymentPrice;
  const tax = Math.round(totalPrice / 11);
  const supplyValue = totalPrice - tax;
  const orderItems = order_history.map(item => {
    const entry = { label: item.name, value: item.price * item.count };
    if (item.count > 1) entry.quantity = item.count;
    if (item.options && item.options.length > 0) {
      entry.options = item.options.map(opt => ({
        type: 'option', label: opt.name, value: opt.price * opt.count,
      }));
    }
    return entry;
  });
  // 추가 금액이 있으면 items에 별도 항목으로 추가
  if (payment_history.extra_charge > 0) {
    orderItems.push({ label: '추가 금액', value: payment_history.extra_charge, quantity: 1 });
  }
  const orderData = {
    items: orderItems,
    discounts: payment_history.discount > 0 ? [{ label: '할인', value: payment_history.discount }] : [],
    summary: { totalAmount: totalPrice, discountAmount: payment_history.discount || 0 },
  };
  return { orderData, tax, supplyValue };
}

async function _initDisplayPending() {
  if (_displayPaymentId) return;
  if (!_terminalOnline || !payment_history?.curPaymentPrice) return;
  const { orderData, tax, supplyValue } = _buildTerminalOrderData();
  try {
    const res = await fetch('/pos/toss/pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_id: lastPath,
        order: orderData,
        tax,
        supply_value: supplyValue,
        payment_key: `ORD_${Date.now()}_${lastPath}`,
        payment_type: 'display',
      }),
    });
    if (res.ok) {
      const d = await res.json();
      _displayPaymentId = d.payment_id;
      console.log('[Terminal] Display pending:', _displayPaymentId);
    }
  } catch (e) {}
}

function _updateDisplayPendingOrder() {
  if (!_displayPaymentId || !payment_history?.curPaymentPrice) return;
  const { orderData, tax, supplyValue } = _buildTerminalOrderData();
  fetch('/pos/toss/update_pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: _displayPaymentId, order: orderData, tax, supply_value: supplyValue }),
  }).catch(() => {});
}

// Display pending heartbeat — 5초마다 서버에 alive 신호 (TTL 갱신)
setInterval(() => {
  if (!_displayPaymentId) return;
  fetch('/pos/toss/update_pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: _displayPaymentId }),
  }).catch(() => {});
}, 5000);

// 결제 페이지 이탈 시 모든 활성 pending 취소 → 단말기 대기 화면 복귀
let _unloadCancelDone = false;
function _cancelAllOnUnload() {
  if (_unloadCancelDone) return;
  const ids = [
    _displayPaymentId,
    _currentCardPayment?.payment_id,
    _cashPaymentId,
  ].filter(Boolean);
  if (ids.length === 0) return;
  _unloadCancelDone = true;
  _displayPaymentId = null;
  _currentCardPayment = null;
  _cashPaymentId = null;
  ids.forEach(id => {
    fetch('/pos/toss/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: id }),
      keepalive: true,
    }).catch(() => {});
  });
}
window.addEventListener('pagehide', _cancelAllOnUnload);
window.addEventListener('beforeunload', _cancelAllOnUnload);

// display pending을 카드/현금 결제용으로 전환 (기존 payment_id 반환 후 초기화)
async function _activateDisplayPending(paymentType) {
  if (!_displayPaymentId) return null;
  const id = _displayPaymentId;
  _displayPaymentId = null; // 먼저 초기화해서 pagehide 중복 취소 방지
  const { orderData, tax, supplyValue } = _buildTerminalOrderData();
  try {
    const res = await fetch('/pos/toss/update_pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_id: id,
        payment_type: paymentType,
        order: orderData,
        tax,
        supply_value: supplyValue,
        payment_key: `ORD_${Date.now()}_${lastPath}`,
      }),
    });
    if (!res.ok) return null;
    return id;
  } catch (e) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// 테이블 주문 내역 가져오기
const callOrderHistory = () => {
  const onSuccess = (data) => {
    order_history = data.map((order) => ({
      id: order.id,
      masterName: setMasterName(order),
      name: order.name,
      price: order.price,
      count: 1,
      options: order.options,
    }))
    if (order_history != undefined && payment_history != undefined) paymentHtml();

  }
  fetchData(`/pos/get_table_order_list/${lastPath}`, 'GET', {}, onSuccess)
}
// 결제내역 조회
const callPaymentHistory = () => {
  const onSuccess = (data) => {
    payment_history = data;
    if (order_history != undefined && payment_history != undefined) paymentHtml();
  }
  fetchData(`/pos/payment_history/${lastPath}`, 'GET', {}, onSuccess)
}

// 통신 후 화면 설정
callOrderHistory();
callPaymentHistory();
const paymentHtml = () => {
  const isNotFirst = payment_history.payment.length > 0 ? true : false;
  if (isNotFirst) { // 이미 결제 내역이 있는 경우
    const _otherBtns = document.querySelector('.payment main section article .top .other_btns');
    _otherBtns.classList.add('has_history')
  }

  payment_history.orderTotalPrice = changeBasketHtml(setBasketData(order_history));
  // 결제 페이지 진입 직후 단말기에 주문 내역 자동 표시
  setTimeout(_initDisplayPending, 500);

  let totalPrice = payment_history.orderTotalPrice;
  // 할인 영역 처리
  const _discount = document.querySelector('.payment .basket_container .order_btns span.discount');
  _discount.innerHTML = `${payment_history.discount.toLocaleString()} 원`

  totalPrice -= payment_history.discount;

  // 추가 금액 영역 처리
  if (payment_history.extra_charge > 0) {
    const _basket = document.querySelector('.payment .basket_container .basket');
    _basket.insertAdjacentHTML('beforeend', `
    <li class="addition_data">
      <div data-id="" data-type="" data-count="" data-master="" class="menu" onclick="">
        <div class="count addition"><i class="ph ph-plus"></i></div>
        <h2>추가 금액</h2>
        <span class="price">${payment_history.extra_charge.toLocaleString()} 원</span>
      </div>  
    </li>`)
    totalPrice += payment_history.extra_charge;

  }


  const _totalPrice = document.querySelector('main aside .order_btns .price');
  _totalPrice.innerHTML = `${totalPrice.toLocaleString()} 원`;



  // 분할 결제 영역 처리
  let receivedTotalPrice = 0
  if (payment_history.paid) {
    document.querySelector('.payment main section article .top .other_btns').classList.add('paid')
    const _paid = document.querySelector('.total_price .paid');
    const _remaining = _paid.querySelector('.remaining');
    const _received = _paid.querySelector('.received');

    receivedTotalPrice = payment_history.payment.reduce((accumulator, item) => accumulator + item.price, 0);
    _remaining.innerHTML = `남은 금액 ${(totalPrice - receivedTotalPrice).toLocaleString()}원`;
    _received.innerHTML = `| 받은 금액 ${receivedTotalPrice.toLocaleString()}원`;

  }
  const _sectionTotalPrice = document.querySelector('main section .total_price .price');
  _sectionTotalPrice.innerHTML = `${(totalPrice - receivedTotalPrice).toLocaleString()} 원`;
  setPaymentData();
}

// 금액 추가 버튼 클릭 시
const clickAdditionPrice = (event) => {
  openModalFun(event)
  const _modal = document.querySelector('.modal');
  const _modalTitle = document.querySelector('.modal-content h1');
  const _modalBody = document.querySelector('.modal-content .modal-body');
  _modalTitle.innerHTML = '금액 추가'
  let html = `
  <div class="top ">
    <div class="content addition" data-type="addition" data-total="94000">
      <div class="addition_content">
        <div class="payment_amount">
          <h3>추가 금액</h3>
          <input class="addition_input" type="text" oninput="updatePaymentAmount(event)" value="${payment_history.extra_charge}"/>
          <span class="addition_input">원</span>
        </div>
      </div>
      <div class="split_payment_amount">
          <h3>추가 적용 금액</h3>
          <span>${payment_history.extra_charge}원</span>
        </div>
    </div>
    <div class="number_pad" onclick="clickNumberPad(event)">
      <button data-value="1">1</button>
      <button data-value="2">2</button>
      <button data-value="3">3</button>
      <button data-value="4">4</button>
      <button data-value="5">5</button>
      <button data-value="6">6</button>
      <button data-value="7">7</button>
      <button data-value="8">8</button>
      <button data-value="9">9</button>
      <button data-value="C">C</button>
      <button data-value="0">0</button>
      <button data-value="←">←</button>
    </div>
  </div>
  <div class="bottom">
    <button onclick="clickApplyAddition(event)">적용</button>
  </div>
  `
  _modalBody.innerHTML = html;
  const _input = document.querySelector('.addition_input');
  changePaymentAmount("won", _input);
}

// 금액 추가 적용 클릭 시
const clickApplyAddition = (event) => {
  const _input = document.querySelector('.addition_input');
  const additionPrice = Number(_input.value.replace(/,/g, ''));
  payment_history.extra_charge = additionPrice;
  setPaymentData();
  findParentTarget(event.target, '.modal').click();
}

// 결제 정보 최신화 
const setPaymentData = (curPaymentPrice = false) => {
  // 추가 금액 최신화
  const _additionLi = document.querySelector('.addition_data'); // 추가 금액
  _additionLi?.remove();
  if (payment_history.extra_charge > 0) {
    const _basket = document.querySelector('.payment .basket_container .basket');
    _basket.insertAdjacentHTML('beforeend', `
    <li class="addition_data">
      <div data-id="" data-type="" data-count="" data-master="" class="menu" onclick="">
        <div class="count addition"><i class="ph ph-plus"></i></div>
        <h2>추가 금액</h2>
        <span class="price">${payment_history.extra_charge.toLocaleString()}원</span>
      </div>  
    </li>`)
  }
  // 할인 금액 최신화
  const _discount = document.querySelector('.payment .basket_container .order_btns .discount'); // 할인 금액
  _discount.innerHTML = `${(payment_history.discount).toLocaleString()}원`

  // 총 금액 최신화
  const _totalPrice = document.querySelector('.payment .basket_container .order_btns .price'); // 총 금액
  const totalPrice = payment_history.orderTotalPrice + payment_history.extra_charge - payment_history.discount;
  _totalPrice.innerHTML = `${totalPrice.toLocaleString()}원`

  // 받은 금액 최신화
  const _received = document.querySelector('.payment main section article .top .total_price .paid .received'); // 받은 금액
  const receivedTotalPrice = payment_history.payment.reduce((accumulator, item) => accumulator + item.price, 0);
  if (receivedTotalPrice > 0) {
    _received.innerHTML = `| 받은 금액 ${receivedTotalPrice.toLocaleString()}`
  }

  // 남은 금액 최신화
  const _remaining = document.querySelector('.payment main section article .top .total_price .paid .remaining'); // 남은 금액
  _remaining.innerHTML = `남은 금액 ${(totalPrice - receivedTotalPrice).toLocaleString()}원`


  // 현재 받을 금액 최신화 
  const _currentPrice = document.querySelector('.payment main section article .top .total_price .cur_price > span'); // 현재 결제할 금액
  if (!curPaymentPrice) {
    if (payment_history.payment_history.isDutch) {
      _currentPrice.innerHTML = `${(payment_history.payment_history.dutchPrice).toLocaleString()}원`;
      payment_history.curPaymentPrice = payment_history.payment_history.dutchPrice
    } else {
      _currentPrice.innerHTML = `${(totalPrice - receivedTotalPrice).toLocaleString()}원`;
      payment_history.curPaymentPrice = totalPrice - receivedTotalPrice
    }
  } else {

    _currentPrice.innerHTML = `${curPaymentPrice.toLocaleString()}원`;
    payment_history.curPaymentPrice = curPaymentPrice
  };

  // 더치 페이 최신화
  const _curTotalPrice = document.querySelector('.payment main section article .top .total_price');
  if (payment_history.payment_history.totalDutch > 1) {
    const _curDutch = document.querySelector('.payment main section article .top .total_price .cur_price > .dutch');
    _curTotalPrice.classList.add('dutch');
    _curDutch.innerHTML = `${payment_history.payment_history.curDutch}/${payment_history.payment_history.totalDutch}`
  } else {
    console.log('여기')
    _curTotalPrice.classList.remove('dutch');
  }
  console.log(payment_history.payment_history)
  console.log(payment_history.payment_history.totalDutch)
  console.log(payment_history.payment_history.curDutch)

  // 할인/추가금액 변경 시 단말기 display pending 금액 동기화
  _updateDisplayPendingOrder();
}



// 할인 버튼 클릭 시
const clickDiscount = (event) => {
  openModalFun(event)
  const _modal = document.querySelector('.modal');
  const _modalTitle = document.querySelector('.modal-content h1');
  const _modalBody = document.querySelector('.modal-content .modal-body');

  const totalPrice = payment_history.orderTotalPrice + payment_history.extra_charge;
  const receivedTotalPrice = payment_history.payment.reduce((accumulator, item) => accumulator + item.price, 0);

  const dicountPercent = (payment_history.discount / totalPrice) * 100
  console.log(totalPrice, payment_history.discount, dicountPercent)
  _modalTitle.innerHTML = '할인'
  let html = `
  <div class="top ">
    <div class="content won" data-type="won" data-total="${(totalPrice - receivedTotalPrice).toLocaleString()}">
      <div class="tab_btns">
        <button class="won_btn" onclick="clickWonBtn(event)">원</button>
        <button class="percent_btn" onclick="clickPercentBtn(event)">%</button>
      </div>
      <div class="receive_amount">
        <h3>받을 금액</h3>
        <span>${(totalPrice - receivedTotalPrice).toLocaleString()}원</span>
      </div>
      <div class="won_content">
        <div class="payment_amount">
          <h3>할인 금액</h3>
          <input class="percent_input" value="${dicountPercent.toFixed(0)}" type="text" oninput="updatePaymentAmount(event)" />
          <span class="percent_input">%</span>
          <input class="won_input" value="${payment_history.discount.toLocaleString()}" type="text" oninput="updatePaymentAmount(event)" />
          <span class="won_input">원</span>
          <input class="cash_input" type="text" oninput="updatePaymentAmount(event)" />
          <span class="cash_input">원</span>
        </div>
        <div class="percent_num_btns">
          <button onclick="clickDiscountPercent(event, 10)">10%</button>
          <button onclick="clickDiscountPercent(event, 20)">20%</button>
          <button onclick="clickDiscountPercent(event, 30)">30%</button>
          <button onclick="clickDiscountPercent(event, 50)">50%</button>
        </div>
      </div>
      <div class="split_payment_amount">
          <h3>할인 적용 금액</h3>
          <span class="won">${(totalPrice - payment_history.discount).toLocaleString()}원</span>
          <span class="percent">${(totalPrice - payment_history.discount).toLocaleString()}원</span>
        </div>
    </div>
    <div class="number_pad" onclick="clickNumberPad(event)">
      <button data-value="1">1</button>
      <button data-value="2">2</button>
      <button data-value="3">3</button>
      <button data-value="4">4</button>
      <button data-value="5">5</button>
      <button data-value="6">6</button>
      <button data-value="7">7</button>
      <button data-value="8">8</button>
      <button data-value="9">9</button>
      <button data-value="C">C</button>
      <button data-value="0">0</button>
      <button data-value="←">←</button>
    </div>
  </div>
  <div class="bottom">
    <button onclick="clickApplyDiscount(event)">적용</button>
  </div>
  `
  _modalBody.innerHTML = html;

  const _input = document.querySelector('.won_input');
  changePaymentAmount("won", _input)

}

// 분할 결제 클릭 시
const clickSplitPayment = (event) => {
  const isDirect = payment_history.payment_history.isDirect;
  const direct = payment_history.payment_history.direct;
  const isDutch = payment_history.payment_history.isDutch;
  const totalDutch = payment_history.payment_history.totalDutch;
  console.log(isDirect, isDutch)

  openModalFun(event)
  const _modal = document.querySelector('.modal');
  const _modalTitle = document.querySelector('.modal-content h1');
  const _modalBody = document.querySelector('.modal-content .modal-body');

  const totalPrice = payment_history.orderTotalPrice + payment_history.extra_charge - payment_history.discount;
  const receivedTotalPrice = payment_history.payment.reduce((accumulator, item) => accumulator + item.price, 0);


  _modalTitle.innerHTML = '분할 결제'
  let html = `
    <div class="top ">
      <div class="content ${isDutch ? `dutch` : `direct`} " data-total="${(totalPrice - receivedTotalPrice).toLocaleString()}" data-type="${isDutch ? `dutch` : `direct`}">
        <div class="tab_btns">
          <button class="direct_btn" onclick="clickDirectBtn(event)">직접 입력</button>
          <button class="dutch_btn" onclick="clickDutchBtn(event)">더치 페이</button>
        </div>
        <div class="receive_amount" data-price="${totalPrice - receivedTotalPrice}">
            <h3>받을 금액</h3>
            <span>${(totalPrice - receivedTotalPrice).toLocaleString()}원</span>
          </div>
        <div class="dutch_content">
          <div class="count_btns">
            <button onclick="clickMinusCountBtn(event)"><i class="ph ph-minus"></i></button>
            <span>${isDutch ? `${totalDutch}` : `1`}</span>
            <button onclick="clickPlusCountBtn(event)"><i class="ph ph-plus"></i></button>
          </div>
        </div>
        <div class="direct_content">
          <div class="payment_amount">
            <h3>결제 금액</h3>
            <input class="direct_input" value="${isDirect ? `${direct.toLocaleString()}` : `0`}" type="text" oninput="updatePaymentAmount(event)"/>
            <span class="direct_input">원</span>
          </div>
        </div>
        <div class="split_payment_amount">
            <h3>분할 결제 금액</h3>
            <span class="direct">${direct.toLocaleString()}원</span>
            <span class="dutch" data-price="${((totalPrice - receivedTotalPrice) / totalDutch).toFixed(0)}">
              ${Number(((totalPrice - receivedTotalPrice) / totalDutch).toFixed(0)).toLocaleString()}원 x ${totalDutch}
            </span>
          </div>
      </div>
      <div class="number_pad" onclick="clickNumberPad(event)">
        <button data-value="1">1</button>
        <button data-value="2">2</button>
        <button data-value="3">3</button>
        <button data-value="4">4</button>
        <button data-value="5">5</button>
        <button data-value="6">6</button>
        <button data-value="7">7</button>
        <button data-value="8">8</button>
        <button data-value="9">9</button>
        <button data-value="C">C</button>
        <button data-value="0">0</button>
        <button data-value="←">←</button>
      </div>
    </div>
    <div class="bottom">
      <button onclick="clickSaveSplitPayment(event)">적용</button>
    </div>
  `
  _modalBody.innerHTML = html;

  const _input = document.querySelector('.direct_input');
  changePaymentAmount("direct", _input)
}

// 할인 적용 버튼 클릭 시
const clickApplyDiscount = (event) => {
  const _modal = findParentTarget(event.target, '.modal');
  const type = _modal.querySelector('.content').dataset.type;
  const discount = Number(_modal.querySelector('.won_input').value.replace(/,/g, ''));
  if (type == 'won') {
    payment_history.discount = discount;
    setPaymentData();
    _modal.click();
  }
  if (type == 'percent') {
    setPaymentData();
    _modal.click();
  }
}

// 분할 결제 적용 버튼 클릭 시
const clickSaveSplitPayment = (event) => {
  const _modal = findParentTarget(event.target, '.modal');
  const type = _modal.querySelector('.content').dataset.type;
  if (type == 'direct') { // 금액 입력
    const price = Number(_modal.querySelector('.direct_input').value.replace(/,/g, ''));
    payment_history.payment_history.direct = price;
    payment_history.payment_history.isDutch = false;
    payment_history.payment_history.curDutch = 1;
    payment_history.payment_history.totalDutch = 0;
    if (price > 0) {
      payment_history.payment_history.isDirect = true;
      document.querySelector('.payment main section article .top .other_btns').classList.add('paid');
    } else {
      payment_history.payment_history.isDirect = false;
      document.querySelector('.payment main section article .top .other_btns').classList.remove('paid');
    }
    setPaymentData(price);
  }

  if (type == 'dutch') { // 더치 페이
    const dutch = Number(document.querySelector('.count_btns span').textContent);
    payment_history.payment_history.totalDutch = dutch;
    if (dutch <= 1) {
      payment_history.payment_history.isDutch = false;
      payment_history.payment_history.curDutch = 1;
      document.querySelector('.payment main section article .top .other_btns').classList.remove('paid');
      setPaymentData()

    } else {
      payment_history.payment_history.isDutch = true;
      document.querySelector('.payment main section article .top .other_btns').classList.add('paid');
      setPaymentData(payment_history.payment_history.dutchPrice)
    }

  }
  _modal.click();


}

// 직접 입력 버튼 클릭 시
const clickDirectBtn = (event) => {
  const _modalLeftEl = document.querySelector('.payment .modal-content .modal-body .top .content');
  _modalLeftEl.classList.remove('dutch')
  _modalLeftEl.classList.add('direct')
  _modalLeftEl.dataset.type = 'direct'
}

// 더치 페이 버튼 클릭 시
const clickDutchBtn = (event) => {

  const _modalLeftEl = document.querySelector('.payment .modal-content .modal-body .top .content');
  _modalLeftEl.classList.remove('direct')
  _modalLeftEl.classList.add('dutch')
  _modalLeftEl.dataset.type = 'dutch'
}

// 할인 퍼센트 버튼 클릭 시
const clickDiscountPercent = (event, num) => {
  const _modalLeftEl = document.querySelector('.payment .modal-content .modal-body .top .content');
  const curType = _modalLeftEl.dataset.type;
  const total = Number(_modalLeftEl.dataset.total.replace(/,/g, ''));
  const _input = document.querySelector(`.payment .modal-content .modal-body .top .content.${curType} .payment_amount input.${curType}_input`);

  _input.value = Math.min(num, 100);
  const discount = (num / 100) * total;
  payment_history.discount = discount;
  document.querySelector('.split_payment_amount span.percent').innerHTML = `${(total - discount).toLocaleString()}원`
  changePaymentAmount(curType, _input)

}

// 숫자 패드 클릭 시
const clickNumberPad = (event) => {
  const _modalLeftEl = document.querySelector('.payment .modal-content .modal-body .top .content');
  const curType = _modalLeftEl.dataset.type;
  const total = Number(_modalLeftEl.dataset.total.replace(/,/g, ''));
  const target = event.target;
  const targetValue = target.dataset.value;
  if (['direct', 'won', 'percent', 'cash', 'addition'].includes(curType)) { // 직접 입력 
    const _input = document.querySelector(`.payment .modal-content .modal-body .top .content.${curType} .payment_amount input.${curType}_input`);
    const value = _input.value.replace(/,/g, '');

    if (targetValue == undefined) return;
    _input.focus();
    if (targetValue == '←') {
      _input.value = setReplaceNumberPad(value.slice(0, -1));
    }
    if (targetValue == 'C') {
      _input.value = '';
    }
    if (targetValue != '←' && targetValue != 'C') {
      if (curType != 'cash' && curType != 'addition') {
        _input.value = Math.min(Number(setReplaceNumberPad(Number(value) + targetValue)
          .replace(/,/g, '')), total)
          .toLocaleString();


      } else {
        _input.value = Number(setReplaceNumberPad(value + targetValue).replace(/,/g, '')).toLocaleString();

      }
    }
    if (curType == 'direct') { // 할인 원

      document.querySelector('.split_payment_amount span').innerHTML = `${_input.value}원`
    }
    if (curType == 'percent') { // 할인 페선트
      _input.value = Math.min(Number(_input.value.replace(/,/g, '')), 100);
      const discount = (Number(_input.value) / 100) * total;
      payment_history.discount = discount;
      document.querySelector('.split_payment_amount span.percent').innerHTML = `${(total - discount).toLocaleString()}원`
    }
    changePaymentAmount(curType, _input)

    if (curType == 'won') {
      document.querySelector('.split_payment_amount span.won').innerHTML = `${(total - _input.value.replace(/,/g, '')).toLocaleString()}원`
    }
  }
  if (curType == 'dutch') { // 더치 페이
    const _input = document.querySelector('.payment .modal-content .modal-body .top .content .dutch_content .count_btns span');
    const value = _input.innerText;

    if (targetValue == undefined) return;
    _input.focus();


    if (value == '1' && targetValue != '0' && targetValue != '1' && targetValue != '←' && targetValue != 'C') {
      _input.innerText = targetValue;
    } else {
      if (targetValue == '←') {
        const newValue = setReplaceNumberPad(value.slice(0, -1));
        _input.innerText = newValue === "" ? "1" : newValue;
      }
      if (targetValue == 'C') {
        _input.innerText = '1';
      }
      if (targetValue != '←' && targetValue != 'C') {
        _input.innerText = setReplaceNumberPad(value + targetValue);
      }
    }

    payment_history.payment_history.totalDutch = Number(_input.innerText);
    const _dutch = document.querySelector('.payment .modal-content .modal-body .top .content.dutch .split_payment_amount span.dutch');
    const totalPrice = document.querySelector('.receive_amount').dataset.price;
    payment_history.payment_history.dutchPrice = Number((totalPrice / payment_history.payment_history.totalDutch).toFixed(0))
    _dutch.innerHTML = `${payment_history.payment_history.dutchPrice.toLocaleString()}원 x ${payment_history.payment_history.totalDutch}`
  }


}

// 분할 결제 숫자 패드 클릭 시 입력 값 세팅
const setReplaceNumberPad = (str) => {
  return str.replace(/[^0-9]/g, '').replace(/^0+/, '').replace(/,(\s*)$/, '').toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

// 받을 금액에 입력 값이 변경 될 때
const updatePaymentAmount = (event) => {
  let curValue = event.target.value;
  const _content = findParentTarget(event.target, '.content');
  const type = _content.dataset.type;
  const total = type == 'percent' ? 100 : Number(_content.dataset.total.replace(/,/g, ''));

  if (type != 'cash' && type != 'addition') {
    curValue = String(Math.min(Number(curValue.replace(/,/g, '')), total));
  }
  event.target.value = curValue.replace(/[^0-9]/g, '').toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  changePaymentAmount(type, event.target)
}

// 가격 입력 창에 값 변경될 경우
const changePaymentAmount = (type, input) => {
  if (type == "direct") { }
  if (type == "dutch") { }
  if (type == "won") {

  }
  if (type == "percent") { }
  if (type == "cash") {
    const value = Number(input.value.replace(/,/g, ''));
    const due = payment_history.curPaymentPrice;
    const change = value - due;

    document.querySelector('.cash_amount span').innerHTML = `${value.toLocaleString()}원`;

    const changeEl = document.querySelector('.change_amount span');
    if (change >= 0) {
      changeEl.innerHTML = `${change.toLocaleString()}원`;
      changeEl.style.color = '#27ae60';
    } else {
      changeEl.innerHTML = `부족 ${(-change).toLocaleString()}원`;
      changeEl.style.color = '#e74c3c';
    }

    // 받은 금액이 결제 금액 이상일 때만 결제 완료 버튼 활성화
    const completeBtn = document.getElementById('cash-amount-confirm-btn');
    if (completeBtn) completeBtn.disabled = change < 0;
  }
  // 단위 위치 변경
  const _span = input.nextElementSibling;
  _span.style.left = `${15 + calculateTextWidth(input.value)}px`
}

// 더치 페이 - 클릭 시
const clickMinusCountBtn = (event) => {
  const _input = document.querySelector('.payment .modal-content .modal-body .top .content .dutch_content .count_btns span');
  const value = Number(_input.innerText);
  if (value <= 1) return
  _input.innerText = String(value - 1);
  payment_history.payment_history.totalDutch = value - 1;
  const _dutch = document.querySelector('.payment .modal-content .modal-body .top .content.dutch .split_payment_amount span.dutch');
  const totalPrice = document.querySelector('.receive_amount').dataset.price;
  payment_history.payment_history.dutchPrice = Number((totalPrice / payment_history.payment_history.totalDutch).toFixed(0))
  _dutch.innerHTML = `${payment_history.payment_history.dutchPrice.toLocaleString()}원 x ${payment_history.payment_history.totalDutch}`
}

// 더치 페이 + 클릭 시
const clickPlusCountBtn = (event) => {
  const _input = document.querySelector('.payment .modal-content .modal-body .top .content .dutch_content .count_btns span');
  const value = Number(_input.innerText);
  _input.innerText = String(value + 1);
  payment_history.payment_history.totalDutch = value + 1;
  const _dutch = document.querySelector('.payment .modal-content .modal-body .top .content.dutch .split_payment_amount span.dutch');
  const totalPrice = document.querySelector('.receive_amount').dataset.price;
  payment_history.payment_history.dutchPrice = Number((totalPrice / payment_history.payment_history.totalDutch).toFixed(0))
  _dutch.innerHTML = `${payment_history.payment_history.dutchPrice.toLocaleString()}원 x ${payment_history.payment_history.totalDutch}`

}

// ─── 현금 결제 ────────────────────────────────────────────────────────────────

function _closeCashPaymentModal() {
  document.querySelector('#cash-wait-modal')?.remove();
  _cashPaymentId = null;
  const cashBtn = document.querySelector('.cash_btn');
  if (cashBtn) { cashBtn.disabled = false; cashBtn.style.opacity = ''; }
}

// 현금 결제 클릭 → 금액 입력 모달
const clickCashPayment = async (event) => {
  if (!payment_history?.curPaymentPrice) {
    alert('결제할 금액이 없습니다.');
    return;
  }

  const _cashBtn = event.currentTarget;
  _cashBtn.disabled = true;
  _cashBtn.style.opacity = '0.5';

  _cashPaymentId = null;
  _openCashAmountModal();
};

// 현금 받은 금액 입력 모달
function _openCashAmountModal() {
  openModalFun({ preventDefault: () => {} });
  const _modal = document.querySelector('.modal');
  const _modalTitle = document.querySelector('.modal-content h1');
  const _modalBody = document.querySelector('.modal-content .modal-body');
  const _curPrice = payment_history.curPaymentPrice;

  _modalTitle.innerHTML = '현금 결제';
  _modalBody.innerHTML = `
    <div class="top">
      <div class="content cash" data-total="${_curPrice}" data-type="cash">
        <div class="receive_amount">
          <h3>받을 금액</h3>
          <span>${_curPrice.toLocaleString()}원</span>
        </div>
        <div class="direct_content">
          <div class="payment_amount">
            <h3>받은 금액</h3>
            <input class="cash_input" type="text" value="" oninput="updatePaymentAmount(event)" />
            <span class="cash_input">원</span>
          </div>
        </div>
        <div class="cash_amount">
          <h3>받은 금액</h3>
          <span>0원</span>
        </div>
        <div class="change_amount">
          <h3>거스름돈</h3>
          <span style="color:#e74c3c;">부족 ${_curPrice.toLocaleString()}원</span>
        </div>
      </div>
      <div class="number_pad" onclick="clickNumberPad(event)">
        <button data-value="1">1</button>
        <button data-value="2">2</button>
        <button data-value="3">3</button>
        <button data-value="4">4</button>
        <button data-value="5">5</button>
        <button data-value="6">6</button>
        <button data-value="7">7</button>
        <button data-value="8">8</button>
        <button data-value="9">9</button>
        <button data-value="C">C</button>
        <button data-value="0">0</button>
        <button data-value="←">←</button>
      </div>
    </div>
    <div class="bottom">
      <button id="cash-amount-confirm-btn" onclick="_onCashAmountReady()" disabled>결제 완료</button>
    </div>
  `;

  // X 닫기 → 결제 취소
  _modal.querySelector('.close')?.addEventListener('click', () => {
    _cancelCashPayment();
    _modal.remove();
  }, { once: true });
}

// 금액 확인 후 결제 즉시 저장 → 현금영수증 모달로 이동
function _onCashAmountReady() {
  document.querySelector('#modal.modal')?.remove();
  if (_cashPaymentId) {
    fetch('/pos/toss/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: _cashPaymentId }),
    }).catch(() => {});
    _cashPaymentId = null;
  }
  const paymentData = setPayment(1);
  fetchData(`/pos/payment_history/${lastPath}`, 'POST', paymentData, (responseData) => {
    const cashBtn = document.querySelector('.cash_btn');
    if (cashBtn) { cashBtn.disabled = false; cashBtn.style.opacity = ''; }
    _cashTablePaymentListId = responseData.table_payment_list_id || null;
    _cashReceiptIsFinished = !!responseData.is_finished;
    _openCashReceiptModal();
  });
}

// 현금영수증 여부 선택 모달 (소형)
function _openCashReceiptModal() {
  document.querySelector('#cash-receipt-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'cash-receipt-modal';
  modal.className = 'modal show';
  modal.innerHTML = `
    <div class="modal-content cash-receipt-content">
      <div class="modal-top">
        <h1>현금 영수증 발급</h1>
        <i class="ph-bold ph-x cr-close-icon" onclick="_closeCashReceiptModal()"></i>
      </div>
      <div class="modal-body cash-receipt-body">
        <div class="cr-type-btns">
          <button class="cr-type-btn active" data-type="CONSUMER">개인</button>
          <button class="cr-type-btn" data-type="BUSINESS">사업자</button>
        </div>
        <input id="cr-number-input" type="text" inputmode="numeric"
          placeholder="전화번호 (숫자만)"
          class="cr-number-input" />
        <button id="cr-issue-btn" class="cr-btn cr-btn-issue">발급 신청</button>
        <div class="cr-divider"></div>
        <button id="cr-direct-btn" class="cr-btn cr-btn-direct">단말기에서 직접 입력</button>
        <div class="cr-or">or</div>
        <button id="cr-no-receipt-btn" class="cr-btn cr-btn-no-receipt">발급 안함</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // 타입 탭 선택
  modal.querySelectorAll('.cr-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.cr-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const inp = document.getElementById('cr-number-input');
      inp.placeholder = btn.dataset.type === 'CONSUMER' ? '전화번호 (숫자만)' : '사업자번호 (숫자만)';
    });
  });

  // 발급 안함: 결제는 이미 저장됨 → 그냥 닫기
  document.getElementById('cr-no-receipt-btn').addEventListener('click', () => {
    _closeCashReceiptModal();
  });

  // 직접 입력: identity 없이 terminal 호출
  document.getElementById('cr-direct-btn').addEventListener('click', () => {
    modal.remove();
    _processCashPayment(null, null);
  });

  // 발급 신청: 관리자 입력으로 terminal 처리
  document.getElementById('cr-issue-btn').addEventListener('click', () => {
    const activeBtn = modal.querySelector('.cr-type-btn.active');
    const issuerType = activeBtn?.dataset.type || null;
    const identityNumber = document.getElementById('cr-number-input')?.value.trim().replace(/[^0-9]/g, '') || null;
    if (!issuerType) { showToast('개인 또는 사업자를 선택해주세요.', 'info'); return; }
    if (!identityNumber) { showToast('현금영수증 번호를 입력해주세요.', 'info'); return; }
    modal.remove();
    _processCashPayment(issuerType, identityNumber);
  });

  modal.addEventListener('click', (e) => { if (e.target === modal) _closeCashReceiptModal(); });
}

// 현금영수증 모달 닫기 → 결제 완료 모달 표시 (결제는 이미 저장됨)
function _closeCashReceiptModal() {
  document.querySelector('#cash-receipt-modal')?.remove();
  const isFinished = _cashReceiptIsFinished;
  _cashTablePaymentListId = null;
  _cashReceiptIsFinished = false;
  if (isFinished) {
    createCompletedPaymentModal({ preventDefault: () => {} }, 'CASH');
  } else {
    location.reload();
  }
}

// 현금 결제 취소 (금액 모달 또는 영수증 모달에서)
function _cancelCashPayment() {
  document.querySelector('#cash-receipt-modal')?.remove();
  document.querySelector('#modal.modal')?.remove();
  if (_cashPaymentId) {
    fetch('/pos/toss/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: _cashPaymentId }),
    }).catch(() => {});
    _cashPaymentId = null;
  }
  const cashBtn = document.querySelector('.cash_btn');
  if (cashBtn) { cashBtn.disabled = false; cashBtn.style.opacity = ''; }
}

// 현금 결제 실행 (단말기 경유 or 직접 DB 저장)
async function _processCashPayment(issuerType, identityNumber) {
  const isTerminalOnline = _terminalOnline;

  if (isTerminalOnline) {
    try {
      let paymentId = await _activateDisplayPending('cash');
      if (!paymentId) {
        const { orderData, tax, supplyValue } = _buildTerminalOrderData();
        const res = await fetch('/pos/toss/pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_id: lastPath,
            order: orderData,
            tax,
            supply_value: supplyValue,
            payment_key: `ORD_${Date.now()}_${lastPath}`,
            payment_type: 'cash',
          }),
        });
        const d = await res.json();
        if (!res.ok) {
          alert(d.msg || '현금 결제 요청 중 오류가 발생했습니다.');
          const cashBtn = document.querySelector('.cash_btn');
          if (cashBtn) { cashBtn.disabled = false; cashBtn.style.opacity = ''; }
          return;
        }
        paymentId = d.payment_id;
      }
      _cashPaymentId = paymentId;
      _currentCardPayment = { payment_id: paymentId };

      await fetch('/pos/toss/cash_ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: paymentId, identity_number: identityNumber, issuer_type: issuerType }),
      });

      // 단말기 처리 대기 모달
      document.querySelector('#cash-wait-modal')?.remove();
      const waitModal = document.createElement('div');
      waitModal.id = 'cash-wait-modal';
      waitModal.innerHTML = `
        <div class="card-modal-overlay">
          <div class="card-modal-box">
            <div class="card-modal-icon">💵</div>
            <h2>현금 결제 처리 중</h2>
            <p class="terminal-status-msg">단말기에서 결제 처리 중...</p>
            <button class="card-modal-cancel-btn" onclick="clickCancelCashPayment()">결제 취소</button>
          </div>
        </div>
      `;
      document.body.appendChild(waitModal);
    } catch (e) {
      alert('오류가 발생했습니다. 다시 시도해주세요.');
      _cancelCashPayment();
    }
  } else {
    // 단말기 오프라인 → 결제는 이미 저장됨, 영수증 없이 완료
    _closeCashReceiptModal();
  }
}

// 단말기 현금 결제 취소 (대기 모달에서)
function clickCancelCashPayment() {
  if (!_cashPaymentId) return;
  fetch('/pos/toss/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: _cashPaymentId }),
  }).catch(() => {});
  _closeCashPaymentModal();
}

const clickCardPayment = async (event) => { // 카드 결제 클릭 시 (토스 단말기 연동)
  const _cardBtn = event.currentTarget;
  _cardBtn.disabled = true;
  _cardBtn.style.opacity = '0.5';

  try {
    // display pending이 있으면 card_go 타입으로 전환, 없으면 새로 생성
    let paymentId = await _activateDisplayPending('card_go');

    if (!paymentId) {
      const totalPrice = payment_history.curPaymentPrice;
      const tax = Math.round(totalPrice / 11);
      const supplyValue = totalPrice - tax;
      const { orderData } = _buildTerminalOrderData();
      const response = await fetch('/pos/toss/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: lastPath,
          order: orderData,
          tax,
          supply_value: supplyValue,
          payment_key: `ORD_${Date.now()}_${lastPath}`,
          payment_type: 'card_go',
        }),
      });
      const resData = await response.json();
      if (!response.ok) {
        alert(resData.msg || '결제 요청 중 오류가 발생했습니다.');
        _cardBtn.disabled = false;
        _cardBtn.style.opacity = '';
        return;
      }
      paymentId = resData.payment_id;
    }

    _openCardPaymentModal(paymentId, null);
  } catch (e) {
    alert('결제 요청 중 오류가 발생했습니다.');
    _cardBtn.disabled = false;
    _cardBtn.style.opacity = '';
  }
}


// ─── 결제하기 버튼 → 바로 카드 결제 진행 ───────────────────────────────────

const clickPayment = async (event) => {
  if (!payment_history?.curPaymentPrice) {
    alert('결제할 금액이 없습니다.');
    return;
  }
  clickCardPayment(event);
};


// 결제 성공 모달
const createCompletedPaymentModal = async (event, type) => {
  openModalFun(event)
  const _modal = document.querySelector('.modal');
  const _modalTitle = document.querySelector('.modal-content h1');
  const _modalBody = document.querySelector('.modal-content .modal-body');
  _modal.classList.add('success_payment')
  _modalTitle.innerHTML = ''

  // 영수증 데이터 준비
  const tableId = lastPath;
  const storeInfoResult = await fetchDataAsync(`/pos/get_store_info`, 'GET', {});
  const tableName = document.querySelector('header h1')?.innerText || tableId;

  const orderData = {
    tableName: tableName,
    items: order_history.map(item => ({
      name: item.name,
      price: item.price,
      count: item.count,
      options: item.options
    }))
  };

  const paymentInfo = {
    price: payment_history.curPaymentPrice,
    discount: payment_history.discount,
    extra_charge: payment_history.extra_charge,
    method: type == 'CASH' ? 1 : 2
  };

  const receiptHtml = ReceiptEngine.generateCustomerReceipt(storeInfoResult, orderData, paymentInfo);

  let html = `
    <div class="top ">
      <i class="ph-fill ph-hands-clapping"></i>
      <h2>결제 완료</h2>
      <span>${type == 'CASH' ? `현금` : `카드`} 결제가 완료되었습니다.</span>
    </div>
    <div class="bottom">
      <button class="view_receipt" onclick="openReceiptDetailModal('${type}')">영수증 보기</button>
      <button class="close" onclick="window.location.href='/pos/tableList'">확인</button>
    </div>
  `
  _modalBody.innerHTML = html;
  setPayment(type == 'CASH' ? 1 : 2)
}

// 영수증 상세 모달 열기 브릿지 함수
const openReceiptDetailModal = async (type) => {
  const storeInfoResult = await fetchDataAsync(`/pos/get_store_info`, 'GET', {});
  const tableName = document.querySelector('header h1')?.innerText || lastPath;

  const orderData = {
    tableName: tableName,
    items: order_history.map(item => ({
      name: item.name,
      price: item.price,
      count: item.count,
      options: item.options
    }))
  };

  const paymentInfo = {
    price: payment_history.curPaymentPrice,
    discount: payment_history.discount,
    extra_charge: payment_history.extra_charge,
    method: type == 'CASH' ? 1 : 2
  };

  ReceiptEngine.openReceiptModal(storeInfoResult, orderData, paymentInfo);
}

const setOrderList = () => { // 결제 전 주문 내역 정리
  const items = deepCopy(setBasketData(order_history));
  return order_list = items.map((item) => {
    delete item.data.id;
    item.data.options.forEach((option) => {
      delete option.id
    })
    return item.data
  })
}

const setPayment = (method) => { // 결제 전 데이터 만들기
  const tableId = lastPath;
  const order_list = setOrderList();
  // 이게 맞나?
  // const total_price = payment_history.orderTotalPrice + payment_history.extra_charge;
  const total_price = payment_history.orderTotalPrice + payment_history.extra_charge - payment_history.discount;
  const first_order_time = payment_history.first_order_time;

  const payment = {
    discount: payment_history.discount,
    extra_charge: payment_history.extra_charge,
    method: method,
    price: payment_history.curPaymentPrice,
    payment_history: payment_history.payment_history
  }
  return {
    table_id: tableId,
    payment: payment,
    order_list: order_list,
    total_price: total_price,
    first_order_time: first_order_time

  }
}

const callPayment = (event, type) => { // 결제 요청
  console.log(setPayment(type));
}

// 할인 원 버튼 클릭 시
const clickWonBtn = (event) => {
  const _content = findParentTarget(event.target, '.content ');
  _content.classList.remove('percent');
  _content.classList.add('won');
  _content.dataset.type = 'won';

}
// 할인 퍼센트 버튼 클릭 시
const clickPercentBtn = (event) => {
  const _content = findParentTarget(event.target, '.content ');
  _content.classList.remove('won');
  _content.classList.add('percent');
  _content.dataset.type = 'percent';

  const _input = document.querySelector('.percent_input');
  changePaymentAmount('percent', _input);
}