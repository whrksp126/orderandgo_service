(function() {

// =============================================
//  셸 HTML (payment.html의 <main> 내부)
// =============================================
var PAYMENT_SHELL = `
  <!-- 장바구니 영역 -->
  <aside class="basket_container">
    <ul class="basket middle"></ul>
    <div class="order_btns bottom">
      <div class="top">
        <div>
          <span>공급가액</span>
          <span class="supply_price">원</span>
        </div>
        <div>
          <span>부가세</span>
          <span class="vat">원</span>
        </div>
        <div>
          <span>할인</span>
          <span class="discount">원</span>
        </div>
      </div>
      <div class="bottom">
        <div>
          <span>총액</span>
          <span class="price">원</span>
        </div>
      </div>
    </div>
  </aside>
  <section>
    <article>
      <div class="top">
        <div class="total_price">
          <h2>결제 금액</h2>
          <div class="cur_price">
            <span class="price">94,000원</span>
            <div class="dutch"></div>
          </div>
          <div class="paid">
            <span class="remaining"></span>
            <span class="received"></span>
          </div>
        </div>
        <div class="other_btns">
          <button class="addtion_btn" onclick="clickAdditionPrice(event)">추가 금액</button>
          <button class="discount_btn" onclick="clickDiscount(event)">할인</button>
          <button onclick="clickSplitPayment(event)">분할 결제</button>
        </div>
      </div>
      <div class="payment_btns">
        <button onclick="clickCashPayment(event)" class="cash_btn">
          현금 결제
        </button>
        <button onclick="clickCardPayment(event)" class="card_btn">
          카드 결제
        </button>
      </div>
    </article>
  </section>
`;

// =============================================
//  로컬 변수 (IIFE 스코프)
// =============================================
var order_history = undefined;
var payment_history = undefined;

var _currentCardPayment = null;
var _cashPaymentId = null;
var _lastSavedPaymentId = null;

var _terminalOnline = false;
var _cashTablePaymentListId = null;
var _cashReceiptIsFinished = false;

var _displayPaymentId = null;
var _cardPaymentTimer = null;
var _CARD_TIMEOUT_SEC = 15;

var _unloadCancelDone = false;
var _cashReceiptCancelPaymentId = null;
var _cashReceiptCancelTimer = null;

var _inactivityTimer = null;
var INACTIVITY_TIMEOUT = 30 * 1000;

// terminal 폴링 interval ID (cleanup 시 clear)
var _terminalPollInterval = null;
var _displayHeartbeatInterval = null;

// ─── 소켓 이벤트 설정 ────────────────────────────────────────────────────────
function _setupPaymentSocketEvents() {
  if (typeof socket === 'undefined') return;

  // 결제 결과 수신
  socket.on('toss_payment_result', async function(data) {
    if (String(data.table_id) !== String(lastPath)) return;

    _closeCardPaymentModal();
    _closeCashPaymentModal();
    _currentCardPayment = null;

    var _cardBtn = document.querySelector('.card_btn');
    if (_cardBtn) { _cardBtn.disabled = false; _cardBtn.style.opacity = ''; }

    var result = data.result;
    var isCash = data.payment_type === 'cash' || (result.response || result)?.paymentMethod === 'CASH';

    if (result.type !== 'SUCCESS') {
      if (data.payment_id) {
        _displayPaymentId = data.payment_id;
      }
      if (isCash && _cashTablePaymentListId) {
        showToast('현금영수증 발급이 취소되었습니다.', 'info');
        _closeCashReceiptModal();
      } else {
        showToast('결제가 취소되었습니다.' + (result.error ? ' (' + result.error + ')' : ''), 'info');
      }
      return;
    }

    if (isCash) {
      var resp = result.response || result || {};
      if (_cashTablePaymentListId) {
        if (resp.cash) {
          fetch('/pos/payment/update_cash_receipt', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table_payment_list_id: _cashTablePaymentListId,
              cash_receipt: resp.cash,
              payment_key: resp.paymentKey || '',
              tax: data.tax || 0,
              supply_value: data.supply_value || 0,
              timestamp: resp.timestamp || '',
              payment_id: data.payment_id,
            }),
          }).catch(function() {});
          _openCashReceiptCancelModal(data.payment_id);
        } else {
          _closeCashReceiptModal();
        }
      } else {
        var paymentData = setPayment(1);
        if (resp.cash) {
          paymentData.payment.payment_history.toss_cash_receipt = resp.cash;
        }
        fetchData('/pos/payment_history/' + lastPath, 'POST', paymentData, function(responseData) {
          if (responseData.payment_id) {
            _lastSavedPaymentId = responseData.payment_id;
          }
          if (responseData.is_finished) {
            createCompletedPaymentModal({ preventDefault: function() {} }, 'CASH', responseData.payment_id || null);
          } else {
            _reloadPaymentView();
          }
        });
      }
    } else {
      var _pData = setPayment(2);
      var _r = result.response || result || {};
      _pData.payment.payment_history.toss_payment_key = _r.paymentKey || data.payment_key || '';
      _pData.payment.payment_history.toss_approval_no = _r.card?.approvalNumber || _r.card?.approvalNo || _r.approvalNumber || '';
      _pData.payment.payment_history.toss_details = _r;
      _pData.payment.payment_history.toss_tax = data.tax || 0;
      _pData.payment.payment_history.toss_supply_value = data.supply_value || 0;
      var _ts = _r.card?.timestamp ?? _r.timestamp;
      _pData.payment.payment_history.toss_timestamp = (typeof _ts === 'number') ? _ts : 0;
      var _saved = await fetch('/pos/payment_history/' + lastPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(_pData),
      }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });

      if (!_saved?.table_payment_list_id) {
        showToast('결제 정보 저장 실패. 관리자에게 문의하세요.', 'error');
      }
      if (_saved?.payment_id) {
        _lastSavedPaymentId = _saved.payment_id;
      }

      await fetch('/pos/toss/confirm_approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: data.payment_id }),
      }).catch(function() {});

      if (_saved?.is_finished) {
        createCompletedPaymentModal({ preventDefault: function() {} }, 'CARD', _saved?.payment_id || null);
      } else {
        _reloadPaymentView();
      }
    }
  });

  socket.on('toss_cancel_result', async function(data) {
    if (String(data.table_id) !== String(lastPath)) return;
    var r = data.result || {};
    if (r.type === 'SUCCESS' || r.type === 'CANCEL_SUCCESS') {
      showToast('환불이 완료되었습니다.', 'success');
      _reloadPaymentView();
    } else {
      showToast('환불 처리 실패. 관리자에게 문의하세요.', 'error');
    }
  });

  socket.on('toss_cash_receipt_cancel_result', function(data) {
    if (String(data.table_id) !== String(lastPath)) return;
    clearInterval(_cashReceiptCancelTimer);
    _cashReceiptCancelPaymentId = null;
    document.querySelector('#cash-receipt-cancel-modal')?.remove();

    var r = data.result || {};
    if (r.type === 'SUCCESS' || r.type === 'CANCEL_SUCCESS') {
      showToast('현금영수증이 취소되었습니다.', 'success');
    } else {
      showToast('현금영수증 취소 실패. 관리자에게 문의하세요.', 'error');
    }
    _cashTablePaymentListId = null;
    _cashReceiptIsFinished = false;
    _reloadPaymentView();
  });

  socket.on('terminal_status', function(data) {
    var statusMap = {
      'showing_order': '단말기에 주문 표시 중...',
      'processing': '카�� 처리 중...',
      'idle': '대기 중',
    };
    var msg = statusMap[data.status] || data.status;
    var el = document.querySelector('#card-payment-modal .terminal-status-msg');
    if (el) el.textContent = msg;
  });
}

