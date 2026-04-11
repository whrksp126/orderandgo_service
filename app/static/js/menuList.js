let menuData;
let cachingData = null;
let basket = new Array;
let currentMenu = null;
let currentOptionModalMenu = null; // 모달에서 사용 중인 임시 메뉴 객체
let menuAllData = [];
let order_history = [];
let cancel_order_list = [];
let indexData = {
  main: 0,
  sub: 0,
  page: 0
}

// Socket initialization, pos_login, and staff_call_notification are now handled in common.js

// common.js에서 주문 알림 시 호출되는 콜백
function onOrderUpdate(data) {
  // 현재 보고 있는 테이블의 주문이라면 주문 내역 새로고침
  if (data.table_id == lastPath) {
    initGetTableOrderList();
  }
}
// // 메뉴판 메뉴 리스트 가져오기
// fetch(`/pos/get_menu_list/${lastPath}`, {
//   method: 'GET',
// })
// .then(response => response.json())
// .then(data => {
//   // 받은 데이터 처리
//   console.log(data);
//   menuData = data;
//   createHtml(data);
// })
// .catch(error => {
//   console.error('Error:', error);
// });
// 메뉴판 메뉴 리스트 가져오기
const initGetMenuList = async () => {
  const url = `/pos/get_menu_list`;
  const method = 'GET';
  const fetchData = {};
  const result = await fetchDataAsync(url, method, fetchData);
  console.log(result)
  menuData = result;
  createHtml(result);
}
initGetMenuList();

// 테이블 주문 내역 가져오기
const initGetTableOrderList = async () => {
  const url = `/pos/get_table_order_list/${lastPath}`;
  const method = `GET`;
  const fetchData = {};
  const result = await fetchDataAsync(url, method, fetchData);
  if (result.length != 0) {
    const _orderListBtns = document.querySelectorAll('.basket_container > .count_btns button.order_history, .basket_container > .count_btns button.new_order')
    _orderListBtns.forEach(btn => btn.dataset.active = true);
  }
  order_history = result.map((order) => ({
    id: order.id,
    order_id: order.order_id,
    masterName: setMasterName(order),
    name: order.name,
    price: order.price,
    count: 1,
    options: order.options,
  }))
}
initGetTableOrderList();
// // 테이블 주문 내역 가져오기
// fetch(`/pos/get_table_order_list/${lastPath}`, {
//   method: 'GET',
// })
// .then(response => response.json())
// .then(data => {
//   // 받은 데이터 처리
//   console.log(data)
//   if(data.length != 0){
//     const _orderListBtns = document.querySelectorAll('.basket_container > .count_btns button.order_history, .basket_container > .count_btns button.new_order')
//     _orderListBtns.forEach(btn => btn.dataset.active = true);
//   }
//   order_history=data.map((order)=>({
//     id: order.id,
//     order_id : order.order_id,
//     masterName : setMasterName(order),
//     name: order.name,
//     price: order.price,
//     count: 1,
//     options: order.options,
//   }))

// })
// .catch(error => {
//   console.error('Error:', error);
// });

// 주문내역 버튼 클릭 시
const clickOrderHistoryBtn = (event) => {
  document.querySelector('.basket_container .count_btns').innerHTML = posMenuListOrderListTopBtnsHtml();

  const _orderHistoryBtn = event.currentTarget;
  _orderHistoryBtn.dataset.check = true;
  const _basketContainer = document.querySelector('.basket_container');
  _basketContainer.dataset.type = "order_list";
  changeOrderHtml(setBasketData(order_history))
  const _countBtns = document.querySelectorAll('.count_btns button.minus, .count_btns button.plus, .count_btns button.delete');
  _countBtns.forEach(btn => btn.dataset.active = false);
  closeOptionModal();

  const _orderBtn = document.querySelector('.order_btns ul li.order button');
  _orderBtn.innerHTML = `주문취소`;
  document.querySelector('.order_btns ul li.order').dataset.iscancel = true;
}

