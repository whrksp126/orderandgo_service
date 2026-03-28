let order_history = undefined;
let payment_history = undefined;

// 현재 진행 중인 카드 결제 정보
let _currentCardPayment = null; // { payment_id, store_id }
// 승인 완료 후 확정 대기 중인 결제 정보
let _pendingApproval = null; // { payment_id, table_id, result }

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
    const _cashBtn = document.querySelector('.cash_btn');
    if (_cashBtn) { _cashBtn.disabled = false; _cashBtn.style.opacity = ''; }

    const result = data.result;
    if (result.type !== 'SUCCESS') {
      alert(`결제가 완료되지 않았습니다. (${result.type}${result.error ? ': ' + result.error : ''})`);
      return;
    }

    const isCash = result.response?.paymentMethod === 'CASH';

    if (isCash) {
      // 현금 결제 — 확정/취소 모달 없이 바로 DB 저장
      const paymentData = setPayment(1); // CASH
      // 현금영수증 결과 저장 (발급 여부 + 승인번호 등)
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
(function _startTerminalStatusPoll() {
  const poll = () => {
    fetch('/pos/toss/terminal_online')
      .then(r => r.json())
      .then(d => _setTerminalBadge(d.online))
      .catch(() => _setTerminalBadge(false));
  };
  poll();
  setInterval(poll, 3000);
})();

function _setTerminalBadge(online) {
  const badge = document.querySelector('.card_btn .terminal-badge');
  if (!badge) return;
  badge.className = `terminal-badge ${online ? 'online' : 'offline'}`;
  badge.title = online ? '단말기 연결됨' : '단말기 연결 안됨';
}

function _openCardPaymentModal(paymentId, storeId) {
  _currentCardPayment = { payment_id: paymentId, store_id: storeId };

  // 기존 모달이 있으면 제거
  document.querySelector('#card-payment-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'card-payment-modal';
  modal.innerHTML = `
    <div class="card-modal-overlay">
      <div class="card-modal-box">
        <div class="card-modal-icon">💳</div>
        <h2>카드 결제 진행 중</h2>
        <p class="terminal-status-msg">단말기에 주문 전송 중...</p>
        <button class="card-modal-cancel-btn" onclick="clickCancelCardPayment()">결제 취소</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function _closeCardPaymentModal() {
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

  const _cardBtn = document.querySelector('.card_btn');
  if (_cardBtn) { _cardBtn.disabled = false; _cardBtn.style.opacity = ''; }
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
    const completeBtn = document.querySelector('.modal .bottom button[onclick="clickCashPaymentCompleted(event)"]')
      || document.getElementById('terminal-cash-confirm-btn');
    if (completeBtn && !completeBtn.textContent.includes('처리 중') && !completeBtn.textContent.includes('결제 중')) {
      completeBtn.disabled = change < 0;
    }
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

function _openCashReceiptQueryModal(onConfirm, onCancel) {
  openModalFun({ preventDefault: () => {} });

  const _modal = document.querySelector('.modal');
  const _modalTitle = document.querySelector('.modal-content h1');
  const _modalBody = document.querySelector('.modal-content .modal-body');

  _modalTitle.innerHTML = '현금영수증 발급';

  let selectedType = '';

  _modalBody.innerHTML = `
    <div class="top">
      <div class="content" style="flex-direction:column;gap:15px;">
        <div class="tab_btns">
          <button class="cr-type-btn active" data-type="">단말기 입력</button>
          <button class="cr-type-btn" data-type="CONSUMER">소득공제</button>
          <button class="cr-type-btn" data-type="BUSINESS">지출증빙</button>
        </div>
        <div id="cr-number-area" style="display:none;">
          <input id="cr-number-input" type="text" placeholder="휴대폰번호 또는 사업자번호 (숫자만)"
            style="width:100%;padding:12px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;" />
        </div>
        <p id="cr-hint" style="font-size:13px;color:#888;margin:0;">미입력 시 단말기에서 고객이 직접 선택합니다.</p>
      </div>
    </div>
    <div class="bottom">
      <button id="cr-confirm-btn">결제 시작</button>
    </div>
  `;

  // 탭 버튼 스타일
  _modalBody.querySelectorAll('.cr-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _modalBody.querySelectorAll('.cr-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedType = btn.dataset.type;
      const numberArea = document.getElementById('cr-number-area');
      const hint = document.getElementById('cr-hint');
      if (selectedType) {
        numberArea.style.display = 'block';
        hint.style.display = 'none';
        document.getElementById('cr-number-input').placeholder =
          selectedType === 'CONSUMER' ? '휴대폰번호 (숫자만)' : '사업자번호 (숫자만)';
      } else {
        numberArea.style.display = 'none';
        hint.style.display = 'block';
        document.getElementById('cr-number-input').value = '';
      }
    });
  });

  // X 닫기 버튼 → cancel
  _modal.querySelector('.close')?.addEventListener('click', () => {
    _modal.remove();
    onCancel();
  }, { once: true });

  // 배경 클릭 → cancel
  _modal.addEventListener('click', (e) => {
    if (e.target === _modal) onCancel();
  }, { once: true });

  document.getElementById('cr-confirm-btn').addEventListener('click', () => {
    const identityNumber = document.getElementById('cr-number-input')?.value.trim().replace(/[^0-9]/g, '') || '';
    if (selectedType && !identityNumber) {
      alert('현금영수증 번호를 입력해주세요.');
      return;
    }
    _modal.remove();
    onConfirm(identityNumber || null, selectedType || null);
  });
}

function _openTerminalCashModal(paymentId) {
  _currentCardPayment = { payment_id: paymentId };

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
      <div class="cash_receipt_section">
        <label>
          <input type="checkbox" id="cash-receipt-checkbox" />
          현금영수증 발급
        </label>
        <div id="cash-receipt-detail" style="display:none;">
          <div class="tab_btns">
            <button class="cr-type-btn active" data-type="">단말기에서 입력</button>
            <button class="cr-type-btn" data-type="CONSUMER">소득공제</button>
            <button class="cr-type-btn" data-type="BUSINESS">지출증빙</button>
          </div>
          <div id="cr-number-area" style="display:none;margin-top:10px;">
            <input id="cr-number-input" type="text" placeholder="휴대폰번호 또는 사업자번호 (숫자만)"
              style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;" />
          </div>
          <p id="cr-hint" style="font-size:12px;color:#888;margin:6px 0 0;">미입력 시 단말기에서 고객이 직접 선택합니다.</p>
        </div>
      </div>
    </div>
    <div class="bottom">
      <button id="terminal-cash-confirm-btn" onclick="_confirmTerminalCashPayment('${paymentId}')" disabled>결제 완료</button>
    </div>
  `;

  // 현금영수증 체크박스
  document.getElementById('cash-receipt-checkbox').addEventListener('change', (e) => {
    document.getElementById('cash-receipt-detail').style.display = e.target.checked ? 'block' : 'none';
  });

  // 탭 버튼
  _modalBody.querySelectorAll('.cr-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _modalBody.querySelectorAll('.cr-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const selectedType = btn.dataset.type;
      const numberArea = document.getElementById('cr-number-area');
      const hint = document.getElementById('cr-hint');
      if (selectedType) {
        numberArea.style.display = 'block';
        hint.style.display = 'none';
        document.getElementById('cr-number-input').placeholder =
          selectedType === 'CONSUMER' ? '휴대폰번호 (숫자만)' : '사업자번호 (숫자만)';
      } else {
        numberArea.style.display = 'none';
        hint.style.display = 'block';
        const inp = document.getElementById('cr-number-input');
        if (inp) inp.value = '';
      }
    });
  });

  // X 닫기 → 결제 취소
  _modal.querySelector('.close')?.addEventListener('click', () => {
    clickCancelCashPayment();
  }, { once: true });
}