// location.reload() 대체 (SPA에서 뷰 재초기화)
function _reloadPaymentView() {
  initPaymentView({ tableId: lastPath });
}

// ─── 단말기 온라인 상태 HTTP 폴링 ────────────────────────────────────��──────
function _startTerminalStatusPoll() {
  var poll = function() {
    fetch('/pos/toss/terminal_online')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var wasOnline = _terminalOnline;
        _terminalOnline = !!d.online;
        if (!wasOnline && _terminalOnline) {
          _initDisplayPending();
        }
      })
      .catch(function() { _terminalOnline = false; });
  };
  poll();
  _terminalPollInterval = setInterval(poll, 3000);
}

// ─── Card Payment Modal ─────────────────────────────────────────────────────
function _openCardPaymentModal(paymentId, storeId) {
  _currentCardPayment = { payment_id: paymentId, store_id: storeId };
  document.querySelector('#card-payment-modal')?.remove();
  clearInterval(_cardPaymentTimer);

  var circumference = 2 * Math.PI * 40;

  var modal = document.createElement('div');
  modal.id = 'card-payment-modal';
  modal.innerHTML = '<div class="card-modal-overlay"><div class="card-modal-box">' +
    '<div class="card-timer-wrap"><svg class="card-timer-svg" viewBox="0 0 100 100">' +
    '<circle class="card-timer-track" cx="50" cy="50" r="40"/>' +
    '<circle class="card-timer-progress" cx="50" cy="50" r="40" style="stroke-dasharray:' + circumference + ';stroke-dashoffset:0"/>' +
    '</svg><span class="card-timer-count">' + _CARD_TIMEOUT_SEC + '</span></div>' +
    '<h2>카드 결제 진행 중</h2>' +
    '<p class="terminal-status-msg">단말기에 카드를 삽입해주세요</p>' +
    '<p class="card-modal-hint">결제를 취소하려면 단말기에서 직접 뒤로가기를 눌러주세요</p>' +
    '</div></div>';
  document.body.appendChild(modal);

  var remaining = _CARD_TIMEOUT_SEC;
  var progressEl = modal.querySelector('.card-timer-progress');
  var countEl = modal.querySelector('.card-timer-count');

  _cardPaymentTimer = setInterval(function() {
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

window.clickCancelCardPayment = function() {
  if (!_currentCardPayment) return;
  fetch('/pos/toss/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: _currentCardPayment.payment_id }),
  }).catch(function() {});
  _closeCardPaymentModal();
  _currentCardPayment = null;

  var _cardBtn2 = document.querySelector('.card_btn');
  if (_cardBtn2) { _cardBtn2.disabled = false; _cardBtn2.style.opacity = ''; }

  _initDisplayPending();
};

// ─── Display Pending ────────────────────────────────────────────────────────
function _buildTerminalOrderData() {
  var totalPrice = payment_history.curPaymentPrice;
  var tax = Math.round(totalPrice / 11);
  var supplyValue = totalPrice - tax;
  var orderItems = setBasketData(order_history).map(function(item) {
    var entry = { label: item.data.name, value: item.data.price * item.length };
    if (item.length > 1) entry.quantity = item.length;
    if (item.data.options && item.data.options.length > 0) {
      entry.options = item.data.options.map(function(opt) {
        var optEntry = {
          type: 'option',
          label: opt.name,
          value: (opt.price || 0) * (opt.count || 1),
        };
        if ((opt.count || 1) > 1) optEntry.quantity = opt.count;
        return optEntry;
      });
    }
    return entry;
  });
  if (payment_history.extra_charge > 0) {
    orderItems.push({ label: '추가 금액', value: payment_history.extra_charge, quantity: 1 });
  }
  var orderData = {
    items: orderItems,
    discounts: payment_history.discount > 0 ? [{ label: '할인', value: payment_history.discount }] : [],
    summary: { totalAmount: totalPrice, discountAmount: payment_history.discount || 0 },
  };
  return { orderData: orderData, tax: tax, supplyValue: supplyValue };
}

async function _initDisplayPending() {
  if (_displayPaymentId) return;
  if (!_terminalOnline || !payment_history?.curPaymentPrice) return;
  var bd = _buildTerminalOrderData();
  try {
    var res = await fetch('/pos/toss/pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_id: lastPath,
        order: bd.orderData,
        tax: bd.tax,
        supply_value: bd.supplyValue,
        payment_key: 'ORD_' + Date.now() + '_' + lastPath,
        payment_type: 'display',
      }),
    });
    if (res.ok) {
      var d = await res.json();
      _displayPaymentId = d.payment_id;
      console.log('[Terminal] Display pending:', _displayPaymentId);
    }
  } catch (e) {}
}

function _updateDisplayPendingOrder() {
  if (!_displayPaymentId || !payment_history?.curPaymentPrice) return;
  var bd = _buildTerminalOrderData();
  fetch('/pos/toss/update_pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: _displayPaymentId, order: bd.orderData, tax: bd.tax, supply_value: bd.supplyValue }),
  }).catch(function() {});
}

// Display pending heartbeat
function _startDisplayHeartbeat() {
  _displayHeartbeatInterval = setInterval(async function() {
    if (!_displayPaymentId) return;
    try {
      var res = await fetch('/pos/toss/update_pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: _displayPaymentId }),
      });
      if (res.status === 404) {
        _displayPaymentId = null;
        await _initDisplayPending();
      }
    } catch (e) {}
  }, 5000);
}

// 결제 페이지 이탈 시 pending 취소
function _cancelAllOnUnload() {
  if (_unloadCancelDone) return;
  var ids = [
    _displayPaymentId,
    _currentCardPayment?.payment_id,
    _cashPaymentId,
  ].filter(Boolean);
  if (ids.length === 0) return;
  _unloadCancelDone = true;
  _displayPaymentId = null;
  _currentCardPayment = null;
  _cashPaymentId = null;
  ids.forEach(function(id) {
    fetch('/pos/toss/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: id }),
      keepalive: true,
    }).catch(function() {});
  });
}

async function _activateDisplayPending(paymentType) {
  if (!_displayPaymentId) return null;
  var id = _displayPaymentId;
  _displayPaymentId = null;
  var bd = _buildTerminalOrderData();
  try {
    var res = await fetch('/pos/toss/update_pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_id: id,
        payment_type: paymentType,
        order: bd.orderData,
        tax: bd.tax,
        supply_value: bd.supplyValue,
        payment_key: 'ORD_' + Date.now() + '_' + lastPath,
      }),
    });
    if (!res.ok) return null;
    return id;
  } catch (e) {
    return null;
  }
}

// ─── 데이터 로드 ────────────────────────────────────────────────────────────
var callOrderHistory = function() {
  var onSuccess = function(data) {
    order_history = data.map(function(order) {
      return {
        id: order.id,
        masterName: setMasterName(order),
        name: order.name,
        price: order.price,
        count: 1,
        options: order.options,
      };
    });
    if (order_history != undefined && payment_history != undefined) paymentHtml();
  };
  fetchData('/pos/get_table_order_list/' + lastPath, 'GET', {}, onSuccess);
};

var callPaymentHistory = function() {
  var onSuccess = function(data) {
    payment_history = data;
    if (order_history != undefined && payment_history != undefined) paymentHtml();
  };
  fetchData('/pos/payment_history/' + lastPath, 'GET', {}, onSuccess);
};