// 장바구니 버튼 클릭 시
const clickBasketBtn = (event) => {
  document.querySelector('.basket_container .count_btns').innerHTML = posMenuListBasketTopBtnsHtml();

  changeBasketHtml(setBasketData(menuAllData));
  const _basketContainer = document.querySelector('.basket_container');
  _basketContainer.dataset.type = "basket";
  const _orderHistoryBtn = document.querySelector('.basket_container > .count_btns button.order_history');

  _orderHistoryBtn.dataset.check = false;
  const _countBtns = document.querySelectorAll('.count_btns button.minus, .count_btns button.plus, .count_btns button.delete');
  _countBtns.forEach(btn => btn.dataset.active = false);
  closeOptionModal();

  const _orderBtn = document.querySelector('.order_btns ul li.order button');
  _orderBtn.innerHTML = `주문하기`;
  document.querySelector('.order_btns ul li.order').dataset.iscancel = false;
}


// 메뉴판 HTML 만들기
const createHtml = (menuPageData) => {
  console.log('menuPageData', menuPageData);

  const _mainCatgory = document.querySelector('main section nav.main ul');
  _mainCatgory.innerHTML = menuPageData.map((data, index) => `
    <li data-id="${data.categoryId}" data-state="${index == indexData.main ? 'active' : ''}">
      <button onclick="changeMenuCategory(event, ${index})">${data.category}</button>
    </li>
  `).join('');

  const _subCatgory = document.querySelector('main section nav.sub ul');
  const subCategoryData = menuPageData[indexData.main].subCategoryList;
  _subCatgory.innerHTML = subCategoryData.map((data, index) => `
    <li data-id="${data.subCategoryId}" data-state="${index == indexData.sub ? 'active' : ''}">
      <button onclick="changeMainMenuCategory(event, ${index})">${data.subCategory}</button>
    </li>
  `).join('');

  const _menuList = document.querySelector('main section article .items');
  const menuListData = subCategoryData[indexData.sub]?.pageList[indexData.page]?.menuList ?? [];
  _menuList.innerHTML = changeMenuHtml(menuListData)
  _menuList.setAttribute('data-page', indexData.page);

  const _article = document.querySelector('main section article')
  const maxPageIndex = menuData[indexData.main].subCategoryList[indexData.sub].pageList.length - 1;
  _article.classList.remove('hasNextPage');
  _article.classList.remove('hasPrevPage');
  if (0 < indexData.page) { _article.classList.add('hasPrevPage') };
  if (indexData.page < maxPageIndex) { _article.classList.add('hasNextPage') };
}

// 페이지 변경 클릭 시
const clickChageMenuListPageBtn = (event, type) => {
  const maxPageIndex = menuData[indexData.main].subCategoryList[indexData.sub].pageList.length - 1;
  if (type == 'prev') indexData.page -= 1;
  if (type == 'next' && indexData.page < maxPageIndex) indexData.page += 1;
  createHtml(menuData);
}

// 메뉴 카테고리 변경
const changeMenuCategory = (event, index) => {
  indexData.main = index;
  indexData.sub = 0;
  indexData.page = 0;
  createHtml(menuData);
}

// 서브 카테고리 변경
const changeMainMenuCategory = (event, index) => {
  indexData.sub = index;
  indexData.page = 0;
  createHtml(menuData);
}

// 메뉴 html 변경
const changeMenuHtml = (menus) => {
  menus.sort((a, b) => a.position - b.position);
  const forArray = Array.from({ length: 24 }, () => false);
  menus.forEach((menu) => forArray[menu.position - 1] = menu);
  return forArray.map((menu) => `
    ${menu == false ? `
      <button class="menu item hidden"></button>`
      : `
      <button class="menu item" data-id="${menu.menuId}" onclick="clickMenu(event)">
        <div class="title">
          <h2 class="ellipsis">${menu.menu}</h2>
        </div>
        <span class="price">${menu.price.toLocaleString()}원</span>
      </button>
    ` }
  `).join('');
}



