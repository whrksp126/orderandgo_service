
function getLastPath() {
  const paths = window.location.pathname.split('/');
  return paths[paths.length - 1];
}
const lastPath = getLastPath();

// url 파리미터 조회
function getTableIdFromCurrentUrl(key) {
  const currentUrl = window.location.href;
  const params = new URLSearchParams(new URL(currentUrl).search);
  const value = params.get(key);
  return value ? value : false;
}

// 비동기 fetch api
async function fetchDataAsync(url, method, data, form=false){
  let newUrl = url;
  let fetchOptions = { 
    method,
    headers: {},
  };
  if(method !== 'GET' && form) {
    const formData = new FormData();
    formData.append('json_data', JSON.stringify(data.json_data)) 
    data.form_data.forEach(({key, value})=>{
      formData.append(key, value);
    })
    fetchOptions.body = formData
  }
  if(method !== 'GET' && !form){
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(data);
  }
  if(method == 'GET' || method == 'DELETE'){
    newUrl += `?`
    for (const key in data) {
      const value = data[key];
      newUrl += `${key}=${value}&`;
    }
    console.log(newUrl);
  }
  try {
    const response = await fetch(newUrl, fetchOptions);
    if (response.ok) {
      const result = await response.json();
      return result;
    } else {
      throw new Error('문제가 발생했습니다.');
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}


// fetch api
function fetchData(url, method, data, onSuccess, form=false) {
  let newUrl = url;
  const headers = form ? {
    // 'Authorization': `Bearer ${accessToken}`,
  } : {
    // 'Authorization': `Bearer ${accessToken}`,
    'Content-Type': `application/json`
    // 필요한 경우, 추가적인 헤더를 설정할 수 있습니다.
  }
  let fetchOptions = {
    method: method,
    headers: headers,
    // GET 요청에서는 body를 제외합니다.
    // body: JSON.stringify(data),
    // 필요한 경우, 요청에 필요한 다른 옵션들을 설정할 수 있습니다.
  };

  if(method !== 'GET') {
    if(form) {
      const formData = new FormData();
      formData.append('json_data', JSON.stringify(data.json_data)) 
      data.form_data.forEach(({key, value})=>{
        formData.append(key, value);
      })

      fetchOptions.body = formData
    }else{
      fetchOptions.body = JSON.stringify(data);
    }
  }
  if(method == 'GET' || method == 'DELETE'){
    newUrl += `?`
    for (const key in data) {
      const value = data[key];
      newUrl += `${key}=${value}&`;
    }
    console.log(newUrl);
  }

  fetch(newUrl, fetchOptions)
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Something went wrong');
      }
    })
    .then(data => {
      // 성공적으로 데이터를 받아온 경우 처리합니다.
      onSuccess(data);
    })
    .catch(error => {
      // 오류가 발생한 경우 처리합니다.
      console.error(error);
    });
}

// 타겟의 부모요소 중 특정 부모가 있는지 찾아서 리턴함
const findParentTarget = (targetEl, parent) => {
  return targetEl.closest(parent);
}

// 문자열 불리언 
const stringToBooleanMap = {
  "true": true,
  "false": false
};


// form tag 내부 데이터 Object 만들기
const getData = (elements) =>{
  const data = {};
  elements.forEach((element, index)=>{
  
    const key = element.dataset.title;
    let value = element.value; 
    if(element.type == 'checkbox'){
        value = element.checked;
    }
    data[key] = value;
  })
  return data;
}

// 깊은 복사
function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// uri 데이터를 blob 데이터로 변환
const getUriToBlobToFile = (dataURL, fileName) => {
  const byteString = atob(dataURL.split(',')[1]);
  const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }

  return new Blob([arrayBuffer], { type: mimeString });
}
// 입력 받은 텍스트 길이 계산하기
function calculateTextWidth(text) {
  const hiddenSpan = document.createElement('span');
  hiddenSpan.className = 'hiddenSpan';
  hiddenSpan.textContent = text;
  document.body.appendChild(hiddenSpan);
  const textWidth = hiddenSpan.offsetWidth;
  document.body.removeChild(hiddenSpan);
  return textWidth;
}

