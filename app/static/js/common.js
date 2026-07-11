
function getLastPath() {
  const paths = window.location.pathname.split('/');
  return paths[paths.length - 1];
}
let lastPath = getLastPath();

// url 파리미터 조회
function getTableIdFromCurrentUrl(key) {
  const currentUrl = window.location.href;
  const params = new URLSearchParams(new URL(currentUrl).search);
  const value = params.get(key);
  return value ? value : false;
}

// 비동기 fetch api
async function fetchDataAsync(url, method, data, form = false) {
  let newUrl = url;
  let fetchOptions = {
    method,
    headers: {},
  };
  if (method !== 'GET' && form) {
    if (data instanceof FormData) {
      fetchOptions.body = data;
    } else {
      const formData = new FormData();
      formData.append('json_data', JSON.stringify(data.json_data))
      data.form_data.forEach(({ key, value }) => {
        formData.append(key, value);
      })
      fetchOptions.body = formData
    }
  }
  if (method !== 'GET' && !form) {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(data);
  }
  if (method == 'GET' || method == 'DELETE') {
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      newUrl += newUrl.includes('?') ? '&' : '?';
      for (const key in data) {
        const value = data[key];
        newUrl += `${encodeURIComponent(key)}=${encodeURIComponent(value)}&`;
      }
      newUrl = newUrl.slice(0, -1); // 마지막 & 제거
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
function fetchData(url, method, data, onSuccess, form = false) {
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

  if (method !== 'GET') {
    if (form) {
      if (data instanceof FormData) {
        fetchOptions.body = data;
      } else {
        const formData = new FormData();
        formData.append('json_data', JSON.stringify(data.json_data))
        data.form_data.forEach(({ key, value }) => {
          formData.append(key, value);
        })

        fetchOptions.body = formData
      }
    } else {
      fetchOptions.body = JSON.stringify(data);
    }
  }
  if (method == 'GET' || method == 'DELETE') {
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
const getData = (elements) => {
  const data = {};
  elements.forEach((element, index) => {

    const key = element.dataset.title;
    let value = element.value;
    if (element.type == 'checkbox') {
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
  if (_curTime) {
    _curTime.textContent = formattedDateTime;
    // 다음 업데이트를 위해 남은 시간을 계산
    const secondsUntilNextUpdate = 60 - now.getSeconds();
    setTimeout(displayCurrentDateTime, secondsUntilNextUpdate * 1000);
  }
}
displayCurrentDateTime();

function historyBack(event) {
  location.href = `${event.currentTarget.dataset.href}${lastPath}`
}


// 모달 기본 엘리먼트 추가
const openDefaultModal = (isBackClose = true) => {
  removeModal();
  document.querySelector('body').insertAdjacentHTML('beforeend', defaultModalHtml());
  const _modal = document.querySelector('.modal');
  const _modal_content = document.querySelector('.modal_content');
  const _modal_top = document.querySelector('.modal_top');
  const _modal_middle = document.querySelector('.modal_middle');
  const _modal_bottom = document.querySelector('.modal_bottom');
  if (isBackClose) _modal.addEventListener('click', clickHandler);

  return {
    container: _modal,
    content: _modal_content,
    top: _modal_top,
    middle: _modal_middle,
    bottom: _modal_bottom
  }
}

const getDefaultModal = () => {
  const _modal = document.querySelector('.modal');
  const _modal_content = document.querySelector('.modal_content');
  const _modal_top = document.querySelector('.modal_top');
  const _modal_middle = document.querySelector('.modal_middle');
  const _modal_bottom = document.querySelector('.modal_bottom');
  return {
    container: _modal,
    content: _modal_content,
    top: _modal_top,
    middle: _modal_middle,
    bottom: _modal_bottom
  }
}

// 모달 삭제
const removeModal = () => {
  const _modal = document.querySelector('.modal');
  if (_modal) {
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
const modalTopHtml = (title, hasX = false) => {
  return `
    <h1>${title}</h1>
    <i class="ph ph-x close"></i>
  `
}
// 모달 BOTTOM AND
const modalBottomHtml = (btns = null) => {
  // const btns = [
  //   {class: '',text: '', fun: ''},
  //   {class: '',text: '', fun: ''}
  // ]
  return `
    ${btns != null ? `
    <div class="buttons">
      ${btns.map((btn) => `
      <button class="${btn.class}" ${btn.fun}>${btn.text}</button>
      `).join('')}
    </div>
    `: ``}
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
  document.querySelector('body').insertAdjacentHTML('beforeend', '<div id="modal" class="modal"></div>')

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
  _article.insertAdjacentHTML('beforeend', html)
}

// 페이지 변경 버튼 클릭 시
const clickChagePageBtn = (event, type) => {
  const _article = document.querySelector('main section article')
  const _table = document.querySelector('main section article .items');
  const mainData = lastPath === 'tableList' ? tableData : menuData;
  const curPageIndex = Number(_table.dataset.page);
  const curCategoryId = document.querySelector('main section nav ul li[data-state="active"]').dataset.id;
  let pageLen;
  if (cachingData != null) {
    pageLen = cachingData.find((category) => category.categoryId == Number(curCategoryId)).pageList.length;
  } else {
    pageLen = mainData.find((category) => category.categoryId == Number(curCategoryId)).pageList.length;
  }


  let newPageIndex
  console.log(type, curPageIndex)
  if (type == 'prev' && curPageIndex > 0) {
    newPageIndex = curPageIndex - 1;
  }
  if (type == 'next' && curPageIndex < pageLen - 1) {
    newPageIndex = curPageIndex + 1;
  }
  if (newPageIndex == undefined) return;
  let targetData;
  if (cachingData != null) {
    if (lastPath == 'tableList') {
      targetData = cachingData.find((category) =>
        category.categoryId == Number(curCategoryId)).pageList[newPageIndex].tableList
    } else {
      targetData = cachingData.find((category) =>
        category.categoryId == Number(curCategoryId)).pageList[newPageIndex].menuList
    }
  } else {
    if (lastPath == 'tableList') {
      targetData = mainData.find((category) =>
        category.categoryId == Number(curCategoryId)).pageList[newPageIndex].tableList
    } else {
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

  if (0 < newPageIndex) { _article.classList.add('hasPrevPage') };
  if (newPageIndex < pageLen - 1) { _article.classList.add('hasNextPage') };
  closeOptionContainer();
}

/**
 * 페이지 내 옵션 컨테이너 또는 모달을 닫습니다.
 */
const closeOptionContainer = () => {
  const _optionContainer = document.querySelector('.option_container');
  const _optionBackground = document.querySelector('.option_background');
  if (_optionContainer) _optionContainer.classList.remove('active');
  if (_optionBackground) _optionBackground.classList.remove('active');

  // 개별 페이지에 정의된 closeOptionModal 함수가 있으면 호출
  if (typeof closeOptionModal === 'function') {
    closeOptionModal();
  }
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
  menu?.options.sort((a, b) => { return b - a });
  menu?.options.forEach((option) => {
    masterName += `_${option.id}_${option.count}`
  })
  return masterName
}

// 장바구니 html 변경
const changeBasketHtml = (datas) => {
  const _basket = document.querySelector('main aside .basket');
  html = ``;
  let totalPrice = 0;
  datas.forEach(({ data, length, masterName }) => {
    totalPrice += data.price * length
    html += `
      <li>
        <div data-id="${data.id}" data-type="menu" data-count="${length}" data-master="${masterName}" class="menu" onclick="clickBasketMenu(event)">
          <h2>${data.name}</h2>
          <span class="quantity">${length}</span>
          <span class="price">${(data.price * length).toLocaleString()}원</span>
        </div>
        `
    data?.options?.forEach((option) => {
      totalPrice += option.price * option.count * length
      html += `
          <div data-id="${option.id}" data-type="menu_option" class="menu_option" onclick="clickBasketMenu(event)">
            <h2>${option.name}</h2>
            <span class="quantity">${option.count}</span>
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
  if (currentPage == 'menuList') {
    const _totalPrice = document.querySelector('main aside .total_price .price');
    _totalPrice.innerHTML = `${totalPrice.toLocaleString()} 원`;
  }
  if (currentPage == 'payment') {
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
  datas.forEach(({ data, length, masterName }) => {
    totalPrice += data.price * length
    html += `
      <li data-id="${data.id}" data-type="menu" data-count="${length}" data-master="${masterName}" class="menu" onclick="clickOrderMenu(event)">
        <div data-id="${data.id}" data-type="menu" data-count="${length}" data-master="${masterName}" class="menu">
          <h2>${data.name}</h2>
          <span class="quantity">${length}</span>
          <span class="price">${(data.price * length).toLocaleString()}원</span>
        </div>
        `
    data?.options?.forEach((option) => {
      totalPrice += option.price * option.count * length
      html += `
          <div data-id="${option.id}" data-type="menu_option" class="menu_option">
            <h2>${option.name}</h2>
            <span class="quantity">${option.count}</span>
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
  if (currentPage == 'menuList') {
    const _totalPrice = document.querySelector('main aside .total_price .price');
    _totalPrice.innerHTML = `${totalPrice.toLocaleString()} 원`;
  }
  if (currentPage == 'payment') {
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

// Toast Notification (Premium 3D Stack)
const showToast = (message, type = 'info') => {
  // 사운드 피드백 (성공/오류만; 정보성 토스트는 별도 이벤트음에서 처리)
  try {
    if (window.ogSound) {
      if (type === 'error') ogSound.error();
      else if (type === 'success') ogSound.success();
    }
  } catch (e) {}

  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.classList.add('toast-container');
    document.body.appendChild(container);
  }

  // 1. 기존 토스트들의 위치 및 깊이 업데이트
  const activeToasts = Array.from(container.children).filter(t => !t.classList.contains('is-leaving'));
  activeToasts.forEach((t, i) => {
    const depth = activeToasts.length - i; // 위로 갈수록 깊어짐
    const opacity = Math.max(0, 1 - (depth * 0.2));
    const scale = Math.max(0.7, 1 - (depth * 0.08));
    const translateY = depth * -55; // 위로 더 많이 밀어내어 가시성 확보
    const translateZ = depth * -40; // 뒤로 밀어내는 정도는 유지/소폭 조정

    t.style.opacity = opacity;
    t.style.transform = `translateY(${translateY}px) translateZ(${translateZ}px) scale(${scale})`;
    t.style.zIndex = activeToasts.length - depth;
  });

  // 2. 신규 토스트 생성
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // 타입별 아이콘 설정
  let iconClass = 'ph-info';
  if (type === 'success') iconClass = 'ph-check-circle';
  if (type === 'error') iconClass = 'ph-x-circle';
  if (type === 'warning') iconClass = 'ph-warning-circle';

  toast.innerHTML = `
    <i class="ph ${iconClass}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // 3. 애니메이션 트리거
  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  // 4. 자동 제거 로직 (2.5초 유지)
  setTimeout(() => {
    toast.classList.add('is-leaving');
    // 퇴장 애니메이션(0.5s) 후 요소 제거
    setTimeout(() => {
      toast.remove();
    }, 500);
  }, 2500);
}
// Socket.io 초기화 및 전역 socket 객체 설정 (socket.io.js가 로드된 경우에만)
var socket;
if (typeof io !== 'undefined') {
  socket = io.connect(location.protocol + '//' + document.domain + (location.port ? ':' + location.port : ''));

  // POS 로그인 (메인 또는 메뉴 목록 페이지일 때만 실행)
  const isPosPage = window.location.pathname.includes('/pos/');
  if (isPosPage) {
    socket.emit('pos_login', { user_type: 'pos' }, (response) => {
      // console.log('POS Login Response:', response.msg);
    });

    // 공통 주문 알림 수신
    socket.on('update_pos', function (data) {
      console.log('새로운 주문 업데이트:', data);

      const orderList = data.order_list || [];
      const tableName = data.table_name ? data.table_name : `테이블 ${data.table_id}`;

      let itemsText = "";
      let itemsHtml = "";

      if (orderList.length > 0) {
        itemsText = orderList.map(o => {
          let optStr = "";
          if (o.options && o.options.length > 0) {
            optStr = ` (${o.options.map(opt => opt.name).join(', ')})`;
          }
          return `${o.name}${optStr}`;
        }).join(', ');

        itemsHtml = orderList.map(o => {
          let optStr = "";
          if (o.options && o.options.length > 0) {
            optStr = ` (${o.options.map(opt => opt.name).join(', ')})`;
          }
          return `- ${o.name} 1개${optStr}`;
        }).join('<br>');
      }

      const text = `<b>${tableName}</b> 주문<br>${itemsHtml}`;
      const timestamp = getCurTimeFormatted();

      // 포스기 본인 주문인 경우 알림 내역 추가 및 토스트 제외
      if (data.is_pos) {
        console.log('포스기 자가 주문: 알림 생성 생략');
      } else {
        // 알림 내역에 추가
        notifications.unshift({
          id: `order_${data.table_id}_${Date.now()}`,
          text: text,
          items_text: itemsText,
          table_name: tableName,
          requestTime: timestamp,
          confirmTime: null,
          is_order: true,
          source: '테이블 오더',
        });

        showToast(`${tableName}에서 새로운 주문이 들어왔습니다.`);
        try { if (window.ogSound) ogSound.notify(); } catch (e) {}
        renderNotifications();
      }

      // 개별 페이지의 업데이트 콜백 (정의되어 있다면)
      if (typeof onOrderUpdate === 'function') {
        onOrderUpdate(data);
      }
    });

    // 공통 직원 호출 알림 수신
    socket.on('staff_call_notification', function (data) {
      console.log('직원 호출 알림:', data);

      const calls = data.calls;
      let text = '';
      let toastText = '';

      if (calls.length === 1 && calls[0].is_staff_call_only) {
        text = `<b>${data.table_name}</b>에서 직원을 호출했습니다.`;
        toastText = `${data.table_name} 직원 호출`;
      } else {
        const itemsHtml = calls.map(c => {
          if (c.use_quantity) return `- ${c.name} ${c.quantity}개`;
          return `- ${c.name}`;
        }).join('<br>');
        text = `<b>${data.table_name}</b><br>${itemsHtml}`;

        const callTexts = calls.map(c => {
          if (c.use_quantity) return `${c.name} ${c.quantity}개`;
          return `${c.name}`;
        }).join(', ');
        toastText = `${data.table_name} 직원 호출: ${callTexts}`;
      }

      if (calls.length > 0) {
        const items_text = calls.map(c => {
          if (c.use_quantity) return `${c.name} ${c.quantity}개`;
          return `${c.name}`;
        }).join(', ');
        notifications.unshift({
          id: calls[0].id,
          text: text,
          items_text: items_text,
          table_name: data.table_name,
          requestTime: data.timestamp,
          confirmTime: null
        });
      }

      showToast(toastText);
      try { if (window.ogSound) ogSound.call(); } catch (e) {}
      renderNotifications();
    });
  }
}

// 알림 데이터 (서버 연동 시 초기화)
let notifications = [];

// 이전 영업일에서 넘어온 미처리(미결제·미완료) 테이블
let carryoverItems = [];
let carryoverBusinessDay = '';
const _coEsc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 알림 사이드바 토글
const toggleNotificationSidebar = () => {
  const sidebar = document.getElementById('notificationSidebar');
  const overlay = document.getElementById('notificationOverlay');
  if (!sidebar || !overlay) return;

  if (sidebar.classList.contains('active')) {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
  } else {
    sidebar.classList.add('active');
    overlay.classList.add('active');
    renderNotifications();
  }
}

// 현재 시간 포맷 (HH:mm:ss)
const getCurTimeFormatted = () => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

// 기존 알림 내역 로드
async function loadStaffCallLogs() {
  try {
    const res = await fetch('/pos/get_staff_call_logs');
    if (res.ok) {
      const data = await res.json();
      notifications = data;
      renderNotifications();
    }
  } catch (error) {
    console.error('Load Staff Call Logs Error:', error);
  }
}

// 알림 아이템 HTML 생성
const renderNotiItem = (noti) => {
  let message = noti.text;

  // 포스기 주문은 확인 버튼 없이 바로 확인 완료 처리
  const isAutoConfirmed = noti.is_order && noti.source === '포스기';
  // 확인 완료된 직원 호출은 콤마 리스트로 표현
  if (noti.confirmTime && noti.items_text && !message.includes('직원을 호출했습니다')) {
    message = `<b>${noti.table_name}</b><br>${noti.items_text}`;
  }

  return `
    <li class="notification-item ${noti.confirmTime ? 'confirmed' : ''}" id="noti-${noti.id}">
      <div class="content">
        <div class="message">${message}</div>
        <div class="times">
          ${noti.source ? `<span class="request-time">접수: ${noti.source}</span>` : ''}
          <span class="request-time">요청: ${noti.requestTime}</span>
          ${noti.confirmTime ? `<span class="confirm-time">확인: ${noti.confirmTime}</span>` : ''}
        </div>
      </div>
      <div class="action">
        ${noti.confirmTime || isAutoConfirmed
      ? ''
      : `<button class="confirm-btn" onclick="confirmNotification('${noti.id}')">확인</button>`
    }
      </div>
    </li>
  `;
}

// 알림 목록 렌더링
const renderNotifications = () => {
  const list = document.getElementById('notificationList');
  const btnAlarm = document.querySelector('.btn_alarm');
  if (!list || !btnAlarm) return;

  // 미확인 알림 (최신순)
  const unconfirmed = notifications
    .filter(noti => !noti.confirmTime)
    .sort((a, b) => b.id - a.id);

  // Update alarm button state (헤더 벨 아이콘) — 미확인 or 이전영업일 미처리가 있으면 표시
  const pendingCount = unconfirmed.length + carryoverItems.length;
  btnAlarm.style.display = pendingCount > 0 ? '' : 'none';
  const btnIcon = btnAlarm.querySelector('i');
  if (pendingCount > 0) {
    btnAlarm.classList.add('active');
    if (btnIcon) {
      btnIcon.classList.remove('ph-bell');
      btnIcon.classList.add('ph-fill', 'ph-bell-ringing');
    }
  } else {
    btnAlarm.classList.remove('active');
    if (btnIcon) {
      btnIcon.classList.remove('ph-fill', 'ph-bell-ringing');
      btnIcon.classList.add('ph-bell');
    }
  }

  // 확인 완료 알림 (최신순)
  const confirmed = notifications
    .filter(noti => noti.confirmTime)
    .sort((a, b) => b.id - a.id);

  let html = '';

  // 이전 영업일 미처리 영역 (최상단)
  if (carryoverItems.length > 0) {
    html += renderCarryoverSection();
  }

  // 미확인 영역 항상 표시
  html += `<li class="section-header">미확인 (${unconfirmed.length})</li>`;
  if (unconfirmed.length > 0) {
    html += unconfirmed.map(noti => renderNotiItem(noti)).join('');
  } else {
    html += '<li class="no-data">미확인 내역이 없습니다.</li>';
  }

  // 확인 완료 영역 항상 표시
  html += `<li class="section-header confirmed">확인 완료</li>`;
  if (confirmed.length > 0) {
    html += confirmed.map(noti => renderNotiItem(noti)).join('');
  } else {
    html += '<li class="no-data">확인 완료 내역이 없습니다.</li>';
  }

  list.innerHTML = html;
}

// 알림 확인 처리
const confirmNotification = async (id) => {
  try {
    const res = await fetch('/store/confirm_staff_call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_id: id })
    });

    if (res.ok) {
      const noti = notifications.find(n => n.id === id);
      if (noti) {
        noti.confirmTime = getCurTimeFormatted();
        renderNotifications();
      }
    }
  } catch (error) {
    console.error('Confirm Notification Error:', error);
  }
}

// ── 이전 영업일 미처리(넘어온) 테이블 알림 ──────────────────────────────────

// 알림 사이드바 열기 (닫기는 toggle 사용)
const openNotificationSidebar = () => {
  const sidebar = document.getElementById('notificationSidebar');
  const overlay = document.getElementById('notificationOverlay');
  if (!sidebar || !overlay) return;
  sidebar.classList.add('active');
  overlay.classList.add('active');
  renderNotifications();
};

// 넘어온 테이블 목록 섹션 (전체 유지/삭제 + 개별)
const renderCarryoverSection = () => {
  let html = `
    <li class="section-header carryover-header">
      <div class="co-head-row">
        <span>이전 영업일 미처리 (${carryoverItems.length})</span>
        <div class="co-bulk">
          <button class="co-btn keep" onclick="keepAllCarryover()">전체 유지</button>
          <button class="co-btn del" onclick="deleteAllCarryover()">전체 삭제</button>
        </div>
      </div>
    </li>`;
  html += carryoverItems.map(renderCarryoverItem).join('');
  return html;
};

const renderCarryoverItem = (co) => {
  const itemsHtml = (co.items || []).map(it => `${_coEsc(it.name)} × ${it.count}`).join('<br>');
  const cook = co.pending_count > 0 ? '<span class="co-badge cook">조리 미완료</span>' : '';
  return `
    <li class="notification-item carryover-item" id="co-${co.table_id}">
      <div class="content">
        <div class="message"><b>${_coEsc(co.table_name)}</b> ${cook}<br>${itemsHtml}</div>
        <div class="times">
          <span class="request-time">최초 주문: ${_coEsc(co.first_order_time)}</span>
          <span class="request-time">총 ${co.order_count}개</span>
        </div>
      </div>
      <div class="action co-action">
        <button class="co-btn keep" onclick="keepCarryover(${co.table_id})">유지</button>
        <button class="co-btn del" onclick="deleteCarryover(${co.table_id})">삭제</button>
      </div>
    </li>`;
};

// 세션 내 '유지' 처리한 테이블 기록(재알림 방지)
const _markCarryoverKept = (tableId) => {
  try {
    const key = `og_carryover_kept_${carryoverBusinessDay}`;
    const kept = JSON.parse(sessionStorage.getItem(key) || '[]');
    if (!kept.includes(tableId)) { kept.push(tableId); sessionStorage.setItem(key, JSON.stringify(kept)); }
  } catch (e) {}
};

const keepCarryover = (tableId) => {
  _markCarryoverKept(tableId);
  carryoverItems = carryoverItems.filter(c => c.table_id !== tableId);
  renderNotifications();
};

const keepAllCarryover = () => {
  carryoverItems.forEach(c => _markCarryoverKept(c.table_id));
  carryoverItems = [];
  renderNotifications();
  showToast('모두 유지 처리했습니다.', 'success');
};

const deleteCarryover = (tableId) => {
  const co = carryoverItems.find(c => c.table_id === tableId);
  const name = co ? co.table_name : '';
  _confirmCarryoverDelete(`<b>${_coEsc(name)}</b> 테이블의 미결제·미완료 주문을 삭제할까요?`, () => _doDeleteCarryover([tableId]));
};

const deleteAllCarryover = () => {
  const ids = carryoverItems.map(c => c.table_id);
  if (!ids.length) return;
  _confirmCarryoverDelete(`넘어온 <b>${ids.length}개</b> 테이블을 모두 삭제할까요?`, () => _doDeleteCarryover(ids));
};

const _doDeleteCarryover = async (tableIds) => {
  try {
    const res = await fetch('/pos/carryover_delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_ids: tableIds })
    });
    const data = await res.json();
    if (data.code === 200) {
      carryoverItems = carryoverItems.filter(c => !tableIds.includes(c.table_id));
      renderNotifications();
      showToast('삭제했습니다.', 'success');
      if (typeof loadTableData === 'function') loadTableData(); // POS 테이블 목록 갱신
    } else {
      showToast(data.msg || '삭제에 실패했습니다.', 'error');
    }
  } catch (e) {
    showToast('삭제 처리에 실패했습니다.', 'error');
  }
};

// 삭제 확인 모달 (경고 전용 · 알림 사이드바보다 위 z-index)
const _confirmCarryoverDelete = (message, onConfirm) => {
  const old = document.getElementById('coModalOverlay');
  if (old) old.remove();
  const ov = document.createElement('div');
  ov.className = 'co-modal-overlay';
  ov.id = 'coModalOverlay';
  ov.innerHTML = `
    <div class="co-modal-box">
      <div class="co-modal-icon"><i class="ph-fill ph-warning"></i></div>
      <h3 class="co-modal-title">주문 삭제</h3>
      <p class="co-modal-msg">${message}</p>
      <p class="co-modal-note">삭제한 주문은 복구할 수 없습니다.<br>(매출에는 영향 없음)</p>
      <div class="co-modal-actions">
        <button class="co-modal-cancel">취소</button>
        <button class="co-modal-confirm">삭제</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('.co-modal-cancel').addEventListener('click', close);
  ov.querySelector('.co-modal-confirm').addEventListener('click', () => { close(); onConfirm(); });
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
};

// POS 진입 시 넘어온 테이블 조회
async function loadCarryover() {
  try {
    const res = await fetch('/pos/carryover_check');
    if (!res.ok) return;
    const data = await res.json();
    carryoverBusinessDay = data.business_day || '';
    let tables = data.tables || [];
    // 이번 세션에서 이미 '유지'한 테이블 제외 (같은 영업일 재알림 방지)
    let kept = [];
    try { kept = JSON.parse(sessionStorage.getItem(`og_carryover_kept_${carryoverBusinessDay}`) || '[]'); } catch (e) {}
    carryoverItems = tables.filter(t => !kept.includes(t.table_id));
    renderNotifications();
    if (carryoverItems.length > 0) {
      const shownKey = `og_carryover_shown_${carryoverBusinessDay}`;
      if (!sessionStorage.getItem(shownKey)) {
        sessionStorage.setItem(shownKey, '1');
        showToast(`이전 영업일 미처리 테이블 ${carryoverItems.length}개가 있습니다.`, 'warning');
        openNotificationSidebar();
      }
    }
  } catch (e) {
    console.error('carryover check error', e);
  }
}

// 초기화 시 실행 (POS 페이지용)
window.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('/pos/')) {
    loadStaffCallLogs();
    loadCarryover();
  }
});

/**
 * 주문 성공 오버레이 클래스
 */
/**
 * 테이블 오더 오버레이 클래스 (주문 완료, 환영, 이용 중, 결제 완료 등)
 */
class TableOverlay {
  constructor() {
    this.overlay = null;
    this.timerInterval = null;
    this.defaultDuration = 3;
    this.onCloseCallback = null;
    this.type = 'order-success'; // 'order-success', 'welcome', 'in-use', 'payment'
  }

  createOverlay() {
    if (document.querySelector('.table-overlay')) return;

    const html = `
            <div class="table-overlay" id="tableOverlay" onclick="tableOverlay.handleBackgroundClick()">
                <div class="timer-display" id="overlayTimer"></div>
                <button class="close-btn" id="overlayCloseBtn">
                    <i class="ph-bold ph-x"></i>
                </button>
                <div class="overlay-content">
                    <div class="icon-wrapper" id="overlayIcon">
                        <i class="ph-fill ph-check-circle"></i>
                    </div>
                    <p class="message" id="overlayMessage">주문이 완료되었습니다.</p>
                    <button class="confirm-btn" id="overlayConfirmBtn">
                        확인
                    </button>
                </div>
            </div>
        `;
    document.body.insertAdjacentHTML('beforeend', html);

    this.overlay = document.getElementById('tableOverlay');

    // 이벤트 바인딩
    document.getElementById('overlayCloseBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    document.getElementById('overlayConfirmBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
  }

  handleBackgroundClick() {
    // welcome, in-use 모드일 때는 배경 클릭 시 닫기
    if (this.type === 'welcome' || this.type === 'in-use') {
      this.hide();
    }
  }

  show(options = {}) {
    this.createOverlay();

    this.type = options.type || 'order-success';
    const duration = options.duration || this.defaultDuration;
    const showTimer = options.showTimer; // undefined면 타입에 따라 결정
    const showCloseBtn = options.showCloseBtn !== false;
    const message = options.message || this.getDefaultMessage(this.type);

    this.onCloseCallback = options.onClose || null;

    // 스타일 및 아이콘 설정
    const overlay = this.overlay;
    overlay.className = 'table-overlay active'; // reset classes
    overlay.classList.add(`type-${this.type}`);

    const iconWrapper = document.getElementById('overlayIcon');
    const icon = iconWrapper.querySelector('i');

    // 아이콘 및 기본 메시지 설정
    if (this.type === 'welcome') {
      icon.className = 'ph-fill ph-hand-waving';
    } else if (this.type === 'in-use') {
      icon.className = 'ph-fill ph-plus-circle';
    } else if (this.type === 'payment') {
      icon.className = 'ph-fill ph-smiley';
    } else { // order-success
      icon.className = 'ph-fill ph-check-circle';
    }

    // 내용 설정
    document.getElementById('overlayMessage').innerHTML = message.replace(/\n/g, '<br>');

    // 버튼/타이머 가시성 설정
    document.getElementById('overlayCloseBtn').style.display = showCloseBtn ? 'block' : 'none';
    const confirmBtn = document.getElementById('overlayConfirmBtn');
    // confirmBtn은 order-success일 때만 기본 표시, 나머지는 숨김 (디자인에 따라 조정)
    confirmBtn.style.display = (this.type === 'order-success') ? 'block' : 'none';

    const timerEl = document.getElementById('overlayTimer');

    // 타이머 디폴트 로직
    let shouldShowTimer = showTimer;
    if (shouldShowTimer === undefined) {
      if (this.type === 'order-success') shouldShowTimer = true;
      else if (this.type === 'payment') shouldShowTimer = true;
      else shouldShowTimer = false;
    }

    timerEl.style.display = shouldShowTimer ? 'block' : 'none';

    // 타이머 시작
    if (shouldShowTimer && duration > 0) {
      this.startTimer(duration);
    }
  }

  getDefaultMessage(type) {
    switch (type) {
      case 'welcome': return '환영합니다<br>주문하시려면 화면을 터치해 주세요';
      case 'in-use': return '추가 주문을 하시려면<br>화면을 터치해 주세요';
      case 'payment': return '이용해주셔서 감사합니다.<br>다음에 또 이용해주세요';
      default: return '주문이 완료되었습니다.';
    }
  }

  hide() {
    if (this.overlay) {
      this.overlay.classList.remove('active');
      this.stopTimer();

      if (this.onCloseCallback && typeof this.onCloseCallback === 'function') {
        this.onCloseCallback();
        this.onCloseCallback = null;
      }
    }
  }

  startTimer(duration) {
    this.stopTimer();
    let remaining = duration;
    const timerEl = document.getElementById('overlayTimer');

    const updateDisplay = () => {
      timerEl.innerText = `${remaining}초 후 닫힘`;
    };

    updateDisplay();

    this.timerInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        this.stopTimer();
        this.hide();
      } else {
        updateDisplay();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}

// 전역 인스턴스 생성 및 헬퍼 함수
// 전역 인스턴스 생성 및 헬퍼 함수
const tableOverlay = new TableOverlay();

const showOverlay = (options) => {
  tableOverlay.show(options);
};

// ===== 공통 커스텀 드롭다운 컨트롤러 =====

// hover / keyboard-focus 스타일 주입
(() => {
  const style = document.createElement('style');
  style.textContent = `
    section ul li .dropdown-box .dropdown-list li:hover { background: #f5f5f5; }
    section ul li .dropdown-box .dropdown-list li.focused { background: #e8f5f3; color: #1FAA9C; }
    section ul li .dropdown-box .btn-dropdown:focus { outline: none; border-color: #1FAA9C; }
    section ul li .dropdown-box .btn-dropdown:active { opacity: 0.8; }
  `;
  document.head.appendChild(style);
})();

// section 드롭다운 전체 닫기
function closeAllSectionDropdowns() {
  document.querySelectorAll('section .dropdown-list.active').forEach(list => {
    list.classList.remove('active');
    list.querySelectorAll('li.focused').forEach(li => li.classList.remove('focused'));
  });
}

// 키보드 포커스 항목 설정
function setDropdownFocusedItem(items, idx) {
  items.forEach(li => li.classList.remove('focused'));
  items[idx].classList.add('focused');
  items[idx].scrollIntoView({ block: 'nearest' });
}

// 드롭다운 버튼 클릭 토글
function clickDropDownBtn(event) {
  const _dropDownBtn = event.currentTarget;
  const _dropDownList = _dropDownBtn.nextElementSibling;
  const isOpening = !_dropDownList.classList.contains('active');

  closeAllSectionDropdowns();

  if (isOpening) {
    _dropDownList.classList.add('active');
    const currentId = _dropDownBtn.dataset.id;
    const items = Array.from(_dropDownList.querySelectorAll('li'));
    const currentIdx = items.findIndex(li => li.dataset.id == currentId);
    if (currentIdx >= 0) setDropdownFocusedItem(items, currentIdx);
  }
}

// 드롭다운 항목 선택
function clickCategory(event) {
  const _target = event.currentTarget;
  const _dropDownList = _target.closest('.dropdown-list');
  const _dropDownBox = _dropDownList.closest('.dropdown-box');
  const _dropDownBtn = _dropDownBox.querySelector('.btn-dropdown');
  _dropDownBtn.querySelector('span').textContent = _target.dataset.name;
  _dropDownBtn.dataset.id = _target.dataset.id;
  _dropDownBtn.dataset.name = _target.dataset.name;
  _dropDownList.classList.remove('active');
}

// 외부 클릭 시 닫기
document.addEventListener('click', (e) => {
  if (!e.target.closest('section .dropdown-box')) closeAllSectionDropdowns();
});

let _sectionDropdownTabbing = false;

// 키보드 컨트롤 (방향키 / Enter / Esc / Tab)
document.addEventListener('keydown', (e) => {
  const openList = document.querySelector('section .dropdown-list.active');

  if (e.key === 'Tab') {
    if (openList) {
      closeAllSectionDropdowns();
      _sectionDropdownTabbing = true;
    }
    return;
  }

  if (!openList) return;

  const items = Array.from(openList.querySelectorAll('li'));
  const focusedIdx = items.findIndex(li => li.classList.contains('focused'));

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setDropdownFocusedItem(items, focusedIdx < items.length - 1 ? focusedIdx + 1 : 0);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setDropdownFocusedItem(items, focusedIdx > 0 ? focusedIdx - 1 : items.length - 1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (focusedIdx >= 0) items[focusedIdx].click();
  } else if (e.key === 'Escape') {
    closeAllSectionDropdowns();
    openList.closest('.dropdown-box')?.querySelector('.btn-dropdown')?.focus();
  }
});

// Tab 이동 후 다음 포커스가 btn-dropdown이면 드롭다운 열기
document.addEventListener('focusin', (e) => {
  if (!_sectionDropdownTabbing) return;
  _sectionDropdownTabbing = false;
  if (e.target.classList.contains('btn-dropdown') && e.target.closest('section')) {
    const _dropDownList = e.target.nextElementSibling;
    if (!_dropDownList) return;
    _dropDownList.classList.add('active');
    const items = Array.from(_dropDownList.querySelectorAll('li'));
    const currentIdx = items.findIndex(li => li.dataset.id == e.target.dataset.id);
    if (currentIdx >= 0) setDropdownFocusedItem(items, currentIdx);
  }
});

// ===== 공통 커스텀 드롭다운 컨트롤러 끝 =====