// 메뉴 클릭 시
const clickMenu = (event) => {
  clickBasketBtn();
  const menuId = event.currentTarget.dataset.id;
  const menu = getMenuData(menuId);

  // 옵션이 있으면 모달 오픈
  if (menu.optionList && menu.optionList.length > 0) {
    openOptionModal(menu);
  } else {
    // 옵션 없으면 바로 추가
    addToBasketDirectly(menu);
  }
}

// 옵션 모달 열기
const openOptionModal = (menu) => {
  const modal = document.getElementById('optionModal');
  document.getElementById('optionMenuName').innerText = menu.menu;
  document.getElementById('optionMenuPrice').innerText = menu.price.toLocaleString() + '원';

  const descEl = document.getElementById('optionMenuDescription');
  if (menu.mainDescription && menu.mainDescription.trim()) {
    descEl.innerText = menu.mainDescription;
    descEl.style.display = 'block';
  } else {
    descEl.innerText = '';
    descEl.style.display = 'none';
  }

  // 모달용 임시 객체 초기화
  currentOptionModalMenu = {
    id: menu.menuId,
    name: menu.menu,
    price: menu.price,
    count: 1,
    options: [],
    // imageUrl: ... POS는 이미지 없음
  };

  // 옵션 리스트 렌더링
  renderOptionItems(menu);

  modal.classList.add('active');
}

// 옵션 모달 닫기
const closeOptionModal = () => {
  document.getElementById('optionModal').classList.remove('active');
  currentOptionModalMenu = null;
}

// 옵션 아이템 렌더링
const renderOptionItems = (menu) => {
  const groupsContainer = document.getElementById('optionGroups');

  if (!menu.optionList || menu.optionList.length === 0) {
    groupsContainer.innerHTML = '';
    return;
  }

  groupsContainer.innerHTML = menu.optionList.map(group => {
    const isSingle = group.option_type === 'REQUIRED_SINGLE' || group.option_type === 'OPTIONAL_SINGLE';

    return `
      <div class="option-group">
          <div class="group-header">
          <h4>${group.name}</h4>
          ${group.option_type === 'REQUIRED_SINGLE' ? '<span class="required-badge">필수</span>' : ''}
          </div>
          <div class="group-options">
          ${group.options.map(opt => {
      const isSelected = currentOptionModalMenu.options.some(o => o.id === opt.id);
      const inputType = isSingle ? 'radio' : 'checkbox';
      const iconClass = isSelected
        ? (isSingle ? 'ph-fill ph-radio-button' : 'ph-fill ph-check-square')
        : (isSingle ? 'ph ph-circle' : 'ph ph-square');

      return `
              <div class="option-item ${isSelected ? 'active' : ''}" 
                   onclick="toggleOption(${opt.id}, '${opt.name}', ${opt.price}, ${group.id}, '${group.option_type}')">
                  <div class="check-icon">
                  <i class="${iconClass}"></i>
                  </div>
                  <div class="option-info">
                  <span class="name">${opt.name}</span>
                  <span class="price">+${opt.price.toLocaleString()}원</span>
                  </div>
              </div>
              `;
    }).join('')}
          </div>
      </div>
      `;
  }).join('');
}

// 옵션 토글
const toggleOption = (id, name, price, groupId, type) => {
  const item = { id, name, price, count: 1, groupId, type };

  if (type === 'REQUIRED_SINGLE' || type === 'OPTIONAL_SINGLE') {
    // 같은 그룹의 기존 선택 제거
    const existingIdx = currentOptionModalMenu.options.findIndex(o => o.groupId === groupId);
    if (existingIdx > -1) {
      const existing = currentOptionModalMenu.options[existingIdx];
      currentOptionModalMenu.options.splice(existingIdx, 1);

      if (existing.id === id && type === 'OPTIONAL_SINGLE') {
        // 이미 선택된거 다시 클릭시 해제 (Optional인 경우)
        // Required는 해제 불가 (다른거 선택해야함) -> UI UX상 라디오버튼은 클릭시 해제되지 않는게 일반적이나 여기선 토글 로직 유지
        // 여기서는 렌더링 다시하고 리턴
        renderOptionItems(getMenuData(currentOptionModalMenu.id));
        return;
      }
    }
    currentOptionModalMenu.options.push(item);
  } else {
    // 다중 선택 (MULTIPLE)
    const existingIdx = currentOptionModalMenu.options.findIndex(o => o.id === id);
    if (existingIdx > -1) {
      currentOptionModalMenu.options.splice(existingIdx, 1);
    } else {
      currentOptionModalMenu.options.push(item);
    }
  }

  renderOptionItems(getMenuData(currentOptionModalMenu.id));
}