// 시간 최신화
function displayCurrentDateTime() {
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const formattedDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}(${days[now.getDay()]})`;
  const formattedTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const formattedDateTime = `${formattedDate} ${formattedTime}`;
  const _curTime = document.querySelector('header .center .header_info .cur_time');
  if(_curTime){
    _curTime.textContent = formattedDateTime;
    // 다음 업데이트를 위해 남은 시간을 계산
    const secondsUntilNextUpdate = 60 - now.getSeconds();
    setTimeout(displayCurrentDateTime, secondsUntilNextUpdate * 1000);
  }
}
displayCurrentDateTime();

function historyBack(event){
  location.href=`${event.currentTarget.dataset.href}${lastPath}`
}


// 모달 기본 엘리먼트 추가
const openDefaultModal = (isBackClose=true) => {
  removeModal();
  document.querySelector('body').insertAdjacentHTML('beforeend', defaultModalHtml());
  const _modal = document.querySelector('.modal');
  const _modal_content = document.querySelector('.modal_content');
  const _modal_top = document.querySelector('.modal_top');
  const _modal_middle = document.querySelector('.modal_middle');
  const _modal_bottom = document.querySelector('.modal_bottom');  
  if(isBackClose)_modal.addEventListener('click', clickHandler);

  return { 
    container : _modal, 
    content: _modal_content, 
    top : _modal_top, 
    middle : _modal_middle, 
    bottom : _modal_bottom 
  }
}

const getDefaultModal = () => {
  const _modal = document.querySelector('.modal');
  const _modal_content = document.querySelector('.modal_content');
  const _modal_top = document.querySelector('.modal_top');
  const _modal_middle = document.querySelector('.modal_middle');
  const _modal_bottom = document.querySelector('.modal_bottom');  
  return { 
    container : _modal, 
    content: _modal_content, 
    top : _modal_top, 
    middle : _modal_middle, 
    bottom : _modal_bottom 
  }
}

// 모달 삭제
const removeModal = () => {
  const _modal = document.querySelector('.modal');
  if(_modal){
    _modal.removeEventListener('click', clickHandler);
    document.querySelector('.modal').remove();
  }
}

// 모달 배경 클릭 시 닫기(이벤트 제거)
const clickHandler = (event) => {
  const target = event.target; 
  const isClose = findParentTarget(target, '.close');
  const isBackground = target.classList.contains('modal');
  if (isBackground || isClose) removeModal(clickHandler);
};

// 모달 기본 틀
const defaultModalHtml = () => `
  <div class="modal show">
    <div class="modal_content">
      <div class="modal_top"></div>
      <div class="modal_middle"></div>
      <div class="modal_bottom"></div>
    </div>
  </div>
`

// 모달 TOP
const modalTopHtml = (title, hasX=false) => {
  return `
    <h1>${title}</h1>
    <i class="ph ph-x close"></i>
  `
}
// 모달 BOTTOM AND
const modalBottomHtml = (btns=null) => {
  // const btns = [
  //   {class: '',text: '', fun: ''},
  //   {class: '',text: '', fun: ''}
  // ]
  return `
    ${btns != null ?`
    <div class="buttons">
      ${btns.map((btn)=>`
      <button class="${btn.class}" ${btn.fun}>${btn.text}</button>
      `).join('')}
    </div>
    `:``}
  `
}


// 모달 배경 및 닫기 클릭 시 모달 닫기
window.onclick = function (event) {
  if (event.target.id == 'modal' || event.target.closest('.close') != undefined) {
    const _modal = document.querySelector(".modal");
    _modal?.classList.remove("show");
    _modal?.remove();
  }
}

// 버튼을 클릭하면 모달 열기
const openModalFun = (event) => {
  event.preventDefault();
  document.querySelector('body').insertAdjacentHTML('beforeend','<div id="modal" class="modal"></div>')

  const _modal = document.getElementById('modal')
  _modal.innerHTML = common_modal_html
  _modal.classList.add("show");

}

// 모달 기본 틀 HTML
const common_modal_html = `
  <div class="modal-content">
      <div class="modal-top">
          <h1>모달 제목</h1>
          <i class="ph ph-x close"></i>
      </div>
      <div class="modal-body">
          <p>모달 body</p>
      </div>
  </div>
