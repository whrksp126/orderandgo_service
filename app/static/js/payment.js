let order_history = undefined;
let payment_history = undefined;
// 테이블 주문 내역 가져오기
const callOrderHistory = () => {
  const onSuccess = (data) => {
    order_history=data.map((order)=>({
      id: order.id,
      masterName : setMasterName(order),
      name: order.name,
      price: order.price,
      count: 1,
      options: order.options,
    }))
    if(order_history!=undefined && payment_history!=undefined) paymentHtml();
    
  }
  fetchData(`/pos/get_table_order_list/${lastPath}`, 'GET', {}, onSuccess)
}
// 결제내역 조회
const callPaymentHistory = () => {
  const onSuccess = (data) => {
    payment_history = data;
    if(order_history!=undefined && payment_history!=undefined) paymentHtml();
  }
  fetchData(`/pos/payment_history/${lastPath}`, 'GET', {}, onSuccess)
}

// 통신 후 화면 설정
callOrderHistory();
callPaymentHistory();
const paymentHtml = () => {
  const isNotFirst = payment_history.payment.length > 0 ? true : false;
  if(isNotFirst){ // 이미 결제 내역이 있는 경우
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
  if(payment_history.extra_charge > 0){
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
  if(payment_history.paid){
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
const setPaymentData = (curPaymentPrice=false) => {
  // 추가 금액 최신화
  const _additionLi = document.querySelector('.addition_data'); // 추가 금액
  _additionLi?.remove();
  if(payment_history.extra_charge > 0) {
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
  _totalPrice.innerHTML = `${totalPrice.toLocaleString() }원`  

  // 받은 금액 최신화
  const _received = document.querySelector('.payment main section article .top .total_price .paid .received'); // 받은 금액
  const receivedTotalPrice = payment_history.payment.reduce((accumulator, item) => accumulator + item.price, 0);
  if(receivedTotalPrice > 0 ){
    _received.innerHTML = `| 받은 금액 ${receivedTotalPrice.toLocaleString()}`
  }

  // 남은 금액 최신화
  const _remaining = document.querySelector('.payment main section article .top .total_price .paid .remaining'); // 남은 금액
  _remaining.innerHTML = `남은 금액 ${(totalPrice-receivedTotalPrice).toLocaleString()}원`

  
  // 현재 받을 금액 최신화 
  const _currentPrice = document.querySelector('.payment main section article .top .total_price .cur_price > span'); // 현재 결제할 금액
  if(!curPaymentPrice){
    if(payment_history.payment_history.isDutch){
      _currentPrice.innerHTML = `${(payment_history.payment_history.dutchPrice).toLocaleString()}원`;
      payment_history.curPaymentPrice = payment_history.payment_history.dutchPrice
    }else{
      _currentPrice.innerHTML = `${(totalPrice-receivedTotalPrice).toLocaleString()}원`;
      payment_history.curPaymentPrice = totalPrice-receivedTotalPrice
    }
  }else{
    
    _currentPrice.innerHTML = `${curPaymentPrice.toLocaleString()}원`;
    payment_history.curPaymentPrice = curPaymentPrice
  };  

  // 더치 페이 최신화
  const _curTotalPrice = document.querySelector('.payment main section article .top .total_price');
  if(payment_history.payment_history.totalDutch > 1){
    const _curDutch = document.querySelector('.payment main section article .top .total_price .cur_price > .dutch');
    _curTotalPrice.classList.add('dutch');
    _curDutch.innerHTML = `${payment_history.payment_history.curDutch}/${payment_history.payment_history.totalDutch}`
  }else{
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
  
  const dicountPercent = (payment_history.discount/totalPrice) * 100
  console.log(totalPrice, payment_history.discount, dicountPercent)
  _modalTitle.innerHTML = '할인'
  let html = `
  <div class="top ">
    <div class="content won" data-type="won" data-total="${(totalPrice-receivedTotalPrice).toLocaleString()}">
      <div class="tab_btns">
        <button class="won_btn" onclick="clickWonBtn(event)">원</button>
        <button class="percent_btn" onclick="clickPercentBtn(event)">%</button>
      </div>
      <div class="receive_amount">
        <h3>받을 금액</h3>
        <span>${(totalPrice-receivedTotalPrice).toLocaleString()}원</span>
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
          <span class="won">${(totalPrice-payment_history.discount).toLocaleString()}원</span>
          <span class="percent">${(totalPrice-payment_history.discount).toLocaleString()}원</span>
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
      <div class="content ${isDutch ? `dutch`:`direct`} " data-total="${(totalPrice-receivedTotalPrice).toLocaleString()}" data-type="${isDutch ? `dutch`:`direct`}">
        <div class="tab_btns">
          <button class="direct_btn" onclick="clickDirectBtn(event)">직접 입력</button>
          <button class="dutch_btn" onclick="clickDutchBtn(event)">더치 페이</button>
        </div>
        <div class="receive_amount" data-price="${totalPrice-receivedTotalPrice}">
            <h3>받을 금액</h3>
            <span>${(totalPrice-receivedTotalPrice).toLocaleString()}원</span>
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
            <input class="direct_input" value="${isDirect? `${direct.toLocaleString()}`  : `0`}" type="text" oninput="updatePaymentAmount(event)"/>
            <span class="direct_input">원</span>
          </div>
        </div>
        <div class="split_payment_amount">
            <h3>분할 결제 금액</h3>
            <span class="direct">${direct.toLocaleString()}원</span>
            <span class="dutch" data-price="${((totalPrice-receivedTotalPrice)/totalDutch).toFixed(0)}">
              ${ Number(((totalPrice-receivedTotalPrice)/totalDutch).toFixed(0)).toLocaleString() }원 x ${totalDutch}
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
  if(type == 'won'){
    payment_history.discount = discount;
    setPaymentData();
    _modal.click();
  }
  if(type == 'percent'){
    setPaymentData();
    _modal.click();
  }
}

// 분할 결제 적용 버튼 클릭 시
const clickSaveSplitPayment = (event) => {
  const _modal = findParentTarget(event.target,'.modal');
  const type = _modal.querySelector('.content').dataset.type;
  if(type == 'direct'){ // 금액 입력
    const price = Number(_modal.querySelector('.direct_input').value.replace(/,/g, ''));
    payment_history.payment_history.direct = price;
    payment_history.payment_history.isDutch = false;
    payment_history.payment_history.curDutch = 1;
    payment_history.payment_history.totalDutch = 0;
    if(price>0){
      payment_history.payment_history.isDirect = true;
      document.querySelector('.payment main section article .top .other_btns').classList.add('paid');
    }else{
      payment_history.payment_history.isDirect = false;
      document.querySelector('.payment main section article .top .other_btns').classList.remove('paid');
    }
    setPaymentData(price);
  }
  
  if(type == 'dutch'){ // 더치 페이
    const dutch = Number(document.querySelector('.count_btns span').textContent);
    payment_history.payment_history.totalDutch = dutch;
    if(dutch <= 1){
      payment_history.payment_history.isDutch = false;
      payment_history.payment_history.curDutch = 1;
      document.querySelector('.payment main section article .top .other_btns').classList.remove('paid');
      setPaymentData()

    }else{
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
  _modalLeftEl.dataset.type='direct'
}

// 더치 페이 버튼 클릭 시
const clickDutchBtn = (event) => {
  
  const _modalLeftEl = document.querySelector('.payment .modal-content .modal-body .top .content');
  _modalLeftEl.classList.remove('direct')
  _modalLeftEl.classList.add('dutch')
  _modalLeftEl.dataset.type='dutch'
}

// 할인 퍼센트 버튼 클릭 시
const clickDiscountPercent = (event, num) => {
  const _modalLeftEl = document.querySelector('.payment .modal-content .modal-body .top .content');
  const curType = _modalLeftEl.dataset.type;
  const total = Number(_modalLeftEl.dataset.total.replace(/,/g, ''));
  const _input = document.querySelector(`.payment .modal-content .modal-body .top .content.${curType} .payment_amount input.${curType}_input`);

  _input.value = Math.min(num, 100);
  const discount = (num/100)*total;
  payment_history.discount = discount;
  document.querySelector('.split_payment_amount span.percent').innerHTML = `${(total-discount).toLocaleString()}원`
  changePaymentAmount(curType, _input)

}

// 숫자 패드 클릭 시
const clickNumberPad = (event) => {
  const _modalLeftEl = document.querySelector('.payment .modal-content .modal-body .top .content');
  const curType = _modalLeftEl.dataset.type;
  const total = Number(_modalLeftEl.dataset.total.replace(/,/g, ''));
  const target = event.target;
  const targetValue = target.dataset.value;
  if(['direct', 'won', 'percent', 'cash', 'addition'].includes(curType)){ // 직접 입력 
    const _input = document.querySelector(`.payment .modal-content .modal-body .top .content.${curType} .payment_amount input.${curType}_input`);
    const value = _input.value.replace(/,/g, '');
    
    if(targetValue == undefined) return;
    _input.focus();
    if(targetValue == '←'){
      _input.value = setReplaceNumberPad(value.slice(0, -1));
    }
    if(targetValue == 'C'){
      _input.value = '';
    }
    if(targetValue != '←' && targetValue != 'C'){
      if(curType != 'cash' && curType != 'addition') {
        _input.value = Math.min(Number(setReplaceNumberPad(Number(value) + targetValue)
                        .replace(/,/g, '')),total)
                        .toLocaleString();
        
        
      }else{
        _input.value = Number(setReplaceNumberPad(value + targetValue).replace(/,/g, '')).toLocaleString();
        
      }
    }
    if(curType == 'direct'){ // 할인 원

      document.querySelector('.split_payment_amount span').innerHTML = `${_input.value}원`
    }
    if(curType == 'percent'){ // 할인 페선트
      _input.value = Math.min(Number(_input.value.replace(/,/g, '')), 100);
      const discount = (Number(_input.value)/100)*total;
      payment_history.discount = discount;
      document.querySelector('.split_payment_amount span.percent').innerHTML = `${(total-discount).toLocaleString()}원`
    }
    changePaymentAmount(curType, _input)

    if(curType == 'won'){
      document.querySelector('.split_payment_amount span.won').innerHTML = `${(total-_input.value.replace(/,/g, '')).toLocaleString()}원`
    }
  }
  if(curType == 'dutch'){ // 더치 페이
    const _input = document.querySelector('.payment .modal-content .modal-body .top .content .dutch_content .count_btns span');
    const value = _input.innerText;

    if(targetValue == undefined) return;
    _input.focus();

    
    if(value == '1' && targetValue != '0' && targetValue != '1' && targetValue != '←' && targetValue != 'C'){
      _input.innerText = targetValue;
    }else{
      if(targetValue == '←'){
        const newValue = setReplaceNumberPad(value.slice(0, -1));
        _input.innerText = newValue === "" ? "1" : newValue;
      }
      if(targetValue == 'C'){
        _input.innerText = '1';
      }
      if(targetValue != '←' && targetValue != 'C'){
        _input.innerText = setReplaceNumberPad(value + targetValue);
      }
    }
    
    payment_history.payment_history.totalDutch = Number(_input.innerText);
    const _dutch = document.querySelector('.payment .modal-content .modal-body .top .content.dutch .split_payment_amount span.dutch');
    const totalPrice = document.querySelector('.receive_amount').dataset.price;
    payment_history.payment_history.dutchPrice = Number((totalPrice/payment_history.payment_history.totalDutch).toFixed(0))
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

  if(type != 'cash' && type != 'addition'){
    curValue = String(Math.min(Number(curValue.replace(/,/g, '')),total));
  }
  event.target.value = curValue.replace(/[^0-9]/g, '').toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  changePaymentAmount(type, event.target)
}

// 가격 입력 창에 값 변경될 경우
const changePaymentAmount = (type, input) => {
  if(type=="direct"){}
  if(type=="dutch"){}
  if(type=="won"){
    
  }
  if(type=="percent"){}
  if(type=="cash"){
    const value = Number(input.value.replace(/,/g, ''));
    document.querySelector('.cash_amount span').innerHTML = `${value.toLocaleString()}원`
    document.querySelector('.change_amount span').innerHTML = `${(value - payment_history.curPaymentPrice).toLocaleString()}원`
  }
  // 단위 위치 변경
  const _span = input.nextElementSibling;
  _span.style.left = `${15 + calculateTextWidth(input.value)}px`
}

// 더치 페이 - 클릭 시
const clickMinusCountBtn = (event) => {
  const _input = document.querySelector('.payment .modal-content .modal-body .top .content .dutch_content .count_btns span');
  const value = Number(_input.innerText);
  if(value <= 1) return
  _input.innerText = String(value - 1);
  payment_history.payment_history.totalDutch = value - 1;
  const _dutch = document.querySelector('.payment .modal-content .modal-body .top .content.dutch .split_payment_amount span.dutch');
  const totalPrice = document.querySelector('.receive_amount').dataset.price;
  payment_history.payment_history.dutchPrice = Number((totalPrice/payment_history.payment_history.totalDutch).toFixed(0))
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
  payment_history.payment_history.dutchPrice = Number((totalPrice/payment_history.payment_history.totalDutch).toFixed(0))
  _dutch.innerHTML = `${payment_history.payment_history.dutchPrice.toLocaleString()}원 x ${payment_history.payment_history.totalDutch}`
  
}

// 현금 결제 클릭 시
const clickCashPayment = (event) => {
  openModalFun(event)
  const _modal = document.querySelector('.modal');
  const _modalTitle = document.querySelector('.modal-content h1');
  const _modalBody = document.querySelector('.modal-content .modal-body');
  console.log('payment_history,',)
  const totalPrice = payment_history.orderTotalPrice + payment_history.extra_charge;
  const receivedTotalPrice = payment_history.payment.reduce((accumulator, item) => accumulator + item.price, 0);
  
  const dicountPercent = (payment_history.discount/totalPrice) * 100
  console.log(totalPrice, payment_history.discount, dicountPercent)

  _modalTitle.innerHTML = '현금 결제'
  let html = `
    <div class="top ">
      <div class="content cash" data-total="94000" data-type="cash">
        <div class="receive_amount">
          <h3>받을 금액</h3>
          <span>${payment_history.curPaymentPrice.toLocaleString()}원</span>
        </div>
        <div class="direct_content">
          <div class="payment_amount">
            <h3>결제 금액</h3>
            <input class="direct_input" type="text" oninput="updatePaymentAmount(event)"/>
            <span class="direct_input">원</span>
            <input class="percent_input" type="text" oninput="updatePaymentAmount(event)" />
            <span class="percent_input">%</span>
            <input class="won_input" type="text" oninput="updatePaymentAmount(event)" />
            <span class="won_input">원</span>
            <input class="cash_input" type="text" value="" oninput="updatePaymentAmount(event)" />
            <span class="cash_input">원</span>
          </div>
        </div>
        <div class="cash_amount ">
          <h3>현금 결제 금액</h3>
          <span>0원</span>
        </div>
        <div class="change_amount ">
          <h3>거스름 돈</h3>
          <span>0원</span>
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
      <button onclick="clickCashPaymentCompleted(event)">결제 완료</button>
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
    if(data.is_finished){
      document.querySelector('.modal').remove()
      createCompletedPaymentModal(event, 'CASH');
    }else{
      location.reload();
    }
  }
  fetchData(`/pos/payment_history/${lastPath}`, 'POST', data, onSuccess)

  // 성공 모달 알림
  // createCompletedPaymentModal(event, 'CASH');
}

const clickCardPayment = (event) => { // 카드 결제 클릭 시
  const type = 2 // CARD
  const data = setPayment(type);
  const onSuccess = (data) => {
    console.log(data);
    if(data.is_finished){
      document.querySelector('.modal')?.remove();
      createCompletedPaymentModal(event, 'CARD');
    }else{
      location.reload();
    }
  }
  console.log(data)
  fetchData(`/pos/payment_history/${lastPath}`, 'POST', data, onSuccess)
  
}


// 결제 성공 모달
const createCompletedPaymentModal = (event, type) => {
  openModalFun(event)
  const _modal = document.querySelector('.modal');
  const _modalTitle = document.querySelector('.modal-content h1');
  const _modalBody = document.querySelector('.modal-content .modal-body');
  _modal.classList.add('success_payment')
  _modalTitle.innerHTML = ''
  let html = `
    <div class="top ">
      <i class="ph-fill ph-hands-clapping"></i>
      <h2>결제 완료</h2>
      <span>${type == 'CASH' ? `현금` : `카드`} 결제가 완료되었습니다.</span>
    </div>
    <div class="bottom">
      <button class="close" onclick="window.location.href='/pos/tableList'">확인</button>
    </div>
  `
  _modalBody.innerHTML = html;
  setPayment(type == 'CASH' ? 1 : 2)
}

const setOrderList = () => { // 결제 전 주문 내역 정리
  const items = deepCopy(setBasketData(order_history));
  return order_list = items.map((item)=>{
    delete item.data.id;
    item.data.options.forEach((option)=>{
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
    payment : payment,
    order_list: order_list,
    total_price : total_price,
    first_order_time : first_order_time

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