var paymentHtml = function() {
  var isNotFirst = payment_history.payment.length > 0;
  if (isNotFirst) {
    var _otherBtns = document.querySelector('.payment main section article .top .other_btns');
    if (_otherBtns) _otherBtns.classList.add('has_history');
  }

  payment_history.orderTotalPrice = changeBasketHtml(setBasketData(order_history));
  setTimeout(_initDisplayPending, 500);

  var totalPrice = payment_history.orderTotalPrice;
  var _discount = document.querySelector('.payment .basket_container .order_btns span.discount');
  if (_discount) _discount.innerHTML = payment_history.discount.toLocaleString() + ' 원';

  totalPrice -= payment_history.discount;

  if (payment_history.extra_charge > 0) {
    var _basket = document.querySelector('.payment .basket_container .basket');
    if (_basket) {
      _basket.insertAdjacentHTML('beforeend',
        '<li class="addition_data"><div data-id="" data-type="" data-count="" data-master="" class="menu" onclick="">' +
        '<h2>추가 금액</h2><span class="price">' + payment_history.extra_charge.toLocaleString() + ' 원</span></div></li>');
    }
    totalPrice += payment_history.extra_charge;
  }

  var _totalPrice = document.querySelector('main aside .order_btns .price');
  if (_totalPrice) _totalPrice.innerHTML = totalPrice.toLocaleString() + ' 원';

  var receivedTotalPrice = 0;
  if (payment_history.paid) {
    var otherBtns = document.querySelector('.payment main section article .top .other_btns');
    if (otherBtns) otherBtns.classList.add('paid');
    var _paid = document.querySelector('.total_price .paid');
    var _remaining = _paid?.querySelector('.remaining');
    var _received = _paid?.querySelector('.received');

    receivedTotalPrice = payment_history.payment.reduce(function(acc, item) { return acc + item.price; }, 0);
    if (_remaining) _remaining.innerHTML = '남��� 금액 ' + (totalPrice - receivedTotalPrice).toLocaleString() + '원';
    if (_received) _received.innerHTML = '| 받은 금액 ' + receivedTotalPrice.toLocaleString() + '원';
  }
  var _sectionTotalPrice = document.querySelector('main section .total_price .price');
  if (_sectionTotalPrice) _sectionTotalPrice.innerHTML = (totalPrice - receivedTotalPrice).toLocaleString() + ' 원';
  setPaymentData();
  _initDisplayPending();
};

// ─── 금액 추가 ──────────────────────────────────────────────────────────────
window.clickAdditionPrice = function(event) {
  openModalFun(event);
  var _modalTitle = document.querySelector('.modal-content h1');
  var _modalBody = document.querySelector('.modal-content .modal-body');
  _modalTitle.innerHTML = '금액 추가';
  var html = '<div class="top "><div class="content addition" data-type="addition" data-total="94000">' +
    '<div class="addition_content"><div class="payment_amount"><h3>추가 금액</h3>' +
    '<input class="addition_input" type="text" oninput="updatePaymentAmount(event)" value="' + payment_history.extra_charge + '"/>' +
    '<span class="addition_input">원</span></div></div>' +
    '<div class="split_payment_amount"><h3>추가 적용 금액</h3><span>' + payment_history.extra_charge + '원</span></div></div>' +
    '<div class="number_pad" onclick="clickNumberPad(event)">' +
    '<button data-value="1">1</button><button data-value="2">2</button><button data-value="3">3</button>' +
    '<button data-value="4">4</button><button data-value="5">5</button><button data-value="6">6</button>' +
    '<button data-value="7">7</button><button data-value="8">8</button><button data-value="9">9</button>' +
    '<button data-value="C">C</button><button data-value="0">0</button><button data-value="←">←</button>' +
    '</div></div><div class="bottom"><button onclick="clickApplyAddition(event)">적용</button></div>';
  _modalBody.innerHTML = html;
  var _input = document.querySelector('.addition_input');
  changePaymentAmount("won", _input);
};

window.clickApplyAddition = function(event) {
  var _input = document.querySelector('.addition_input');
  var additionPrice = Number(_input.value.replace(/,/g, ''));
  payment_history.extra_charge = additionPrice;
  setPaymentData();
  findParentTarget(event.target, '.modal').click();
};

// ─── 결제 정보 최신화 ───────────────────────────────────────────────────────
var setPaymentData = function(curPaymentPrice) {
  var _additionLi = document.querySelector('.addition_data');
  if (_additionLi) _additionLi.remove();
  if (payment_history.extra_charge > 0) {
    var _basket = document.querySelector('.payment .basket_container .basket');
    if (_basket) {
      _basket.insertAdjacentHTML('beforeend',
        '<li class="addition_data"><div data-id="" data-type="" data-count="" data-master="" class="menu" onclick="">' +
        '<h2>추가 금액</h2><span class="price">' + payment_history.extra_charge.toLocaleString() + '원</span></div></li>');
    }
  }
  var _discountEl = document.querySelector('.payment .basket_container .order_btns .discount');
  if (_discountEl) _discountEl.innerHTML = (payment_history.discount).toLocaleString() + '원';

  var _totalPriceEl = document.querySelector('.payment .basket_container .order_btns .price');
  var totalPrice = payment_history.orderTotalPrice + payment_history.extra_charge - payment_history.discount;
  if (_totalPriceEl) _totalPriceEl.innerHTML = totalPrice.toLocaleString() + '원';

  var _received = document.querySelector('.payment main section article .top .total_price .paid .received');
  var receivedTotalPrice = payment_history.payment.reduce(function(acc, item) { return acc + item.price; }, 0);
  if (receivedTotalPrice > 0 && _received) {
    _received.innerHTML = '| 받은 금액 ' + receivedTotalPrice.toLocaleString();
  }

  var _remaining = document.querySelector('.payment main section article .top .total_price .paid .remaining');
  if (_remaining) _remaining.innerHTML = '남은 금액 ' + (totalPrice - receivedTotalPrice).toLocaleString() + '원';

  var _currentPrice = document.querySelector('.payment main section article .top .total_price .cur_price > span');
  if (!curPaymentPrice) {
    if (payment_history.payment_history.isDutch) {
      if (_currentPrice) _currentPrice.innerHTML = (payment_history.payment_history.dutchPrice).toLocaleString() + '원';
      payment_history.curPaymentPrice = payment_history.payment_history.dutchPrice;
    } else if (payment_history.payment_history.isDirect && payment_history.payment_history.direct > 0) {
      var _rem = totalPrice - receivedTotalPrice;
      var _directAmt = Math.min(payment_history.payment_history.direct, _rem);
      if (_currentPrice) _currentPrice.innerHTML = _directAmt.toLocaleString() + '원';
      payment_history.curPaymentPrice = _directAmt;
    } else {
      if (_currentPrice) _currentPrice.innerHTML = (totalPrice - receivedTotalPrice).toLocaleString() + '원';
      payment_history.curPaymentPrice = totalPrice - receivedTotalPrice;
    }
  } else {
    if (_currentPrice) _currentPrice.innerHTML = curPaymentPrice.toLocaleString() + '원';
    payment_history.curPaymentPrice = curPaymentPrice;
  }

  var _curTotalPrice = document.querySelector('.payment main section article .top .total_price');
  if (payment_history.payment_history.totalDutch > 1) {
    var _curDutch = document.querySelector('.payment main section article .top .total_price .cur_price > .dutch');
    if (_curTotalPrice) _curTotalPrice.classList.add('dutch');
    if (_curDutch) _curDutch.innerHTML = payment_history.payment_history.curDutch + '/' + payment_history.payment_history.totalDutch;
  } else {
    if (_curTotalPrice) _curTotalPrice.classList.remove('dutch');
  }

  _updateDisplayPendingOrder();
};