// 모달에서 장바구니 담기
const addToCartFromModal = () => {
  const menu = getMenuData(currentOptionModalMenu.id);

  // 필수 옵션 검증
  if (menu.optionList) {
    for (const group of menu.optionList) {
      if (group.option_type === 'REQUIRED_SINGLE') {
        const hasSelection = currentOptionModalMenu.options.some(o => o.groupId === group.id);
        if (!hasSelection) {
          showToast(`'${group.name}' 옵션을 선택해주세요.`);
          return;
        }
      }
    }
  }

  // 장바구니 추가 로직
  currentOptionModalMenu.masterName = setMasterName(currentOptionModalMenu);
  menuAllData.push(currentOptionModalMenu);

  changeBasketHtml(setBasketData(menuAllData));
  const menuName = currentOptionModalMenu.name;
  closeOptionModal();
  showToast(`${menuName}이(가) 담겼습니다.`);
}

// 옵션 없는 메뉴 바로 담기
const addToBasketDirectly = (menu) => {
  const newItem = {
    id: menu.menuId,
    name: menu.menu,
    price: menu.price,
    count: 1,
    options: [],
  };
  newItem.masterName = setMasterName(newItem);
  menuAllData.push(newItem);

  changeBasketHtml(setBasketData(menuAllData));
  showToast(`${newItem.name}이(가) 담겼습니다.`);
}



// 옵션 상자 외부 클릭 시 옵션 상자 닫기 (모달 오버레이 클릭 시 닫기)
window.onclick = function (event) {
  const modal = document.getElementById('optionModal');
  if (event.target == modal) {
    closeOptionModal();
  }
}




// 카테고리id, 메뉴id 로 메뉴 찾기
const getMenuData = (menuId) => {
  const pageMenuList = menuData[indexData.main].subCategoryList[indexData.sub].pageList[indexData.page].menuList;
  return pageMenuList.find((menu) => menu.menuId == menuId);
};

// Unused functions removed: getMenuOptionData, showMenuOptionHtml, createMenuOptionsHtml, setMenuDisabled, resetMenuBackground, clickMenuOption



// clickMenuOption 제거됨


// 장바구니 아이템 클릭 시
const clickBasketMenu = (event) => {
  const __basketMenu = document.querySelectorAll('.basket_container .basket li > div');
  const target = event.currentTarget;
  __basketMenu.forEach((_basketMenu) => {
    _basketMenu.classList.remove('active');
  })
  target.classList.add('active');
  const _countBtns = document.querySelectorAll('.count_btns button.minus, .count_btns button.plus, .count_btns button.delete');
  _countBtns.forEach(btn => btn.dataset.active = true);
  closeOptionModal();
}

// 주문내역 아이템 클릭 시
const clickOrderMenu = (event) => {

  const __basketMenu = document.querySelectorAll('.basket_container .basket li');
  const target = event.currentTarget;
  __basketMenu.forEach((_basketMenu) => {
    _basketMenu.classList.remove('active');
  })
  target.classList.add('active');
  const _countBtns = document.querySelectorAll('.count_btns button.minus, .count_btns button.plus, .count_btns button.delete');
  _countBtns.forEach(btn => btn.dataset.active = true);
  closeOptionModal();

}