function _closeCashPaymentModal() {
  document.querySelector('#cash-payment-modal')?.remove();
  const _modal = document.querySelector('#modal.modal');
  if (_modal && _modal.querySelector('#terminal-cash-confirm-btn')) {
    _modal.remove();
  }
}

async function _confirmTerminalCashPayment(paymentId) {
  const btn = document.getElementById('terminal-cash-confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = '처리 중...'; }

  let identityNumber = null;
  let issuerType = null;

  const receiptChecked = document.getElementById('cash-receipt-checkbox')?.checked;
  if (receiptChecked) {
    const activeTab = document.querySelector('#modal .cr-type-btn.active');
    issuerType = activeTab?.dataset.type || null;
    if (issuerType) {
      const numberInput = document.getElementById('cr-number-input');
      identityNumber = numberInput?.value.trim().replace(/[^0-9]/g, '') || null;
      if (!identityNumber) {
        alert('현금영수증 번호를 입력해주세요.');
        if (btn) { btn.disabled = false; btn.textContent = '결제 완료'; }
        return;
      }
    }
  }

  try {
    await fetch('/pos/toss/cash_ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: paymentId, identity_number: identityNumber, issuer_type: issuerType }),
    });
    if (btn) { btn.textContent = '단말기에서 결제 중...'; }
  } catch (e) {
    alert('오류가 발생했습니다. 다시 시도해주세요.');
    if (btn) { btn.disabled = false; btn.textContent = '결제 완료'; }
  }
}