// ─── 할��� ───────────────────────────────────────────────────────────────────
window.clickDiscount = function(event) {
  openModalFun(event);
  var _modalTitle = document.querySelector('.modal-content h1');
  var _modalBody = document.querySelector('.modal-content .modal-body');

  var totalPrice = payment_history.orderTotalPrice + payment_history.extra_charge;
  var receivedTotalPrice = payment_history.payment.reduce(function(acc, item) { return acc + item.price; }, 0);

  var dicountPercent = (payment_history.discount / totalPrice) * 100;
  _modalTitle.innerHTML = '할인';
  var html = '<div class="top "><div class="content won" data-type="won" data-total="' + (totalPrice - receivedTotalPrice).toLocaleString() + '">' +
    '<div class="tab_btns"><button class="won_btn" onclick="clickWonBtn(event)">원</button>' +
    '<button class="percent_btn" onclick="clickPercentBtn(event)">%</button></div>' +
    '<div class="receive_amount"><h3>받을 금액</h3><span>' + (totalPrice - receivedTotalPrice).toLocaleString() + '원</span></div>' +
    '<div class="won_content"><div class="payment_amount"><h3>할인 금액</h3>' +
    '<input class="percent_input" value="' + dicountPercent.toFixed(0) + '" type="text" oninput="updatePaymentAmount(event)" /><span class="percent_input">%</span>' +
    '<input class="won_input" value="' + payment_history.discount.toLocaleString() + '" type="text" oninput="updatePaymentAmount(event)" /><span class="won_input">원</span>' +
    '<input class="cash_input" type="text" oninput="updatePaymentAmount(event)" /><span class="cash_input">원</span></div>' +
    '<div class="percent_num_btns"><button onclick="clickDiscountPercent(event, 10)">10%</button>' +
    '<button onclick="clickDiscountPercent(event, 20)">20%</button><button onclick="clickDiscountPercent(event, 30)">30%</button>' +
    '<button onclick="clickDiscountPercent(event, 50)">50%</button></div></div>' +
    '<div class="split_payment_amount"><h3>할인 적용 금액</h3>' +
    '<span class="won">' + (totalPrice - payment_history.discount).toLocaleString() + '원</span>' +
    '<span class="percent">' + (totalPrice - payment_history.discount).toLocaleString() + '원</span></div></div>' +
    '<div class="number_pad" onclick="clickNumberPad(event)">' +
    '<button data-value="1">1</button><button data-value="2">2</button><button data-value="3">3</button>' +
    '<button data-value="4">4</button><button data-value="5">5</button><button data-value="6">6</button>' +
    '<button data-value="7">7</button><button data-value="8">8</button><button data-value="9">9</button>' +
    '<button data-value="C">C</button><button data-value="0">0</button><button data-value="←">←</button>' +
    '</div></div><div class="bottom"><button onclick="clickApplyDiscount(event)">적용</button></div>';
  _modalBody.innerHTML = html;

  var _input = document.querySelector('.won_input');
  changePaymentAmount("won", _input);
};

// ─── 분할 결제 ──────────────────────────────────────────────────────────────
window.clickSplitPayment = function(event) {
  var isDirect = payment_history.payment_history.isDirect;
  var direct = payment_history.payment_history.direct;
  var isDutch = payment_history.payment_history.isDutch;
  var totalDutch = payment_history.payment_history.totalDutch;

  openModalFun(event);
  var _modalTitle = document.querySelector('.modal-content h1');
  var _modalBody = document.querySelector('.modal-content .modal-body');

  var totalPrice = payment_history.orderTotalPrice + payment_history.extra_charge - payment_history.discount;
  var receivedTotalPrice = payment_history.payment.reduce(function(acc, item) { return acc + item.price; }, 0);

  _modalTitle.innerHTML = '분할 결제';
  var html = '<div class="top "><div class="content ' + (isDutch ? 'dutch' : 'direct') + ' " data-total="' + (totalPrice - receivedTotalPrice).toLocaleString() + '" data-type="' + (isDutch ? 'dutch' : 'direct') + '">' +
    '<div class="tab_btns"><button class="direct_btn" onclick="clickDirectBtn(event)">직접 입력</button>' +
    '<button class="dutch_btn" onclick="clickDutchBtn(event)">더치 페이</button></div>' +
    '<div class="receive_amount" data-price="' + (totalPrice - receivedTotalPrice) + '"><h3>받을 금액</h3>' +
    '<span>' + (totalPrice - receivedTotalPrice).toLocaleString() + '원</span></div>' +
    '<div class="dutch_content"><div class="count_btns"><button onclick="clickMinusCountBtn(event)"><i class="ph ph-minus"></i></button>' +
    '<span>' + (isDutch ? totalDutch : '1') + '</span><button onclick="clickPlusCountBtn(event)"><i class="ph ph-plus"></i></button></div></div>' +
    '<div class="direct_content"><div class="payment_amount"><h3>결제 금액</h3>' +
    '<input class="direct_input" value="' + (isDirect ? direct.toLocaleString() : '0') + '" type="text" oninput="updatePaymentAmount(event)"/>' +
    '<span class="direct_input">원</span></div></div>' +
    '<div class="split_payment_amount"><h3>분할 결제 금액</h3><span class="direct">' + direct.toLocaleString() + '원</span>' +
    '<span class="dutch" data-price="' + ((totalPrice - receivedTotalPrice) / totalDutch).toFixed(0) + '">' +
    Number(((totalPrice - receivedTotalPrice) / totalDutch).toFixed(0)).toLocaleString() + '원 x ' + totalDutch + '</span></div></div>' +
    '<div class="number_pad" onclick="clickNumberPad(event)">' +
    '<button data-value="1">1</button><button data-value="2">2</button><button data-value="3">3</button>' +
    '<button data-value="4">4</button><button data-value="5">5</button><button data-value="6">6</button>' +
    '<button data-value="7">7</button><button data-value="8">8</button><button data-value="9">9</button>' +
    '<button data-value="C">C</button><button data-value="0">0</button><button data-value="←">←</button>' +
    '</div></div><div class="bottom"><button onclick="clickSaveSplitPayment(event)">적용</button></div>';
  _modalBody.innerHTML = html;

  var _input = document.querySelector('.direct_input');
  changePaymentAmount("direct", _input);
};

window.clickApplyDiscount = function(event) {
  var _modal = findParentTarget(event.target, '.modal');
  var type = _modal.querySelector('.content').dataset.type;
  var discount = Number(_modal.querySelector('.won_input').value.replace(/,/g, ''));
  if (type == 'won') {
    payment_history.discount = discount;
    setPaymentData();
    _modal.click();
  }
  if (type == 'percent') {
    setPaymentData();
    _modal.click();
  }
};

window.clickSaveSplitPayment = function(event) {
  var _modal = findParentTarget(event.target, '.modal');
  var type = _modal.querySelector('.content').dataset.type;
  if (type == 'direct') {
    var price = Number(_modal.querySelector('.direct_input').value.replace(/,/g, ''));
    payment_history.payment_history.direct = price;
    payment_history.payment_history.isDutch = false;
    payment_history.payment_history.curDutch = 1;
    payment_history.payment_history.totalDutch = 0;
    if (price > 0) {
      payment_history.payment_history.isDirect = true;
      var ob = document.querySelector('.payment main section article .top .other_btns');
      if (ob) ob.classList.add('paid');
    } else {
      payment_history.payment_history.isDirect = false;
      var ob2 = document.querySelector('.payment main section article .top .other_btns');
      if (ob2) ob2.classList.remove('paid');
    }
    setPaymentData(price);
  }

  if (type == 'dutch') {
    var dutch = Number(document.querySelector('.count_btns span').textContent);
    payment_history.payment_history.totalDutch = dutch;
    if (dutch <= 1) {
      payment_history.payment_history.isDutch = false;
      payment_history.payment_history.curDutch = 1;
      var ob3 = document.querySelector('.payment main section article .top .other_btns');
      if (ob3) ob3.classList.remove('paid');
      setPaymentData();
    } else {
      payment_history.payment_history.isDutch = true;
      var ob4 = document.querySelector('.payment main section article .top .other_btns');
      if (ob4) ob4.classList.add('paid');
      setPaymentData(payment_history.payment_history.dutchPrice);
    }
  }
  _modal.click();
};