`

// 페이지 변경 버튼 html 만들기 
const createPageNationBtnHtml = (event) => {
  console.log('화살표 만듬')
  const _article = document.querySelector('main section article');
  let html = `
  <button class="change_page_btn prev_page_btn" onclick="clickChagePageBtn(event, 'prev')">
    <i class="ph ph-caret-left"></i>
  </button>
  <button class="change_page_btn next_page_btn" onclick="clickChagePageBtn(event, 'next')">
    <i class="ph ph-caret-right"></i>
  </button>
  `
  _article.insertAdjacentHTML('beforeend',html)
}

// 페이지 변경 버튼 클릭 시
const clickChagePageBtn = (event, type) => {
  const _article = document.querySelector('main section article')
  const _table = document.querySelector('main section article .items');
  const mainData = lastPath === 'tableList' ? tableData : menuData;
  const curPageIndex = Number(_table.dataset.page);
  const curCategoryId = document.querySelector('main section nav ul li[data-state="active"]').dataset.id;
  let pageLen;
  if(cachingData != null) {
    pageLen = cachingData.find((category)=>category.categoryId == Number(curCategoryId)).pageList.length;
  }else {
    pageLen = mainData.find((category)=>category.categoryId == Number(curCategoryId)).pageList.length;
  }

  
  let newPageIndex
  console.log(type, curPageIndex)
  if(type == 'prev' && curPageIndex > 0){
    newPageIndex = curPageIndex - 1;
  }
  if(type == 'next' && curPageIndex < pageLen-1){
    newPageIndex = curPageIndex + 1;
  }
  if(newPageIndex == undefined) return;
  let targetData;
  if(cachingData != null) {
    if(lastPath == 'tableList'){
      targetData = cachingData.find((category) =>
        category.categoryId == Number(curCategoryId)).pageList[newPageIndex].tableList
    }else {
      targetData = cachingData.find((category) =>
        category.categoryId == Number(curCategoryId)).pageList[newPageIndex].menuList
    }
  }else {
    if(lastPath == 'tableList'){
      targetData = mainData.find((category) =>
        category.categoryId == Number(curCategoryId)).pageList[newPageIndex].tableList
    }else{
      targetData = mainData.find((category) =>
        category.categoryId == Number(curCategoryId)).pageList[newPageIndex].menuList
    }
  }
  
  // const tables_html = changeTableHtml(targetData);
  const tables_html = lastPath === 'tableList' ? changeTableHtml(targetData) : changeMenuHtml(targetData);
  _table.innerHTML = tables_html; 
  _table.setAttribute('data-page', newPageIndex);
  
  _article.classList.remove('hasNextPage');
  _article.classList.remove('hasPrevPage');

  if(0 < newPageIndex){_article.classList.add('hasPrevPage')};
  if(newPageIndex < pageLen-1){_article.classList.add('hasNextPage')};
  closeOptionContainer();
}

const groupColors = [
  { num: 1, color: '#17C7FF' },
  { num: 2, color: '#A561FF' },
  { num: 3, color: '#FF61EF' },
  { num: 4, color: '#FD7043' },
  { num: 5, color: '#63E100' },
  { num: 6, color: '#FF8B02' },
  { num: 7, color: '#2779F4' },
  { num: 8, color: '#6D4BF1' },
  { num: 9, color: '#FFB803' },
  { num: 10, color: '#19CF41' },
  { num: 11, color: '#E81CEC' },
  { num: 12, color: '#18ABD9' },
  { num: 13, color: '#CCB809' },
  { num: 14, color: '#66B12A' },
  { num: 15, color: '#442D9F' },
  { num: 16, color: '#B6680C' },
  { num: 17, color: '#E34400' },
  { num: 18, color: '#5F6BDD' },
  { num: 19, color: '#2D9B66' },
  { num: 20, color: '#373579' }
]


// 메뉴 올 데이터를 이용해서 장바구니 데이터로 만들기
const setBasketData = (menus) => {
  const transformedData = [];
  const tempData = {};

  menus.forEach(item => {
    const { masterName, id, name, count, price, options } = item;
    if (tempData[masterName]) {
      tempData[masterName].length++;
    } else {
      tempData[masterName] = {
        masterName,
        length: 1,
        data: {
          id,
          name,
          count,
          price,
          options
        }
      };
    }
  });

  for (const key in tempData) {
    transformedData.push(tempData[key]);
  }

  return transformedData;
}

// 메뉴 마스터 네임 만들기
const setMasterName = (menu) => {
  let masterName = '';
  masterName = `${menu.id}_${menu.count}`;
  menu?.options.sort((a, b)=>{return b - a});
  menu?.options.forEach((option)=>{
    masterName += `_${option.id}_${option.count}`
  })
  return masterName
}

// 장바구니 html 변경
const changeBasketHtml = (datas) => {
  const _basket = document.querySelector('main aside .basket');
  html = ``;
  let totalPrice = 0;
  datas.forEach(({data, length, masterName})=>{
    totalPrice += data.price * length
    html += `
      <li>
        <div data-id="${data.id}" data-type="menu" data-count="${length}" data-master="${masterName}" class="menu" onclick="clickBasketMenu(event)">
          <div class="count"><span>${length}</span></div>
          <h2>${data.name}</h2>
          <span class="price">${(data.price * length).toLocaleString()}원</span>
        </div>
        `
        data?.options?.forEach((option)=>{
          totalPrice += option.price * option.count * length
          html +=`
          <div data-id="${option.id}" data-type="menu_option" class="menu_option" onclick="clickBasketMenu(event)">
            <div class="option_name_count">
              <h2>${option.name}</h2>
              <span>x</span>
              <span>${option.count}</span>
            </div>
            <span class="price">${(option.price * option.count * length).toLocaleString()}원</span>
          </div>
          `
        })
      html +=
        `
      </li>
    `
  })
  _basket.innerHTML = html

  const currentPage = window.location.pathname.split("/")[2];
  if(currentPage == 'menuList'){
    const _totalPrice = document.querySelector('main aside .total_price .price');
    _totalPrice.innerHTML = `${totalPrice.toLocaleString()} 원`;
  }
  if(currentPage == 'payment'){
    const _supplyPrice = document.querySelector('main aside .order_btns .supply_price');
    const _vat = document.querySelector('main aside .order_btns .vat');
    const _totalPrice = document.querySelector('main aside .order_btns .price');
    const _sectionTotalPrice = document.querySelector('main section .total_price .price');

    const vat = Math.trunc(totalPrice * 10 / 110);
    const supplyPrice = Math.trunc(totalPrice - vat);

    _supplyPrice.innerHTML = `${supplyPrice.toLocaleString()}원`;
    _vat.innerHTML = `${vat.toLocaleString()}원`;
    _totalPrice.innerHTML = `${totalPrice.toLocaleString()}원`;
    _sectionTotalPrice.innerHTML = `${totalPrice.toLocaleString()}원`;
  }
  return totalPrice;
}


// 주문내역 html 변경
const changeOrderHtml = (datas) => {
  const _basket = document.querySelector('main aside .basket');
  html = ``;
  let totalPrice = 0;
  datas.forEach(({data, length, masterName})=>{
    totalPrice += data.price * length
    html += `
      <li data-id="${data.id}" data-type="menu" data-count="${length}" data-master="${masterName}" class="menu" onclick="clickOrderMenu(event)">
        <div data-id="${data.id}" data-type="menu" data-count="${length}" data-master="${masterName}" class="menu">
          <div class="count"><span>${length}</span></div>
          <h2>${data.name}</h2>
          <span class="price">${(data.price * length).toLocaleString()}원</span>
        </div>
        `
        data?.options?.forEach((option)=>{
          totalPrice += option.price * option.count * length
          html +=`
          <div data-id="${option.id}" data-type="menu_option" class="menu_option">
            <div class="option_name_count">
              <h2>${option.name}</h2>
              <span>x</span>
              <span>${option.count}</span>
            </div>
            <span class="price">${(option.price * option.count * length).toLocaleString()}원</span>
          </div>
          `
        })
      html +=
        `
      </li>
    `
  })
  _basket.innerHTML = html

  const currentPage = window.location.pathname.split("/")[2];
  if(currentPage == 'menuList'){
    const _totalPrice = document.querySelector('main aside .total_price .price');
    _totalPrice.innerHTML = `${totalPrice.toLocaleString()} 원`;
  }
  if(currentPage == 'payment'){
    const _supplyPrice = document.querySelector('main aside .order_btns .supply_price');
    const _vat = document.querySelector('main aside .order_btns .vat');
    const _totalPrice = document.querySelector('main aside .order_btns .price');
    const _sectionTotalPrice = document.querySelector('main section .total_price .price');

    const vat = Math.trunc(totalPrice * 10 / 110);
    const supplyPrice = Math.trunc(totalPrice - vat);

    _supplyPrice.innerHTML = `${supplyPrice.toLocaleString()}원`;
    _vat.innerHTML = `${vat.toLocaleString()}원`;
    _totalPrice.innerHTML = `${totalPrice.toLocaleString()}원`;
    _sectionTotalPrice.innerHTML = `${totalPrice.toLocaleString()}원`;
  }
  return totalPrice;
}