function clickCancelCashPayment() {
  if (!_currentCardPayment) return;
  fetch('/pos/toss/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: _currentCardPayment.payment_id }),
  }).catch(() => {});
  _closeCashPaymentModal();
  _currentCardPayment = null;
  const _cashBtn = document.querySelector('.cash_btn');
  if (_cashBtn) { _cashBtn.disabled = false; _cashBtn.style.opacity = ''; }
}

// 현금 결제 클릭 시
const clickCashPayment = async (event) => {
  const isTerminalOnline = document.querySelector('.terminal-badge')?.classList.contains('online');

  if (isTerminalOnline) {
    // ── 단말기 경유 현금 결제 — 카드 결제와 동일하게 바로 전송 ──
    const _cashBtn = event.currentTarget;
    _cashBtn.disabled = true;
    _cashBtn.style.opacity = '0.5';

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

    const orderData = {
      items: orderItems,
      discounts: payment_history.discount > 0
        ? [{ label: '할인', value: payment_history.discount }]
        : [],
      summary: { totalAmount: totalPrice, discountAmount: payment_history.discount || 0 },
    };

    try {
      const response = await fetch('/pos/toss/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: lastPath,
          order: orderData,
          tax: tax,
          supply_value: supplyValue,
          payment_key: `ORD_${Date.now()}_${lastPath}`,
          payment_type: 'cash',
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        alert(resData.msg || '현금 결제 요청 중 오류가 발생했습니다.');
        _cashBtn.disabled = false;
        _cashBtn.style.opacity = '';
        return;
      }

      _openTerminalCashModal(resData.payment_id);
    } catch (e) {
      alert('현금 결제 요청 중 오류가 발생했습니다.');
      _cashBtn.disabled = false;
      _cashBtn.style.opacity = '';
    }

    return; // 단말기 결제 모드 → 기존 POS 모달 열지 않음
  }

  // ── 단말기 오프라인 → 기존 POS 자체 현금 결제 모달 ──
  openModalFun(event)
  const _modal = document.querySelector('.modal');
  const _modalTitle = document.querySelector('.modal-content h1');
  const _modalBody = document.querySelector('.modal-content .modal-body');
  console.log('payment_history,',)
  const totalPrice = payment_history.orderTotalPrice + payment_history.extra_charge;
  const receivedTotalPrice = payment_history.payment.reduce((accumulator, item) => accumulator + item.price, 0);

  const dicountPercent = (payment_history.discount / totalPrice) * 100
  console.log(totalPrice, payment_history.discount, dicountPercent)

  _modalTitle.innerHTML = '현금 결제'
  const _curPrice = payment_history.curPaymentPrice;
  let html = `
    <div class="top ">
      <div class="content cash" data-total="${_curPrice}" data-type="cash">
        <div class="receive_amount">
          <h3>받을 금액</h3>
          <span>${_curPrice.toLocaleString()}원</span>
        </div>
        <div class="direct_content">
          <div class="payment_amount">
            <h3>받은 금액</h3>
            <input class="direct_input" type="text" oninput="updatePaymentAmount(event)" style="display:none"/>
            <span class="direct_input" style="display:none">원</span>
            <input class="percent_input" type="text" oninput="updatePaymentAmount(event)" style="display:none"/>
            <span class="percent_input" style="display:none">%</span>
            <input class="won_input" type="text" oninput="updatePaymentAmount(event)" style="display:none"/>
            <span class="won_input" style="display:none">원</span>
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
      <button onclick="clickCashPaymentCompleted(event)" disabled>결제 완료</button>
    </div>
  `
  _modalBody.innerHTML = html;
}