window.clickDirectBtn = function(event) {
  var el = document.querySelector('.payment .modal-content .modal-body .top .content');
  el.classList.remove('dutch');
  el.classList.add('direct');
  el.dataset.type = 'direct';
};

window.clickDutchBtn = function(event) {
  var el = document.querySelector('.payment .modal-content .modal-body .top .content');
  el.classList.remove('direct');
  el.classList.add('dutch');
  el.dataset.type = 'dutch';
};

window.clickDiscountPercent = function(event, num) {
  var _modalLeftEl = document.querySelector('.payment .modal-content .modal-body .top .content');
  var curType = _modalLeftEl.dataset.type;
  var total = Number(_modalLeftEl.dataset.total.replace(/,/g, ''));
  var _input = document.querySelector('.payment .modal-content .modal-body .top .content.' + curType + ' .payment_amount input.' + curType + '_input');

  _input.value = Math.min(num, 100);
  var discount = (num / 100) * total;
  payment_history.discount = discount;
  document.querySelector('.split_payment_amount span.percent').innerHTML = (total - discount).toLocaleString() + '원';
  changePaymentAmount(curType, _input);
};

window.clickNumberPad = function(event) {
  var _modalLeftEl = document.querySelector('.payment .modal-content .modal-body .top .content');
  var curType = _modalLeftEl.dataset.type;
  var total = Number(_modalLeftEl.dataset.total.replace(/,/g, ''));
  var target = event.target;
  var targetValue = target.dataset.value;
  if (['direct', 'won', 'percent', 'cash', 'addition'].includes(curType)) {
    var _input = document.querySelector('.payment .modal-content .modal-body .top .content.' + curType + ' .payment_amount input.' + curType + '_input');
    var value = _input.value.replace(/,/g, '');

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
        _input.value = Math.min(Number(setReplaceNumberPad(Number(value) + targetValue).replace(/,/g, '')), total).toLocaleString();
      } else {
        _input.value = Number(setReplaceNumberPad(value + targetValue).replace(/,/g, '')).toLocaleString();
      }
    }
    if (curType == 'direct') {
      document.querySelector('.split_payment_amount span').innerHTML = _input.value + '원';
    }
    if (curType == 'percent') {
      _input.value = Math.min(Number(_input.value.replace(/,/g, '')), 100);
      var discount = (Number(_input.value) / 100) * total;
      payment_history.discount = discount;
      document.querySelector('.split_payment_amount span.percent').innerHTML = (total - discount).toLocaleString() + '원';
    }
    changePaymentAmount(curType, _input);

    if (curType == 'won') {
      document.querySelector('.split_payment_amount span.won').innerHTML = (total - _input.value.replace(/,/g, '')).toLocaleString() + '원';
    }
  }
  if (curType == 'dutch') {
    var _dinput = document.querySelector('.payment .modal-content .modal-body .top .content .dutch_content .count_btns span');
    var dvalue = _dinput.innerText;

    if (targetValue == undefined) return;
    _dinput.focus();

    if (dvalue == '1' && targetValue != '0' && targetValue != '1' && targetValue != '←' && targetValue != 'C') {
      _dinput.innerText = targetValue;
    } else {
      if (targetValue == '←') {
        var newValue = setReplaceNumberPad(dvalue.slice(0, -1));
        _dinput.innerText = newValue === "" ? "1" : newValue;
      }
      if (targetValue == 'C') {
        _dinput.innerText = '1';
      }
      if (targetValue != '←' && targetValue != 'C') {
        _dinput.innerText = setReplaceNumberPad(dvalue + targetValue);
      }
    }

    payment_history.payment_history.totalDutch = Number(_dinput.innerText);
    var _dutch = document.querySelector('.payment .modal-content .modal-body .top .content.dutch .split_payment_amount span.dutch');
    var dTotalPrice = document.querySelector('.receive_amount').dataset.price;
    payment_history.payment_history.dutchPrice = Number((dTotalPrice / payment_history.payment_history.totalDutch).toFixed(0));
    _dutch.innerHTML = payment_history.payment_history.dutchPrice.toLocaleString() + '원 x ' + payment_history.payment_history.totalDutch;
  }
};

