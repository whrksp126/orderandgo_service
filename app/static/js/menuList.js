(function() {

// =============================================
//  셸 HTML (menu_list.html의 <main> 내부)
// =============================================
var MENU_LIST_SHELL = `
  <section>
    <nav class="main">
      <ul></ul>
    </nav>
    <nav class="sub">
      <ul></ul>
    </nav>
    <article>
      <div class="menus items">
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
        <button class="menu item hidden"></button>
      </div>
      <button class="change_page_btn prev_page_btn" onclick="clickChageMenuListPageBtn(event, 'prev')">
        <i class="ph ph-caret-left"></i>
      </button>
      <button class="change_page_btn next_page_btn" onclick="clickChageMenuListPageBtn(event, 'next')">
        <i class="ph ph-caret-right"></i>
      </button>
    </article>
    <!-- 옵션 선택 모달 (POS 전용) -->
    <div class="option-modal-overlay" id="optionModal">
      <div class="option-modal pos-modal">
        <div class="right-side">
          <div class="details">
            <h2 id="optionMenuName">메뉴명</h2>
            <div class="price" id="optionMenuPrice">0원</div>
            <div id="optionMenuDescription" class="menu-description"></div>
            <div id="optionGroups"></div>
          </div>
          <div class="actions">
            <button class="cancel-btn" onclick="closeOptionModal()">취소</button>
            <button class="add-to-cart-btn" onclick="addToCartFromModal()">장바구니 담기</button>
          </div>
        </div>
      </div>
    </div>
  </section>
  <!-- 장바구니 영역 -->
  <aside class="basket_container" data-type="basket">
    <div class="count_btns top">
      <button onclick="minusBasketMenu(event)" data-active="false" class="minus">
        <i class="ph ph-minus"></i>
      </button>
      <button onclick="plusBasketMenu(event)" data-active="false" class="plus">
        <i class="ph ph-plus"></i>
      </button>
      <button onclick="deleteBasketMenu(event)" class="delete">
        <i class="ph ph-trash"></i>
      </button>
      <button onclick="clickOrderHistoryBtn(event)" data-check="false" class="order_history">
        주문내역
      </button>
    </div>
    <ul class="basket middle"></ul>
    <div class="order_btns bottom">
      <div class="total_price">
        <h2>총액</h2>
        <span class="price">원</span>
      </div>
      <div id="toastContainer" class="toast-container"></div>
      <ul>
        <li class="order" data-iscancel="false" onclick="clickOrder(event)"><button>주문하기</button></li>
        <li class="pay" onclick="clickPayment(event)"><button>결제하기</button></li>
      </ul>
    </div>
  </aside>
`;

// =============================================
//  로컬 변수 (IIFE 스코프)
// =============================================
var menuData;
var cachingData = null;
var basket = [];
var currentMenu = null;
var currentOptionModalMenu = null;
var menuAllData = [];
var order_history = [];
var cancel_order_list = [];
var indexData = { main: 0, sub: 0, page: 0 };

// =============================================
//  데이터 로드
// =============================================

var initGetMenuList = async function() {
  var url = '/pos/get_menu_list';
  var method = 'GET';
  var fetchData = {};
  var result = await fetchDataAsync(url, method, fetchData);
  console.log(result);
  menuData = result;
  createHtml(result);
};

var initGetTableOrderList = async function() {
  var url = '/pos/get_table_order_list/' + lastPath;
  var method = 'GET';
  var fetchData = {};
  var result = await fetchDataAsync(url, method, fetchData);
  if (result.length != 0) {
    var _orderListBtns = document.querySelectorAll('.basket_container > .count_btns button.order_history, .basket_container > .count_btns button.new_order');
    _orderListBtns.forEach(function(btn) { btn.dataset.active = true; });
  }
  order_history = result.map(function(order) {
    return {
      id: order.id,
      order_id: order.order_id,
      masterName: setMasterName(order),
      name: order.name,
      price: order.price,
      count: 1,
      options: order.options,
    };
  });
};

// =============================================
//  주문내역 / 장바구니 전환
// =============================================

window.clickOrderHistoryBtn = function(event) {
  document.querySelector('.basket_container .count_btns').innerHTML = posMenuListOrderListTopBtnsHtml();

  var _orderHistoryBtn = event.currentTarget;
  _orderHistoryBtn.dataset.check = true;
  var _basketContainer = document.querySelector('.basket_container');
  _basketContainer.dataset.type = "order_list";
  changeOrderHtml(setBasketData(order_history));
  var _countBtns = document.querySelectorAll('.count_btns button.minus, .count_btns button.plus, .count_btns button.delete');
  _countBtns.forEach(function(btn) { btn.dataset.active = false; });
  closeOptionModal();

  var _orderBtn = document.querySelector('.order_btns ul li.order button');
  _orderBtn.innerHTML = '주문취소';
  document.querySelector('.order_btns ul li.order').dataset.iscancel = true;
};

var clickBasketBtn = function(event) {
  document.querySelector('.basket_container .count_btns').innerHTML = posMenuListBasketTopBtnsHtml();

  changeBasketHtml(setBasketData(menuAllData));
  var _basketContainer = document.querySelector('.basket_container');
  _basketContainer.dataset.type = "basket";
  var _orderHistoryBtn = document.querySelector('.basket_container > .count_btns button.order_history');

  _orderHistoryBtn.dataset.check = false;
  var _countBtns = document.querySelectorAll('.count_btns button.minus, .count_btns button.plus, .count_btns button.delete');
  _countBtns.forEach(function(btn) { btn.dataset.active = false; });
  closeOptionModal();

  var _orderBtn = document.querySelector('.order_btns ul li.order button');
  _orderBtn.innerHTML = '주문하기';
  document.querySelector('.order_btns ul li.order').dataset.iscancel = false;
};
window.clickBasketBtn = clickBasketBtn;

// =============================================
//  메뉴판 HTML 생성
// =============================================

var createHtml = function(menuPageData) {
  console.log('menuPageData', menuPageData);

  var _mainCatgory = document.querySelector('main section nav.main ul');
  _mainCatgory.innerHTML = menuPageData.map(function(data, index) {
    return '<li data-id="' + data.categoryId + '" data-state="' + (index == indexData.main ? 'active' : '') + '">' +
      '<button onclick="changeMenuCategory(event, ' + index + ')">' + data.category + '</button></li>';
  }).join('');

  var _subCatgory = document.querySelector('main section nav.sub ul');
  var subCategoryData = menuPageData[indexData.main].subCategoryList;
  _subCatgory.innerHTML = subCategoryData.map(function(data, index) {
    return '<li data-id="' + data.subCategoryId + '" data-state="' + (index == indexData.sub ? 'active' : '') + '">' +
      '<button onclick="changeMainMenuCategory(event, ' + index + ')">' + data.subCategory + '</button></li>';
  }).join('');

  var _menuList = document.querySelector('main section article .items');
  var menuListData = (subCategoryData[indexData.sub]?.pageList[indexData.page]?.menuList) || [];
  _menuList.innerHTML = changeMenuHtml(menuListData);
  _menuList.setAttribute('data-page', indexData.page);

  var _article = document.querySelector('main section article');
  var maxPageIndex = menuData[indexData.main].subCategoryList[indexData.sub].pageList.length - 1;
  _article.classList.remove('hasNextPage');
  _article.classList.remove('hasPrevPage');
  if (0 < indexData.page) { _article.classList.add('hasPrevPage'); }
  if (indexData.page < maxPageIndex) { _article.classList.add('hasNextPage'); }
};

// 페이지 변경 클릭 시
window.clickChageMenuListPageBtn = function(event, type) {
  var maxPageIndex = menuData[indexData.main].subCategoryList[indexData.sub].pageList.length - 1;
  if (type == 'prev') indexData.page -= 1;
  if (type == 'next' && indexData.page < maxPageIndex) indexData.page += 1;
  createHtml(menuData);
};

// 메뉴 카테고리 변경
window.changeMenuCategory = function(event, index) {
  indexData.main = index;
  indexData.sub = 0;
  indexData.page = 0;
  createHtml(menuData);
};

// 서브 카테고리 변경
window.changeMainMenuCategory = function(event, index) {
  indexData.sub = index;
  indexData.page = 0;
  createHtml(menuData);
};

// 메뉴 html 변경
var changeMenuHtml = function(menus) {
  menus.sort(function(a, b) { return a.position - b.position; });
  var forArray = Array.from({ length: 24 }, function() { return false; });
  menus.forEach(function(menu) { forArray[menu.position - 1] = menu; });
  return forArray.map(function(menu) {
    if (menu == false) {
      return '<button class="menu item hidden"></button>';
    }
    return '<button class="menu item" data-id="' + menu.menuId + '" onclick="clickMenu(event)">' +
      '<div class="title"><h2 class="ellipsis">' + menu.menu + '</h2></div>' +
      '<span class="price">' + menu.price.toLocaleString() + '원</span></button>';
  }).join('');
};

// =============================================
//  메뉴 클릭 / 옵션 모달
// =============================================

window.clickMenu = function(event) {
  clickBasketBtn();
  var menuId = event.currentTarget.dataset.id;
  var menu = getMenuData(menuId);

  if (menu.optionList && menu.optionList.length > 0) {
    openOptionModal(menu);
  } else {
    addToBasketDirectly(menu);
  }
};

var openOptionModal = function(menu) {
  var modal = document.getElementById('optionModal');
  document.getElementById('optionMenuName').innerText = menu.menu;
  document.getElementById('optionMenuPrice').innerText = menu.price.toLocaleString() + '원';

  var descEl = document.getElementById('optionMenuDescription');
  if (menu.mainDescription && menu.mainDescription.trim()) {
    descEl.innerText = menu.mainDescription;
    descEl.style.display = 'block';
  } else {
    descEl.innerText = '';
    descEl.style.display = 'none';
  }

  currentOptionModalMenu = {
    id: menu.menuId,
    name: menu.menu,
    price: menu.price,
    count: 1,
    options: [],
  };

  renderOptionItems(menu);
  modal.classList.add('active');
};

var closeOptionModal = function() {
  document.getElementById('optionModal').classList.remove('active');
  currentOptionModalMenu = null;
};
window.closeOptionModal = closeOptionModal;

var renderOptionItems = function(menu) {
  var groupsContainer = document.getElementById('optionGroups');

  if (!menu.optionList || menu.optionList.length === 0) {
    groupsContainer.innerHTML = '';
    return;
  }

  groupsContainer.innerHTML = menu.optionList.map(function(group) {
    var isSingle = group.option_type === 'REQUIRED_SINGLE' || group.option_type === 'OPTIONAL_SINGLE';

    return '<div class="option-group"><div class="group-header"><h4>' + group.name + '</h4>' +
      (group.option_type === 'REQUIRED_SINGLE' ? '<span class="required-badge">필수</span>' : '') +
      '</div><div class="group-options">' +
      group.options.map(function(opt) {
        var isSelected = currentOptionModalMenu.options.some(function(o) { return o.id === opt.id; });
        var iconClass = isSelected
          ? (isSingle ? 'ph-fill ph-radio-button' : 'ph-fill ph-check-square')
          : (isSingle ? 'ph ph-circle' : 'ph ph-square');

        return '<div class="option-item ' + (isSelected ? 'active' : '') + '" ' +
          'onclick="toggleOption(' + opt.id + ', \'' + opt.name + '\', ' + opt.price + ', ' + group.id + ', \'' + group.option_type + '\')">' +
          '<div class="check-icon"><i class="' + iconClass + '"></i></div>' +
          '<div class="option-info"><span class="name">' + opt.name + '</span>' +
          '<span class="price">+' + opt.price.toLocaleString() + '원</span></div></div>';
      }).join('') +
      '</div></div>';
  }).join('');
};

window.toggleOption = function(id, name, price, groupId, type) {
  var item = { id: id, name: name, price: price, count: 1, groupId: groupId, type: type };

  if (type === 'REQUIRED_SINGLE' || type === 'OPTIONAL_SINGLE') {
    var existingIdx = currentOptionModalMenu.options.findIndex(function(o) { return o.groupId === groupId; });
    if (existingIdx > -1) {
      var existing = currentOptionModalMenu.options[existingIdx];
      currentOptionModalMenu.options.splice(existingIdx, 1);

      if (existing.id === id && type === 'OPTIONAL_SINGLE') {
        renderOptionItems(getMenuData(currentOptionModalMenu.id));
        return;
      }
    }
    currentOptionModalMenu.options.push(item);
  } else {
    var eIdx = currentOptionModalMenu.options.findIndex(function(o) { return o.id === id; });
    if (eIdx > -1) {
      currentOptionModalMenu.options.splice(eIdx, 1);
    } else {
      currentOptionModalMenu.options.push(item);
    }
  }

  renderOptionItems(getMenuData(currentOptionModalMenu.id));
};

window.addToCartFromModal = function() {
  var menu = getMenuData(currentOptionModalMenu.id);

  if (menu.optionList) {
    for (var i = 0; i < menu.optionList.length; i++) {
      var group = menu.optionList[i];
      if (group.option_type === 'REQUIRED_SINGLE') {
        var hasSelection = currentOptionModalMenu.options.some(function(o) { return o.groupId === group.id; });
        if (!hasSelection) {
          showToast('\'' + group.name + '\' 옵션을 선택해주세요.');
          return;
        }
      }
    }
  }

  currentOptionModalMenu.masterName = setMasterName(currentOptionModalMenu);
  menuAllData.push(currentOptionModalMenu);

  changeBasketHtml(setBasketData(menuAllData));
  var menuName = currentOptionModalMenu.name;
  closeOptionModal();
  showToast(menuName + '이(가) 담겼습니다.');
};

var addToBasketDirectly = function(menu) {
  var newItem = {
    id: menu.menuId,
    name: menu.menu,
    price: menu.price,
    count: 1,
    options: [],
  };
  newItem.masterName = setMasterName(newItem);
  menuAllData.push(newItem);

  changeBasketHtml(setBasketData(menuAllData));
  showToast(newItem.name + '이(가) 담겼습니다.');
};

// 옵션 모달 배경 클릭 닫기
window.addEventListener('click', function(event) {
  var modal = document.getElementById('optionModal');
  if (modal && event.target == modal) {
    closeOptionModal();
  }
});

// =============================================
//  메뉴 데이터 헬퍼
// =============================================

var getMenuData = function(menuId) {
  var pageMenuList = menuData[indexData.main].subCategoryList[indexData.sub].pageList[indexData.page].menuList;
  return pageMenuList.find(function(menu) { return menu.menuId == menuId; });
};

// =============================================
//  장바구니 클릭/조작
// =============================================

window.clickBasketMenu = function(event) {
  var __basketMenu = document.querySelectorAll('.basket_container .basket li > div');
  var target = event.currentTarget;
  __basketMenu.forEach(function(_basketMenu) {
    _basketMenu.classList.remove('active');
  });
  target.classList.add('active');
  var _countBtns = document.querySelectorAll('.count_btns button.minus, .count_btns button.plus, .count_btns button.delete');
  _countBtns.forEach(function(btn) { btn.dataset.active = true; });
  closeOptionModal();
};

window.clickOrderMenu = function(event) {
  var __basketMenu = document.querySelectorAll('.basket_container .basket li');
  var target = event.currentTarget;
  __basketMenu.forEach(function(_basketMenu) {
    _basketMenu.classList.remove('active');
  });
  target.classList.add('active');
  var _countBtns = document.querySelectorAll('.count_btns button.minus, .count_btns button.plus, .count_btns button.delete');
  _countBtns.forEach(function(btn) { btn.dataset.active = true; });
  closeOptionModal();
};

// 장바구니 - 클릭 시
window.minusBasketMenu = function(event) {
  if (menuAllData.length == 0) return;
  var basketItems = document.querySelectorAll('.basket li');
  var menuIndex;
  menuIndex = Array.from(basketItems).findIndex(function(el) { return el.querySelector('div').classList.contains('active'); });
  if (menuIndex == -1) {
    menuIndex = Array.from(basketItems).findIndex(function(el) { return el.querySelector('div.active[data-type="menu_option"]') != undefined; });
  }

  var target = document.querySelector('.basket li div.active');
  var targetType = target.dataset.type;
  var pargetEl = target.closest('li').querySelector('[data-type="menu"]');
  var masterName = targetType == "menu" ? target.dataset.master : pargetEl.dataset.master;

  var optionIndex = undefined;

  if (targetType == 'menu') {
    var dataIndex = menuAllData.findIndex(function(data) { return data.masterName == masterName; });
    menuAllData.splice(dataIndex, 1);
  }
  if (targetType == 'menu_option') {
    var filterData = menuAllData.filter(function(data) { return data.masterName == masterName; });
    optionIndex = filterData[0].options.findIndex(function(option) { return Number(option.id) == Number(target.dataset.id); });
    if (filterData[0].options[optionIndex].count > 1) {
      filterData.forEach(function(d) { d.options[optionIndex].count -= 1; });
    } else {
      filterData.forEach(function(data) { data.options.splice(optionIndex, 1); });
    }
  }
  menuAllData.forEach(function(data) { data.masterName = setMasterName(data); });
  changeBasketHtml(setBasketData(menuAllData));
  maintainActive(targetType, menuIndex, optionIndex);
  closeOptionModal();
};

// 주문내역에서 '-' 클릭 시
window.minusOrderListMenu = function() {
  var basketItems = document.querySelectorAll('.basket li');
  var menuIndex = Array.from(basketItems).findIndex(function(el) { return el.classList.contains('active'); });
  var target = document.querySelector('.basket li.active');
  var dataList = order_history.filter(function(order) { return order.masterName == target.dataset.master; });
  var targetCancelDataList = cancel_order_list.filter(function(data) { return data.masterName == dataList[0].masterName; });

  function findFirstUniqueIndex(arr1, arr2) {
    var setArr2 = arr2.map(function(arr) { return arr.order_id; });
    for (var i = 0; i < arr1.length; i++) {
      if (!setArr2.includes(arr1[i].order_id)) return i;
    }
    return -1;
  }
  var dataListIndex = findFirstUniqueIndex(dataList, targetCancelDataList);
  var maxCount = dataList.length;
  var data = dataList[dataListIndex];
  if (!stringToBooleanMap[target.dataset.iscancel]) {
    target.dataset.iscancel = true;
    var html = '<li class="cancel" data-count="0"></li>';
    target.insertAdjacentHTML("afterend", html);
  }
  var _nextLi = target.nextElementSibling;
  var count = Number(_nextLi.dataset.count) + 1;
  if (count > maxCount) {
    return;
  } else {
    cancel_order_list.push(data);
    _nextLi.dataset.count = count;
    var cancelHtml = '<div data-id="' + data.id + '" data-type="menu" data-count="' + count + '" data-master="' + data.masterName + '" class="menu cancel">' +
      '<div class="count"><span>' + count + '</span></div><h2>' + data.name + '</h2>' +
      '<span class="price">-' + (data.price * count).toLocaleString() + '원</span></div>' +
      data.options.map(function(option) {
        return '<div data-id="' + option.id + '" data-type="menu_option" class="menu_option">' +
          '<div class="option_name_count"><h2>' + option.name + '</h2><span>x</span><span>' + option.count + '</span></div>' +
          '<span class="price">-' + (option.price * count).toLocaleString() + '원</span></div>';
      }).join('');
    _nextLi.innerHTML = cancelHtml;
  }
};

// 주문내역에서 '+' 클릭 시
window.plusOrderListMenu = function() {
  var basketItems = document.querySelectorAll('.basket li');
  var menuIndex = Array.from(basketItems).findIndex(function(el) { return el.classList.contains('active'); });
  var target = document.querySelector('.basket li.active');
  var dataList = order_history.filter(function(order) { return order.masterName == target.dataset.master; });
  var data = dataList[0];
  if (!stringToBooleanMap[target.dataset.iscancel]) return;
  var _nextLi = target.nextElementSibling;
  if (!_nextLi.classList.contains('cancel')) return;
  var count = Number(_nextLi.dataset.count) - 1;
  var index = cancel_order_list.findIndex(function(order) { return order.masterName == target.dataset.master; });
  if (index !== -1) {
    cancel_order_list.splice(index, 1);
  }
  if (count == 0) {
    target.dataset.iscancel = false;
    _nextLi.remove();
  } else {
    _nextLi.dataset.count = count;
    var cancelHtml = '<div data-id="' + data.id + '" data-type="menu" data-count="' + count + '" data-master="' + data.masterName + '" class="menu cancel">' +
      '<div class="count"><span>' + count + '</span></div><h2>' + data.name + '</h2>' +
      '<span class="price">-' + (data.price * count).toLocaleString() + '원</span></div>' +
      data.options.map(function(option) {
        return '<div data-id="' + option.id + '" data-type="menu_option" class="menu_option">' +
          '<div class="option_name_count"><h2>' + option.name + '</h2><span>x</span><span>' + option.count + '</span></div>' +
          '<span class="price">-' + (option.price * count).toLocaleString() + '원</span></div>';
      }).join('');
    _nextLi.innerHTML = cancelHtml;
  }
};

// 주문내역에서 '삭제' 클릭 시
window.deleteOrderListMenu = function() { };

// 장바구니 + 클릭 시
window.plusBasketMenu = function(event) {
  var type = findParentTarget(event.currentTarget, 'aside').dataset.type;
  if (type == 'order_list') {
    console.log('주문내역에서 플러스 클릭함');
  }
  if (type == 'basket') {
    if (menuAllData.length == 0) return;
    var basketItems = document.querySelectorAll('.basket li');
    var menuIndex;
    menuIndex = Array.from(basketItems).findIndex(function(el) { return el.querySelector('div').classList.contains('active'); });
    if (menuIndex == -1) {
      menuIndex = Array.from(basketItems).findIndex(function(el) { return el.querySelector('div.active[data-type="menu_option"]') != undefined; });
    }

    var target = document.querySelector('.basket li div.active');
    var targetType = target.dataset.type;
    var pargetEl = target.closest('li').querySelector('div[data-type="menu"]');
    var masterName = targetType == "menu" ? target.dataset.master : pargetEl.dataset.master;
    var optionIndex = undefined;
    if (targetType == 'menu') {
      var data = menuAllData.find(function(d) { return d.masterName == masterName; });
      menuAllData.push(deepCopy(data));
    }
    if (targetType == 'menu_option') {
      var filterData = menuAllData.filter(function(d) { return d.masterName == masterName; });
      optionIndex = filterData[0].options.findIndex(function(option) { return Number(option.id) == Number(target.dataset.id); });
      filterData.forEach(function(d) { d.options[optionIndex].count += 1; });
    }

    menuAllData.forEach(function(data) { data.masterName = setMasterName(data); });
    changeBasketHtml(setBasketData(menuAllData));

    maintainActive(targetType, menuIndex, optionIndex);
    closeOptionModal();
  }
};

// 장바구니 클릭 상태 유지
var maintainActive = function(targetType, menuIndex, optionIndex) {
  var basketItems = document.querySelectorAll('.basket li');
  var basketLength = basketItems.length;
  var _countBtns = document.querySelectorAll('.count_btns button.minus, .count_btns button.plus, .count_btns button.delete');
  if (basketLength === 0) {
    _countBtns.forEach(function(btn) { btn.dataset.active = false; });
    return;
  }
  var targetEl;
  if (targetType == 'menu') {
    targetEl = basketItems[menuIndex]?.querySelector('[data-type="menu"]');
    if (targetEl == undefined) {
      while (menuIndex >= 0) {
        if (basketItems[menuIndex]?.querySelector('[data-type="menu"]') != undefined) {
          targetEl = basketItems[menuIndex].querySelector('[data-type="menu"]');
          break;
        }
        menuIndex -= 1;
      }
    }
  } else {
    targetEl = basketItems[menuIndex].querySelectorAll('[data-type="menu_option"]')[optionIndex];
    if (targetEl == undefined) {
      while (optionIndex >= 0) {
        if (basketItems[menuIndex].querySelectorAll('[data-type="menu_option"]')[optionIndex] != undefined) {
          targetEl = basketItems[menuIndex].querySelectorAll('[data-type="menu_option"]')[optionIndex];
          break;
        }
        optionIndex -= 1;
      }
      if (optionIndex == -1) {
        targetEl = basketItems[menuIndex].querySelector('[data-type="menu"]');
      }
    }
  }
  _countBtns.forEach(function(btn) { btn.dataset.active = true; });
  targetEl.classList.add('active');
};

// 장바구니 삭제 클릭 시
window.deleteBasketMenu = function(event) {
  var type = findParentTarget(event.currentTarget, 'aside').dataset.type;
  if (type == 'order_list') {
    console.log('주문내역에서 휴지통 클릭함');
  }
  if (type == 'basket') {
    if (menuAllData.length == 0) return;

    var target = document.querySelector('.basket .active');
    var targetType = target.dataset.type;
    var pargetEl = target.closest('li').querySelector('[data-type="menu"]');
    var masterName = targetType == "menu" ? target.dataset.master : pargetEl.dataset.master;

    var basketItems = document.querySelectorAll('.basket li');
    var menuIndex;
    menuIndex = Array.from(basketItems).findIndex(function(el) { return el.querySelector('div').classList.contains('active'); });
    if (menuIndex == -1) {
      menuIndex = Array.from(basketItems).findIndex(function(el) { return el.querySelector('div.active[data-type="menu_option"]') != undefined; });
    }

    var optionIndex = undefined;
    if (targetType == 'menu') {
      menuAllData = deepCopy(menuAllData.filter(function(data) { return data.masterName != masterName; }));
    }
    if (targetType == 'menu_option') {
      var filterData = menuAllData.filter(function(data) { return data.masterName == masterName; });
      optionIndex = filterData[0].options.findIndex(function(option) { return Number(option.id) == Number(target.dataset.id); });
      filterData.forEach(function(data) { data.options.splice(optionIndex, 1); });
    }
    menuAllData.forEach(function(data) { data.masterName = setMasterName(data); });
    changeBasketHtml(setBasketData(menuAllData));

    maintainActive(targetType, menuIndex, optionIndex);
    closeOptionModal();
  }
};

// =============================================
//  주문하기 / 결제하기
// =============================================

window.clickOrder = async function(event) {
  var target = findParentTarget(event.target, 'li.order');
  if (target.dataset.iscancel == 'false') {
    console.log('주문하기');
    var url = '/order/';
    var method = 'POST';
    var fd = {
      table_id: lastPath,
      order_list: deepCopy(menuAllData),
      is_pos: true
    };
    var result = await fetchDataAsync(url, method, fd);
    if (result.code == 200) {
      showToast('주문이 완료되었습니다.');
      setTimeout(function() {
        navigateTo('/pos/tableList');
      }, 1500);
    }
  } else {
    console.log('주문취소');
    var url = '/order/delete_order';
    var method = 'POST';
    var fd = { order_id_list: cancel_order_list.map(function(data) { return data.order_id; }) };
    var result = await fetchDataAsync(url, method, fd);
    if (result.code == 200) {
      navigateTo('/pos/tableList');
    }
  }
};

window.clickPayment = function(event) {
  navigateTo('/pos/payment/' + lastPath);
};

// =============================================
//  init / cleanup (SPA 라우터에서 호출)
// =============================================

window.initMenuListView = function(params) {
  var tableId = params.tableId;
  window.lastPath = tableId;

  // 상태 초기화
  menuData = null;
  cachingData = null;
  basket = [];
  currentMenu = null;
  currentOptionModalMenu = null;
  menuAllData = [];
  order_history = [];
  cancel_order_list = [];
  indexData = { main: 0, sub: 0, page: 0 };

  document.getElementById('pos-content').innerHTML = MENU_LIST_SHELL;
  initGetMenuList();
  initGetTableOrderList();

  // onOrderUpdate 콜백 (menuList 뷰용)
  window.onOrderUpdate = function(data) {
    if (data.table_id == lastPath) {
      initGetTableOrderList();
    }
  };
};

window.cleanupMenuListView = function() {
  // 특별한 정리 없음
};

})();