// 현금 결제 완료 클릭 시
const clickCashPaymentCompleted = (event) => {
  // 결제 데이터 db 에 통신
  const price = Number(document.querySelector('.modal input.cash_input').value.replace(/,/g, ''));
  const type = 1 // CASH

  const data = setPayment(type);
  data.payment.price = data.payment.price < price ? data.payment.price : price
  const onSuccess = (data) => {
    console.log(data);
    if (data.is_finished) {
      document.querySelector('.modal').remove()
      createCompletedPaymentModal(event, 'CASH');
    } else {
      location.reload();
    }
  }
  fetchData(`/pos/payment_history/${lastPath}`, 'POST', data, onSuccess)

  // 성공 모달 알림
  // createCompletedPaymentModal(event, 'CASH');
}

const clickCardPayment = async (event) => { // 카드 결제 클릭 시 (토스 단말기 연동)
  const totalPrice = payment_history.curPaymentPrice;
  const tax = Math.round(totalPrice / 11);
  const supplyValue = totalPrice - tax;

  // 버튼 비활성화 (중복 클릭 방지)
  const _cardBtn = event.currentTarget;
  _cardBtn.disabled = true;
  _cardBtn.style.opacity = '0.5';

  // 단말기에 표시할 주문 데이터 구성 (sdk.template.renderOrderPage 포맷)
  const orderItems = order_history.map(item => {
    const entry = {
      label: item.name,
      value: item.price * item.count,
    };
    if (item.count > 1) entry.quantity = item.count;
    if (item.options && item.options.length > 0) {
      entry.options = item.options.map(opt => ({
        type: 'option',
        label: opt.name,
        value: opt.price * opt.count,
      }));
    }
    return entry;
  });

  const orderData = {
    items: orderItems,
    discounts: payment_history.discount > 0
      ? [{ label: '할인', value: payment_history.discount }]
      : [],
    summary: {
      totalAmount: totalPrice,
      discountAmount: payment_history.discount || 0,
    },
  };

  try {
    const response = await fetch('/pos/toss/pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_id: lastPath,
        order: orderData,
        tax: tax,
        supply_value: supplyValue,
        payment_key: `ORD_${Date.now()}_${lastPath}`,
      }),
    });

    const resData = await response.json();

    if (!response.ok) {
      alert(resData.msg || '결제 요청 중 오류가 발생했습니다.');
      _cardBtn.disabled = false;
      _cardBtn.style.opacity = '';
      return;
    }

    // 결제 대기 모달 표시 (취소 버튼 포함)
    _openCardPaymentModal(resData.payment_id, resData.store_id);
  } catch (e) {
    alert('결제 요청 중 오류가 발생했습니다.');
    _cardBtn.disabled = false;
    _cardBtn.style.opacity = '';
  }
}


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