var setReplaceNumberPad = function(str) {
  return str.replace(/[^0-9]/g, '').replace(/^0+/, '').replace(/,(\s*)$/, '').toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

window.updatePaymentAmount = function(event) {
  var curValue = event.target.value;
  var _content = findParentTarget(event.target, '.content');
  var type = _content.dataset.type;
  var total = type == 'percent' ? 100 : Number(_content.dataset.total.replace(/,/g, ''));

  if (type != 'cash' && type != 'addition') {
    curValue = String(Math.min(Number(curValue.replace(/,/g, '')), total));
  }
  event.target.value = curValue.replace(/[^0-9]/g, '').toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  changePaymentAmount(type, event.target);
};

var changePaymentAmount = function(type, input) {
  if (type == "cash") {
    var value = Number(input.value.replace(/,/g, ''));
    var due = payment_history.curPaymentPrice;
    var change = value - due;

    document.querySelector('.cash_amount span').innerHTML = value.toLocaleString() + '원';

    var changeEl = document.querySelector('.change_amount span');
    if (change >= 0) {
      changeEl.innerHTML = change.toLocaleString() + '원';
      changeEl.style.color = '#27ae60';
    } else {
      changeEl.innerHTML = '부족 ' + (-change).toLocaleString() + '원';
      changeEl.style.color = '#e74c3c';
    }

    var completeBtn = document.getElementById('cash-amount-confirm-btn');
    if (completeBtn) completeBtn.disabled = change < 0;
  }
  var _span = input.nextElementSibling;
  if (_span) _span.style.left = (15 + calculateTextWidth(input.value)) + 'px';
};

window.clickMinusCountBtn = function(event) {
  var _input = document.querySelector('.payment .modal-content .modal-body .top .content .dutch_content .count_btns span');
  var value = Number(_input.innerText);
  if (value <= 1) return;
  _input.innerText = String(value - 1);
  payment_history.payment_history.totalDutch = value - 1;
  var _dutch = document.querySelector('.payment .modal-content .modal-body .top .content.dutch .split_payment_amount span.dutch');
  var totalPrice = document.querySelector('.receive_amount').dataset.price;
  payment_history.payment_history.dutchPrice = Number((totalPrice / payment_history.payment_history.totalDutch).toFixed(0));
  _dutch.innerHTML = payment_history.payment_history.dutchPrice.toLocaleString() + '원 x ' + payment_history.payment_history.totalDutch;
};

window.clickPlusCountBtn = function(event) {
  var _input = document.querySelector('.payment .modal-content .modal-body .top .content .dutch_content .count_btns span');
  var value = Number(_input.innerText);
  _input.innerText = String(value + 1);
  payment_history.payment_history.totalDutch = value + 1;
  var _dutch = document.querySelector('.payment .modal-content .modal-body .top .content.dutch .split_payment_amount span.dutch');
  var totalPrice = document.querySelector('.receive_amount').dataset.price;
  payment_history.payment_history.dutchPrice = Number((totalPrice / payment_history.payment_history.totalDutch).toFixed(0));
  _dutch.innerHTML = payment_history.payment_history.dutchPrice.toLocaleString() + '원 x ' + payment_history.payment_history.totalDutch;
};

// ─���─ 현금 결제 ──────────────────────────────────────────────────────────────

function _closeCashPaymentModal() {
  document.querySelector('#cash-wait-modal')?.remove();
  _cashPaymentId = null;
  var cashBtn = document.querySelector('.cash_btn');
  if (cashBtn) { cashBtn.disabled = false; cashBtn.style.opacity = ''; }
}

window.clickCashPayment = async function(event) {
  if (!payment_history?.curPaymentPrice) {
    alert('결제할 금액이 없습니다.');
    return;
  }

  var _cashBtn = event.currentTarget;
  _cashBtn.disabled = true;
  _cashBtn.style.opacity = '0.5';

  _cashPaymentId = null;
  _openCashAmountModal();
};

function _openCashAmountModal() {
  openModalFun({ preventDefault: function() {} });
  var _modal = document.querySelector('.modal');
  var _modalTitle = document.querySelector('.modal-content h1');
  var _modalBody = document.querySelector('.modal-content .modal-body');
  var _curPrice = payment_history.curPaymentPrice;

  _modalTitle.innerHTML = '현금 결제';
  _modalBody.innerHTML = '<div class="top"><div class="content cash" data-total="' + _curPrice + '" data-type="cash">' +
    '<div class="receive_amount"><h3>받을 금액</h3><span>' + _curPrice.toLocaleString() + '원</span></div>' +
    '<div class="direct_content"><div class="payment_amount"><h3>받은 금액</h3>' +
    '<input class="cash_input" type="text" value="" oninput="updatePaymentAmount(event)" />' +
    '<span class="cash_input">원</span></div></div>' +
    '<div class="cash_amount"><h3>받은 금액</h3><span>0원</span></div>' +
    '<div class="change_amount"><h3>거스름돈</h3><span style="color:#e74c3c;">부족 ' + _curPrice.toLocaleString() + '원</span></div></div>' +
    '<div class="number_pad" onclick="clickNumberPad(event)">' +
    '<button data-value="1">1</button><button data-value="2">2</button><button data-value="3">3</button>' +
    '<button data-value="4">4</button><button data-value="5">5</button><button data-value="6">6</button>' +
    '<button data-value="7">7</button><button data-value="8">8</button><button data-value="9">9</button>' +
    '<button data-value="C">C</button><button data-value="0">0</button><button data-value="←">←</button>' +
    '</div></div><div class="bottom"><button id="cash-amount-confirm-btn" onclick="_onCashAmountReady()" disabled>결제 완료</button></div>';

  _modal.querySelector('.close')?.addEventListener('click', function() {
    _cancelCashPayment();
    _modal.remove();
  }, { once: true });
}

window._onCashAmountReady = function() {
  document.querySelector('#modal.modal')?.remove();
  if (_cashPaymentId) {
    fetch('/pos/toss/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: _cashPaymentId }),
    }).catch(function() {});
    _cashPaymentId = null;
  }
  var paymentData = setPayment(1);
  fetchData('/pos/payment_history/' + lastPath, 'POST', paymentData, function(responseData) {
    var cashBtn = document.querySelector('.cash_btn');
    if (cashBtn) { cashBtn.disabled = false; cashBtn.style.opacity = ''; }
    _cashTablePaymentListId = responseData.table_payment_list_id || null;
    _cashReceiptIsFinished = !!responseData.is_finished;
    if (responseData.payment_id) {
      _lastSavedPaymentId = responseData.payment_id;
    }
    _openCashReceiptModal();
  });
};

function _openCashReceiptModal() {
  document.querySelector('#cash-receipt-modal')?.remove();
  var modal = document.createElement('div');
  modal.id = 'cash-receipt-modal';
  modal.className = 'modal show';
  modal.innerHTML = '<div class="modal-content cash-receipt-content">' +
    '<div class="modal-top"><h1>현금 영수증 발급</h1>' +
    '<i class="ph-bold ph-x cr-close-icon" onclick="_closeCashReceiptModalGlobal()"></i></div>' +
    '<div class="modal-body cash-receipt-body">' +
    '<div class="cr-type-btns"><button class="cr-type-btn active" data-type="CONSUMER">개인</button>' +
    '<button class="cr-type-btn" data-type="BUSINESS">사업자</button></div>' +
    '<input id="cr-number-input" type="text" inputmode="numeric" placeholder="전화번호 (숫자만)" class="cr-number-input" />' +
    '<button id="cr-issue-btn" class="cr-btn cr-btn-issue">발급 신청</button>' +
    '<div class="cr-divider"></div>' +
    '<button id="cr-direct-btn" class="cr-btn cr-btn-direct">단말기에서 직접 입력</button>' +
    '<div class="cr-or">or</div>' +
    '<button id="cr-no-receipt-btn" class="cr-btn cr-btn-no-receipt">발급 안함</button></div></div>';
  document.body.appendChild(modal);

  modal.querySelectorAll('.cr-type-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      modal.querySelectorAll('.cr-type-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var inp = document.getElementById('cr-number-input');
      inp.placeholder = btn.dataset.type === 'CONSUMER' ? '전화번호 (숫자만)' : '사업자번호 (숫자만)';
    });
  });

  document.getElementById('cr-no-receipt-btn').addEventListener('click', function() {
    _closeCashReceiptModal();
  });

  document.getElementById('cr-direct-btn').addEventListener('click', function() {
    modal.remove();
    _processCashPayment(null, null);
  });

  document.getElementById('cr-issue-btn').addEventListener('click', function() {
    var activeBtn = modal.querySelector('.cr-type-btn.active');
    var issuerType = activeBtn?.dataset.type || null;
    var identityNumber = document.getElementById('cr-number-input')?.value.trim().replace(/[^0-9]/g, '') || null;
    if (!issuerType) { showToast('개인 또는 사업자를 선택해주세요.', 'info'); return; }
    if (!identityNumber) { showToast('현금영수증 번호를 입력해주세요.', 'info'); return; }
    modal.remove();
    _processCashPayment(issuerType, identityNumber);
  });

  modal.addEventListener('click', function(e) { if (e.target === modal) _closeCashReceiptModal(); });
}

function _closeCashReceiptModal() {
  document.querySelector('#cash-receipt-modal')?.remove();
  var isFinished = _cashReceiptIsFinished;
  _cashTablePaymentListId = null;
  _cashReceiptIsFinished = false;
  if (isFinished) {
    createCompletedPaymentModal({ preventDefault: function() {} }, 'CASH', _lastSavedPaymentId || null);
  } else {
    _reloadPaymentView();
  }
}
window._closeCashReceiptModalGlobal = function() { _closeCashReceiptModal(); };

function _cancelCashPayment() {
  document.querySelector('#cash-receipt-modal')?.remove();
  document.querySelector('#modal.modal')?.remove();
  if (_cashPaymentId) {
    fetch('/pos/toss/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: _cashPaymentId }),
    }).catch(function() {});
    _cashPaymentId = null;
  }
  var cashBtn = document.querySelector('.cash_btn');
  if (cashBtn) { cashBtn.disabled = false; cashBtn.style.opacity = ''; }
}