// 장바구니 - 클릭 시
const minusBasketMenu = (event) => {
  if (menuAllData.length == 0) return;
  const basketItems = document.querySelectorAll('.basket li');
  let menuIndex;
  menuIndex = Array
    .from(basketItems)
    .findIndex(el => el.querySelector('div').classList.contains('active'))
  if (menuIndex == -1) {
    menuIndex = Array
      .from(basketItems)
      .findIndex((el) => el.querySelector('div.active[data-type="menu_option"]') != undefined)
  }

  const target = document.querySelector('.basket li div.active');
  const targetType = target.dataset.type;
  const pargetEl = target.closest('li').querySelector('[data-type="menu"]')
  const masterName = targetType == "menu" ? target.dataset.master : pargetEl.dataset.master;

  let optionIndex = undefined;

  if (targetType == 'menu') {
    const dataIndex = menuAllData.findIndex(data => data.masterName == masterName)
    menuAllData.splice(dataIndex, 1);
  }
  if (targetType == 'menu_option') {
    const filterData = menuAllData
      .filter(data => data.masterName == masterName);
    optionIndex = filterData[0].options
      .findIndex(option => Number(option.id) == Number(target.dataset.id));
    if (filterData[0].options[optionIndex].count > 1) {
      filterData.forEach(({ options }) => options[optionIndex].count -= 1);
    } else {
      filterData.forEach((data) => data.options.splice(optionIndex, 1))
    }
  }
  menuAllData.forEach(data => data.masterName = setMasterName(data))
  changeBasketHtml(setBasketData(menuAllData))
  maintainActive(targetType, menuIndex, optionIndex);
  closeOptionModal();

}

// 주문내역에서 '-' 클릭 시
const minusOrderListMenu = () => {
  const basketItems = document.querySelectorAll('.basket li');
  let menuIndex;
  menuIndex = Array
    .from(basketItems)
    .findIndex(el => el.classList.contains('active'))
  const target = document.querySelector('.basket li.active');
  const dataList = order_history.filter((order) => order.masterName == target.dataset.master);
  console.log('dataList,', dataList);
  const targetCancelDataList = cancel_order_list.filter((data) => data.masterName == dataList[0].masterName);
  console.log(targetCancelDataList)
  // 두 배열 비교 후 두번째 배열에 없는 첫번 째 배열의 인덱스 낮은 값 찾기
  function findFirstUniqueIndex(arr1, arr2) {
    const setArr2 = arr2.map((arr) => arr.order_id)
    for (let i = 0; i < arr1.length; i++) {
      if (!setArr2.includes(arr1[i].order_id)) return i
    }
    return -1;
  }
  dataListIndex = findFirstUniqueIndex(dataList, targetCancelDataList)
  const maxCount = dataList.length;
  const data = dataList[dataListIndex];
  if (!stringToBooleanMap[target.dataset.iscancel]) {
    target.dataset.iscancel = true;
    const html = `<li class="cancel" data-count="0"></li>`
    target.insertAdjacentHTML("afterend", html);
  }
  const _nextLi = target.nextElementSibling;
  const count = Number(_nextLi.dataset.count) + 1;
  if (count > maxCount) {
    return
  } else {
    cancel_order_list.push(data);
    _nextLi.dataset.count = count;
    const html = `
      <div 
        data-id="${data.id}" 
        data-type="menu"
        data-count="${count}" 
        data-master="${data.masterName}" 
        class="menu cancel" 
        >
        <div class="count"><span>${count}</span></div>
        <h2>${data.name}</h2>
        <span class="price">-${(data.price * count).toLocaleString()}원</span>
      </div>
      ${data.options.map((option) => `
      <div data-id="${option.id}" data-type="menu_option" class="menu_option">
        <div class="option_name_count">
          <h2>${option.name}</h2>
          <span>x</span>
          <span>${option.count}</span>
        </div>
        <span class="price">-${(option.price * count).toLocaleString()}원</span>
      </div>
      `).join('')}
    `
    _nextLi.innerHTML = html;
  }
}
// 주문내역에서 '+' 클릭 시
const plusOrderListMenu = () => {
  const basketItems = document.querySelectorAll('.basket li');
  let menuIndex;
  menuIndex = Array
    .from(basketItems)
    .findIndex(el => el.classList.contains('active'))
  const target = document.querySelector('.basket li.active');
  const dataList = order_history.filter((order) => order.masterName == target.dataset.master);
  const data = dataList[0];
  if (!stringToBooleanMap[target.dataset.iscancel]) return;
  const _nextLi = target.nextElementSibling;
  if (!_nextLi.classList.contains('cancel')) return;
  const count = Number(_nextLi.dataset.count) - 1;
  const index = cancel_order_list.findIndex(order => order.masterName == target.dataset.master);
  if (index !== -1) {
    cancel_order_list.splice(index, 1);
  }
  if (count == 0) { // cancel 제거
    target.dataset.iscancel = false;
    _nextLi.remove();
  } else { // count -1; 
    _nextLi.dataset.count = count;
    const html = `
      <div 
        data-id="${data.id}" 
        data-type="menu"
        data-count="${count}" 
        data-master="${data.masterName}" 
        class="menu cancel" 
        >
        <div class="count"><span>${count}</span></div>
        <h2>${data.name}</h2>
        <span class="price">-${(data.price * count).toLocaleString()}원</span>
      </div>
      ${data.options.map((option) => `
      <div data-id="${option.id}" data-type="menu_option" class="menu_option">
        <div class="option_name_count">
          <h2>${option.name}</h2>
          <span>x</span>
          <span>${option.count}</span>
        </div>
        <span class="price">-${(option.price * count).toLocaleString()}원</span>
      </div>
      `).join('')}
    `
    _nextLi.innerHTML = html;
  }
}
// 주문내역에서 '삭제' 클릭 시
const deleteOrderListMenu = () => { }