// ─── 현금영수증 취소 모달 ───────────────────────────────────────────────────
function _openCashReceiptCancelModal(paymentId) {
  _cashReceiptCancelPaymentId = paymentId;
  document.querySelector('#cash-receipt-cancel-modal')?.remove();
  clearInterval(_cashReceiptCancelTimer);

  var remaining = 60;
  var modal = document.createElement('div');
  modal.id = 'cash-receipt-cancel-modal';
  modal.innerHTML = '<div class="card-modal-overlay"><div class="card-modal-box">' +
    '<div class="card-modal-icon">🧾</div><h2>현금영수증 발�� 완료</h2>' +
    '<p class="terminal-status-msg" style="color:#888;font-size:13px;">영��증이 발급되었습니다. (<span id="cr-cancel-countdown">60</span>초 내 취소 가능)</p>' +
    '<div style="display:flex;gap:10px;margin-top:16px;">' +
    '<button class="card-modal-cancel-btn" style="flex:1;background:#e74c3c;" onclick="_requestCashReceiptCancelGlobal()">영수증 취소</button>' +
    '<button class="card-modal-cancel-btn" style="flex:1;background:#27ae60;" onclick="_closeCashReceiptCancelModalGlobal()">확인</button>' +
    '</div></div></div>';
  document.body.appendChild(modal);

  _cashReceiptCancelTimer = setInterval(function() {
    remaining--;
    var el = document.querySelector('#cr-cancel-countdown');
    if (el) el.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(_cashReceiptCancelTimer);
      _cashReceiptCancelPaymentId = null;
      document.querySelector('#cash-receipt-cancel-modal')?.remove();
      _doCloseCashReceiptFlow();
    }
  }, 1000);
}

function _closeCashReceiptCancelModal() {
  clearInterval(_cashReceiptCancelTimer);
  _cashReceiptCancelPaymentId = null;
  document.querySelector('#cash-receipt-cancel-modal')?.remove();
  _doCloseCashReceiptFlow();
}
window._closeCashReceiptCancelModalGlobal = function() { _closeCashReceiptCancelModal(); };

function _doCloseCashReceiptFlow() {
  var isFinished = _cashReceiptIsFinished;
  _cashTablePaymentListId = null;
  _cashReceiptIsFinished = false;
  if (isFinished) {
    createCompletedPaymentModal({ preventDefault: function() {} }, 'CASH', _lastSavedPaymentId || null);
  } else {
    _reloadPaymentView();
  }
}

async function _requestCashReceiptCancel() {
  var paymentId = _cashReceiptCancelPaymentId;
  if (!paymentId) return;

  var btn = document.querySelector('#cash-receipt-cancel-modal .card-modal-box button[style*="e74c3c"]');
  if (btn) { btn.disabled = true; btn.textContent = '취소 요청 중...'; }

  var res = await fetch('/pos/toss/cash_receipt_cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: paymentId }),
  }).catch(function() { return null; });

  if (!res || !res.ok) {
    showToast('취소 요청 실패. 다시 시도해주세요.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '영수증 취소'; }
  } else {
    var statusMsg = document.querySelector('#cash-receipt-cancel-modal .terminal-status-msg');
    if (statusMsg) statusMsg.textContent = '단말기에서 취소 처리 중...';
  }
}
window._requestCashReceiptCancelGlobal = function() { _requestCashReceiptCancel(); };

// 현금 결제 실행
async function _processCashPayment(issuerType, identityNumber) {
  var isTerminalOnline = _terminalOnline;

  if (isTerminalOnline) {
    try {
      var paymentId = await _activateDisplayPending('cash');
      if (!paymentId) {
        var bd = _buildTerminalOrderData();
        var res = await fetch('/pos/toss/pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_id: lastPath,
            order: bd.orderData,
            tax: bd.tax,
            supply_value: bd.supplyValue,
            payment_key: 'ORD_' + Date.now() + '_' + lastPath,
            payment_type: 'cash',
          }),
        });
        var d = await res.json();
        if (!res.ok) {
          alert(d.msg || '현금 결제 요청 중 오류가 발생했습니다.');
          var cashBtn = document.querySelector('.cash_btn');
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

      document.querySelector('#cash-wait-modal')?.remove();
      var waitModal = document.createElement('div');
      waitModal.id = 'cash-wait-modal';
      waitModal.innerHTML = '<div class="card-modal-overlay"><div class="card-modal-box">' +
        '<div class="card-modal-icon">💵</div><h2>현금 결제 처리 중</h2>' +
        '<p class="terminal-status-msg">단말기에서 결제 처리 중...</p>' +
        '<button class="card-modal-cancel-btn" onclick="clickCancelCashPayment()">결제 취소</button>' +
        '</div></div>';
      document.body.appendChild(waitModal);
    } catch (e) {
      alert('오류가 발생했습니다. 다시 시도해주세요.');
      _cancelCashPayment();
    }
  } else {
    _closeCashReceiptModal();
  }
}

window.clickCancelCashPayment = function() {
  if (!_cashPaymentId) return;
  fetch('/pos/toss/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: _cashPaymentId }),
  }).catch(function() {});
  _closeCashPaymentModal();
};

// ─── 카드 결제 ──────────────────────────────────────────────────────────────
window.clickCardPayment = async function(event) {
  var _cardBtn = event.currentTarget;
  _cardBtn.disabled = true;
  _cardBtn.style.opacity = '0.5';

  try {
    var paymentId = await _activateDisplayPending('card_go');

    if (!paymentId) {
      var totalPrice = payment_history.curPaymentPrice;
      var tax = Math.round(totalPrice / 11);
      var supplyValue = totalPrice - tax;
      var bd = _buildTerminalOrderData();
      var response = await fetch('/pos/toss/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: lastPath,
          order: bd.orderData,
          tax: tax,
          supply_value: supplyValue,
          payment_key: 'ORD_' + Date.now() + '_' + lastPath,
          payment_type: 'card_go',
        }),
      });
      var resData = await response.json();
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
};

var _clickPaymentOnPaymentView = async function(event) {
  if (!payment_history?.curPaymentPrice) {
    alert('결제할 금액이 없습니다.');
    return;
  }
  clickCardPayment(event);
};

// ─── 결제 성공 모달 ─────────────────────────────────────────────────────────
var createCompletedPaymentModal = async function(event, type, receiptId) {
  openModalFun(event);
  var _modal = document.querySelector('.modal');
  var _modalTitle = document.querySelector('.modal-content h1');
  var _modalBody = document.querySelector('.modal-content .modal-body');
  _modal.classList.add('success_payment');
  _modalTitle.innerHTML = '';

  var tableId = lastPath;
  var storeInfoResult = await fetchDataAsync('/pos/get_store_info', 'GET', {});
  var tableName = document.querySelector('header h1')?.innerText || tableId;

  var orderData = {
    tableName: tableName,
    items: order_history.map(function(item) {
      return { name: item.name, price: item.price, count: item.count, options: item.options };
    })
  };

  var paymentInfo = {
    price: payment_history.curPaymentPrice,
    discount: payment_history.discount,
    extra_charge: payment_history.extra_charge,
    method: type == 'CASH' ? 1 : 2
  };

  var receiptHtml = ReceiptEngine.generateCustomerReceipt(storeInfoResult, orderData, paymentInfo);

  var html = '<div class="top "><i class="ph-fill ph-hands-clapping"></i>' +
    '<h2>결제 완료</h2><span>' + (type == 'CASH' ? '현금' : '카드') + ' 결제가 완료되었습니다.</span></div>' +
    '<div class="bottom">' +
    '<button class="print_receipt" onclick="printReceiptFromPayment(this, \'' + type + '\', ' + (receiptId != null ? receiptId : 'null') + ')">영수증 출력</button>' +
    '<button class="close" onclick="navigateTo(\'/pos/tableList\')">확인</button></div>';
  _modalBody.innerHTML = html;
  setPayment(type == 'CASH' ? 1 : 2);
};

window.openReceiptDetailModal = async function(type) {
  var storeInfoResult = await fetchDataAsync('/pos/get_store_info', 'GET', {});
  var tableName = document.querySelector('header h1')?.innerText || lastPath;

  var orderData = {
    tableName: tableName,
    items: order_history.map(function(item) {
      return { name: item.name, price: item.price, count: item.count, options: item.options };
    })
  };

  var paymentInfo = {
    price: payment_history.curPaymentPrice,
    discount: payment_history.discount,
    extra_charge: payment_history.extra_charge,
    method: type == 'CASH' ? 1 : 2
  };

  ReceiptEngine.openReceiptModal(storeInfoResult, orderData, paymentInfo);
};

window.printReceiptFromPayment = async function(btn, type, receiptId) {
  if (!PrinterManager.isSupported()) {
    alert('이 브라우저는 Web Serial API를 지원하지 않습니다.\nChrome 또는 Edge를 사용해주세요.');
    return;
  }

  if (btn) {
    btn.dataset.origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-circle-notch"></i> 출력 중...';
  }

  try {
    var storeInfo = await fetch('/store/get_receipt_store_info')
      .then(function(r) { return r.ok ? r.json() : {}; }).catch(function() { return {}; });

    var tableName = document.querySelector('header h1')?.innerText || String(lastPath);
    var orderData = {
      tableName: tableName,
      items: order_history.map(function(item) {
        return { name: item.name, price: item.price, count: item.count, options: item.options };
      })
    };

    var ph = payment_history.payment_history || {};
    var now = new Date();
    var pad = function(n) { return String(n).padStart(2, '0'); };
    var datetimeStr = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    var paymentInfo = {
      receiptId: (receiptId != null) ? receiptId : (_lastSavedPaymentId || null),
      price: payment_history.curPaymentPrice,
      method: type === 'CASH' ? 1 : 2,
      discount: payment_history.discount,
      extra_charge: payment_history.extra_charge,
      datetimeStr: datetimeStr,
      approvalNo: ph.toss_approval_no || null,
      cardNumber: ph.toss_details?.card?.maskedCardNumber
        ? ReceiptEngine._formatCardNumber(ph.toss_details.card.maskedCardNumber)
        : null,
    };

    var lines = ReceiptEngine.generateSerialReceiptLines(storeInfo, orderData, paymentInfo);

    var printer = await fetch('/store/get_default_printer')
      .then(function(r) { return r.ok ? r.json() : {}; }).catch(function() { return {}; });

    await PrinterManager.printReceipt(
      lines, printer.baud_rate, printer.usb_vendor_id, printer.usb_product_id
    );
    showToast('영수증이 출력되었습니다.', 'success');

  } catch (e) {
    console.error('[Receipt Print]', e);
    if (e.message && !e.message.includes('NotFoundError')) {
      alert('영수증 출력 오류: ' + e.message);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.origText || '영수증 출력';
    }
  }
};

var setOrderList = function() {
  var items = deepCopy(setBasketData(order_history));
  return items.map(function(item) {
    item.data.count = item.length;
    delete item.data.id;
    item.data.options.forEach(function(option) {
      delete option.id;
    });
    return item.data;
  });
};

var setPayment = function(method) {
  var tableId = lastPath;
  var order_list = setOrderList();
  var total_price = payment_history.orderTotalPrice + payment_history.extra_charge - payment_history.discount;
  var first_order_time = payment_history.first_order_time;

  var payment = {
    discount: payment_history.discount,
    extra_charge: payment_history.extra_charge,
    method: method,
    price: payment_history.curPaymentPrice,
    payment_history: payment_history.payment_history
  };
  return {
    table_id: tableId,
    payment: payment,
    order_list: order_list,
    total_price: total_price,
    first_order_time: first_order_time
  };
};

// ─── 비활성 자동 복귀 ───────────────────────────────────────────────────────
function _resetInactivityTimer() {
  clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(function() {
    navigateTo('/pos/tableList');
  }, INACTIVITY_TIMEOUT);
}

var _inactivityEvents = ['click', 'touchstart', 'keydown', 'mousemove'];
function _addInactivityListeners() {
  _inactivityEvents.forEach(function(evt) {
    document.addEventListener(evt, _resetInactivityTimer, { passive: true });
  });
}
function _removeInactivityListeners() {
  _inactivityEvents.forEach(function(evt) {
    document.removeEventListener(evt, _resetInactivityTimer);
  });
}

window.callPayment = function(event, type) {
  console.log(setPayment(type));
};

window.clickWonBtn = function(event) {
  var _content = findParentTarget(event.target, '.content ');
  _content.classList.remove('percent');
  _content.classList.add('won');
  _content.dataset.type = 'won';
};

window.clickPercentBtn = function(event) {
  var _content = findParentTarget(event.target, '.content ');
  _content.classList.remove('won');
  _content.classList.add('percent');
  _content.dataset.type = 'percent';

  var _input = document.querySelector('.percent_input');
  changePaymentAmount('percent', _input);
};

// =============================================
//  init / cleanup (SPA 라우터에서 호출)
// =============================================

window.initPaymentView = function(params) {
  var tableId = params.tableId;
  window.lastPath = tableId;

  // 상태 초기화
  order_history = undefined;
  payment_history = undefined;
  _currentCardPayment = null;
  _cashPaymentId = null;
  _lastSavedPaymentId = null;
  _terminalOnline = false;
  _cashTablePaymentListId = null;
  _cashReceiptIsFinished = false;
  _displayPaymentId = null;
  _unloadCancelDone = false;
  _cashReceiptCancelPaymentId = null;

  document.getElementById('pos-content').innerHTML = PAYMENT_SHELL;

  // 소켓 이벤트 등록
  _setupPaymentSocketEvents();

  // 단말기 폴링 시작
  _startTerminalStatusPoll();
  _startDisplayHeartbeat();

  // unload 이벤트
  window.addEventListener('pagehide', _cancelAllOnUnload);
  window.addEventListener('beforeunload', _cancelAllOnUnload);

  // 데이터 로드
  callOrderHistory();
  callPaymentHistory();

  // 비활성 타이머
  _resetInactivityTimer();
  _addInactivityListeners();

  // onOrderUpdate 콜백 (payment 뷰용 - 불���요하지만 안전을 위해)
  window.onOrderUpdate = function(data) {};
};

window.cleanupPaymentView = function() {
  // 활성 pending 취소
  _cancelAllOnUnload();

  // 소켓 이벤트 해제
  if (typeof socket !== 'undefined') {
    socket.off('toss_payment_result');
    socket.off('toss_cancel_result');
    socket.off('toss_cash_receipt_cancel_result');
    socket.off('terminal_status');
  }

  // 폴링 정지
  if (_terminalPollInterval) { clearInterval(_terminalPollInterval); _terminalPollInterval = null; }
  if (_displayHeartbeatInterval) { clearInterval(_displayHeartbeatInterval); _displayHeartbeatInterval = null; }
  if (_cardPaymentTimer) { clearInterval(_cardPaymentTimer); _cardPaymentTimer = null; }
  if (_cashReceiptCancelTimer) { clearInterval(_cashReceiptCancelTimer); _cashReceiptCancelTimer = null; }

  // 비활성 타이머 정리
  clearTimeout(_inactivityTimer);
  _removeInactivityListeners();

  // unload 이벤트 정리
  window.removeEventListener('pagehide', _cancelAllOnUnload);
  window.removeEventListener('beforeunload', _cancelAllOnUnload);

  // 모달 정리
  document.querySelector('#card-payment-modal')?.remove();
  document.querySelector('#cash-wait-modal')?.remove();
  document.querySelector('#cash-receipt-modal')?.remove();
  document.querySelector('#cash-receipt-cancel-modal')?.remove();
};

})();