// 장바구니 + 클릭 시
const plusBasketMenu = (event) => {
  const type = findParentTarget(event.currentTarget, 'aside').dataset.type
  if (type == 'order_list') {
    console.log('주문내역에서 플러스 클릭함')
  }
  if (type == 'basket') {
    if (menuAllData.length == 0) return;
    const basketItems = document.querySelectorAll('.basket li');
    let menuIndex;
    menuIndex = Array
      .from(basketItems)
      .findIndex(el => el.querySelector('div').classList.contains('active'))
    if (menuIndex == -1) {
      menuIndex = Array
        .from(basketItems)
        .findIndex((el) => el.querySelector('div.active[data-type="menu_option"]') != undefined)
    }

    const target = document.querySelector('.basket li div.active');
    const targetType = target.dataset.type;
    const pargetEl = target.closest('li').querySelector('div[data-type="menu"]')
    const masterName = targetType == "menu" ? target.dataset.master : pargetEl.dataset.master;
    let optionIndex = undefined;
    if (targetType == 'menu') {
      const data = menuAllData.find(data => data.masterName == masterName);
      menuAllData.push(deepCopy(data));
    }
    if (targetType == 'menu_option') {
      const filterData = menuAllData
        .filter(data => data.masterName == masterName);
      optionIndex = filterData[0].options
        .findIndex(option => Number(option.id) == Number(target.dataset.id));
      filterData.forEach(({ options }) => options[optionIndex].count += 1);

    }

    menuAllData.forEach(data => data.masterName = setMasterName(data))
    changeBasketHtml(setBasketData(menuAllData))

    maintainActive(targetType, menuIndex, optionIndex);
    closeOptionModal();
  }

}

// 장바구니 클릭 상태 유지
const maintainActive = (targetType, menuIndex, optionIndex) => {
  const basketItems = document.querySelectorAll('.basket li');
  const basketLength = basketItems.length;
  const _countBtns = document.querySelectorAll('.count_btns button.minus, .count_btns button.plus, .count_btns button.delete');
  if (basketLength === 0) {
    _countBtns.forEach(btn => btn.dataset.active = false);
    return
  };
  let targetEl;
  if (targetType == 'menu') {
    targetEl = basketItems[menuIndex]?.querySelector('[data-type="menu"]');
    if (targetEl == undefined) {
      while (menuIndex >= 0) {
        if (basketItems[menuIndex]?.querySelector('[data-type="menu"]') != undefined) {
          targetEl = basketItems[menuIndex].querySelector('[data-type="menu"]');
          break
        }
        menuIndex -= 1;
      }
    }
  } else {
    targetEl = basketItems[menuIndex].querySelectorAll('[data-type="menu_option"]')[optionIndex]
    if (targetEl == undefined) {
      while (optionIndex >= 0) {
        if (basketItems[menuIndex].querySelectorAll('[data-type="menu_option"]')[optionIndex] != undefined) {
          targetEl = basketItems[menuIndex].querySelectorAll('[data-type="menu_option"]')[optionIndex]
          break
        }
        optionIndex -= 1;
      }
      if (optionIndex == -1) {
        targetEl = basketItems[menuIndex].querySelector('[data-type="menu"]');
      }
    }
  }
  _countBtns.forEach(btn => btn.dataset.active = true);
  targetEl.classList.add('active');
}

// 장바구니 삭제 클릭 시
const deleteBasketMenu = (event) => {
  const type = findParentTarget(event.currentTarget, 'aside').dataset.type
  if (type == 'order_list') {
    console.log('주문내역에서 휴지통 클릭함')
  }
  if (type == 'basket') {
    if (menuAllData.length == 0) return;

    const target = document.querySelector('.basket .active');
    const targetType = target.dataset.type;
    const pargetEl = target.closest('li').querySelector('[data-type="menu"]')
    const masterName = targetType == "menu" ? target.dataset.master : pargetEl.dataset.master;

    const basketItems = document.querySelectorAll('.basket li');
    let menuIndex;
    menuIndex = Array
      .from(basketItems)
      .findIndex(el => el.querySelector('div').classList.contains('active'))
    if (menuIndex == -1) {
      menuIndex = Array
        .from(basketItems)
        .findIndex((el) => el.querySelector('div.active[data-type="menu_option"]') != undefined)
    }

    let optionIndex = undefined;
    if (targetType == 'menu') {
      menuAllData = deepCopy(menuAllData.filter(data => data.masterName != masterName))
    }
    if (targetType == 'menu_option') {
      const filterData = menuAllData
        .filter(data => data.masterName == masterName);
      optionIndex = filterData[0].options
        .findIndex(option => Number(option.id) == Number(target.dataset.id));

      filterData.forEach((data) => data.options.splice(optionIndex, 1))
    }
    menuAllData.forEach(data => data.masterName = setMasterName(data))
    changeBasketHtml(setBasketData(menuAllData))

    maintainActive(targetType, menuIndex, optionIndex);
    closeOptionModal();
  }

}

// 주문하기 클릭 시
const clickOrder = async (event) => {
  const target = findParentTarget(event.target, 'li.order');
  if (target.dataset.iscancel == 'false') { // 주문하기
    console.log('주문하기')
    const url = `/order/`;
    const method = 'POST';
    const fetchData = {
      table_id: lastPath,
      order_list: deepCopy(menuAllData),
      is_pos: true
    };
    const result = await fetchDataAsync(url, method, fetchData);
    if (result.code == 200) {
      // 프린터 연결 시 주문 슬립 자동 출력 (토스 단말기 주문 내역과 동일 포맷)
      if (window.PrinterManager && PrinterManager.isConnected()) {
        const groupedItems = setBasketData(menuAllData);
        const totalPrice = groupedItems.reduce((sum, { data, length }) => sum + (data.price || 0) * length, 0);
        const orderData = {
          tableName: window.CURRENT_TABLE_NAME || String(lastPath),
          items: groupedItems,
          total: totalPrice,
        };
        PrinterManager.printOrderSlip(orderData).catch(e => console.warn('프린터 출력 실패:', e));
      }
      showToast('주문이 완료되었습니다.');
      setTimeout(() => {
        window.location.href = '/pos/tableList';
      }, 1500);
    }
  } else { // 주문취소
    console.log('주문취소')
    const url = `/order/delete_order`;
    const method = `POST`;
    const fetchData = { order_id_list: cancel_order_list.map((data) => data.order_id) }
    const result = await fetchDataAsync(url, method, fetchData)
    if (result.code == 200) {
      window.location.href = '/pos/tableList'
    }
  }
}
// 결제하기 클릭 시
const clickPayment = (event) => {
  window.location.href = `/pos/payment/${lastPath}`
}
// Notification system variables and functions moved to common.js
