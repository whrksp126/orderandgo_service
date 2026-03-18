if (typeof socket === 'undefined') {
  socket = io();
}

const STORE = {
  store_id: null,
  table_id: null,
  table_list: null,
  active_tables: new Set(),
  cur_category_index: 0,
  cur_page_index: 0,
  menu_list: null,
  index_data: {
    main: 0,
    sub: 0,
    page: 0
  },
  menuAllData: [],
  currentMenu: null,
  currentSlideIndex: 0,
  currentImages: [],
  staffCallItems: [],
  selectedStaffCallItems: {} // { itemId: quantity }
};

// 실시간 상태 업데이트 수신
socket.on('table_status_update', (data) => {
  console.log('Status Update:', data);
  STORE.active_tables.clear();
  data.active_tables.forEach(id => STORE.active_tables.add(String(id)));
  if (lastPath === 'login') {
    createTableHtml();
  }
  if (lastPath === 'login') {
    createTableHtml();
  }
});

// 새로운 주문 알림 (POS에서 주문 시)
socket.on('new_order_notification', (data) => {
  showToast(data.message);
  loadOrderHistory(); // 주문 내역 갱신
});

// 강제 로그아웃 수신
socket.on('force_logout', (data) => {
  alert(data.message);
  window.location.href = '/';
});

// Payment Finished Notification
socket.on('payment_finished', () => {
  // 1. Show Payment Overlay
  showOverlay({
    type: 'payment',
    duration: 10,
    showTimer: true,
    onClose: () => {
      // 2. Reset App State after overlay closes
      resetTableOrder();
    }
  });
});

// 초기화 함수
const initApp = async () => {
  try {
    const info = await fetchDataAsync('/table_order/get_info', 'GET', {});
    STORE.store_id = info.store_id;
    window.STORE_ID = info.store_id;

    if (lastPath === 'login') {
      socket.emit('join_login_page', { store_id: STORE.store_id });
      getTableData();
    } else if (lastPath === 'main') {
      STORE.table_id = getTableIdFromCurrentUrl('table_id');
      window.TABLE_ID = STORE.table_id;
      socket.emit('join_table_order', { store_id: STORE.store_id, table_id: STORE.table_id });

      await getMenuListData(); // Wait for menu data
      await loadOrderHistory(); // Wait for history to check if empty

      // Check for orders and show Welcome overlay if empty
      checkAndShowWelcomeOverlay();

      // Start Idle Timer logic
      initIdleTimer();
    }
  } catch (error) {
    console.error('App Initialization Error:', error);
  }
}

// 초기화 시작
initApp();

// 매장 테이블 리스트 받아오기
const getTableData = async () => {
  const url = `/store/get_table`;
  const method = 'GET';
  const fetchData = {};
  const result = await fetchDataAsync(url, method, fetchData);
  console.log(result)
  STORE.table_list = result;
  createTableHtml()
}

// 테이블 html 만들기
const createTableHtml = () => {
  const data = STORE.table_list;
  if (!data) return; // 데이터가 없으면 중단

  // 데이터가 없을 때 안내 메시지 표시
  if (data.length === 0) {
    document.querySelector('.table_order main section nav ul').innerHTML = '';
    document.querySelector('.table_order main section article .items').innerHTML = `
      <div class="empty_state">
        <i class="ph ph-table"></i>
        <p>등록된 테이블이 없습니다.</p>
        <span>매장 관리에서 테이블 카테고리와 테이블을 생성해주세요.</span>
        <a href="/store/product">매장 관리로 이동 →</a>
      </div>
    `;
    return;
  }

  const categoryNum = STORE.cur_category_index;
  const pageNum = STORE.cur_page_index;
  const curData = data[categoryNum].pages[pageNum].tables;
  const categoryHtml = data.sort((a, b) => a.position - b.position).map((category, index) => `
    <li data-id="${category.id}" data-state="${index == categoryNum ? 'active' : ''}">
      <button onclick="changeTableCategory(event,${index})">${category.name}</button>
    </li>
  `).join('');
  document.querySelector('.table_order main section nav ul').innerHTML = categoryHtml;
  const tableList = new Array(20).fill(false);
  curData.forEach(data => tableList[data.position - 1] = data);

  const html = tableList.map((table, index) => {
    if (!table) return `<button></button>`;
    const isActive = STORE.active_tables.has(String(table.id));
    return `
      <button class="table item" data-id="${table.id}" data-name="${table.name}" data-active="${isActive}" data-has="true" data-page="${pageNum}" data-position="${index + 1}" onclick="clickTableArea(event)">
        <div class="title">
            <h2>${table.name}</h2>
            ${isActive ? '<div class="table_state">입장 중</div>' : ''}
        </div>
        <div class="body">
            <i class="ph-bold ph-sign-in"></i>
        </div>
      </button>
    `;
  }).join('');
  const _items = document.querySelector('.table_order main section article .items');
  _items.innerHTML = html;

  const _article = document.querySelector('main section article');

  _article.classList.toggle('hasPrevPage', data[categoryNum].pages[pageNum - 1] !== undefined);
  _article.classList.toggle('hasNextPage', data[categoryNum].pages[pageNum + 1] !== undefined);
}

// 테이블 카테고리 변경 시
const changeTableCategory = (event, index) => {
  STORE.cur_category_index = index;
  STORE.cur_page_index = 0;
  const _table = document.querySelector('main section article .items');
  createTableHtml();
  _table.setAttribute('data-page', STORE.cur_page_index);
  const _article = document.querySelector('main section article');
  _article.classList.remove('hasNextPage');
  _article.classList.remove('hasPrevPage');
  const curCategoryId = document.querySelector('main section nav ul li[data-state="active"]').dataset.id;
  const pageLen = STORE.table_list.find((category) => category.id == Number(curCategoryId)).pages.length;
  if (STORE.cur_page_index < pageLen - 1) { _article.classList.add('hasNextPage') };
}
// 페이지 변경 클릭 시
const clickChangeTablePosition = (event, type) => {
  if (type == 'prev') { // 이전 페이지
    STORE.cur_page_index -= 1;
  }
  if (type == 'next') { // 다음 페이지
    STORE.cur_page_index += 1;
  }
  createTableHtml();
}

// 테이블 접속 클릭 시
const clickTableArea = (event) => {
  const target = findParentTarget(event.target, '.item');
  const table_id = target.dataset.id;
  const isActive = target.dataset.active === 'true';

  if (isActive) {
    const modal = openDefaultModal();
    modal.top.innerHTML = modalTopHtml('중복 접속 확인');
    modal.middle.innerHTML = `<p style="text-align:center; padding: 20px 0; font-size: 16px;">이미 접속 중인 기기가 있습니다.<br>기존 접속을 종료하고 새로 접속하시겠습니까?</p>`;
    modal.bottom.innerHTML = modalBottomHtml([
      { class: 'brand_fill', text: '접속', fun: `onclick="window.location.href='/table_order/main?table_id=${table_id}'"` },
      { class: 'close', text: '취소', fun: '' }
    ]);
  } else {
    window.location.href = `/table_order/main?table_id=${table_id}`;
  }
}

// 메뉴판 조회
const getMenuListData = async () => {
  const url = `/pos/get_menu_list`;
  const method = `GET`;
  const fetchData = {};
  const result = await fetchDataAsync(url, method, fetchData);
  console.log(result)
  STORE.menu_list = result;
  createMenuListHtml()
}
// 메뉴판 HTML 세팅
const createMenuListHtml = () => {
  const menuPageData = STORE.menu_list;
  const _mainCategory = document.getElementById('mainCategoryList');

  // 카테고리 렌더링 (사이드바)
  _mainCategory.innerHTML = menuPageData.map((data, index) => `
    <li data-id="${data.categoryId}" id="nav-item-${data.categoryId}" data-state="${index == STORE.index_data.main ? 'active' : ''}">
      <button onclick="changeMenuCategory(event, ${index}, ${data.categoryId})">${data.category}</button>
    </li>
  `).join('');

  const _menuGridContainer = document.querySelector('.menu-grid-container');

  // 모든 카테고리와 소분류 메뉴를 순차적으로 렌더링
  let allMenusHtml = '';
  menuPageData.forEach((categoryData) => {
    categoryData.subCategoryList.forEach((sub, subIdx) => {
      // 각 소분류마다 섹션을 생성하여 "대분류 > 소분류" 형태의 헤더를 가짐
      allMenusHtml += `
        <section class="category-section" id="category-section-${categoryData.categoryId}-${subIdx}" data-main-id="${categoryData.categoryId}">
          <h2 class="category-header">
            <span class="main-cat">${categoryData.category}</span>
            <span class="sep">></span>
            <span class="sub-cat">${sub.subCategory}</span>
          </h2>
          <div class="menu-grid">
      `;

      let menuListData = [];
      sub.pageList.forEach(page => {
        menuListData = menuListData.concat(page.menuList);
      });

      allMenusHtml += createMenuGridHtml(menuListData);
      allMenusHtml += `
          </div>
        </section>
      `;
    });
  });

  _menuGridContainer.innerHTML = allMenusHtml;

  // Scroll Spy 설정
  setupScrollSpy();

  // 스와이프 이벤트 설정 (메뉴 카드들)
  const menuCards = document.querySelectorAll('.menu-card');
  menuCards.forEach(card => {
    const slider = card.querySelector('.card-slider-wrapper');
    if (slider) {
      const menuId = card.dataset.id;
      setupSwipeEvents(card, (delta) => {
        moveCardSlider(null, menuId, delta);
      });
    }
  });
}

// 스크롤 위치에 따라 사이드바 활성화 상태 업데이트
let isScrollingByClick = false; // 클릭에 의한 스크롤 중인지 여부

const setupScrollSpy = () => {
  const container = document.querySelector('.menu-grid-container');
  const sections = document.querySelectorAll('.category-section');
  const navItems = document.querySelectorAll('#mainCategoryList li');

  container.onscroll = () => {
    if (isScrollingByClick) return; // 클릭으로 이동 중이면 스파이 동작 무시

    let currentMainId = '';
    // 스크롤 위치 보정값 (헤더 높이 등 고려)
    const offset = 150;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      if (container.scrollTop >= sectionTop - offset) {
        currentMainId = section.getAttribute('data-main-id');
      }
    });

    if (currentMainId) {
      navItems.forEach(li => {
        if (li.getAttribute('data-id') === currentMainId) {
          li.setAttribute('data-state', 'active');
        } else {
          li.setAttribute('data-state', '');
        }
      });
    }
  };
};

// 메뉴 카테고리 변경 시
const changeMenuCategory = (event, index, categoryId) => {
  // 클릭 시 즉시 활성화 처리
  const navItems = document.querySelectorAll('#mainCategoryList li');
  navItems.forEach(li => {
    if (li.getAttribute('data-id') == categoryId) {
      li.setAttribute('data-state', 'active');
    } else {
      li.setAttribute('data-state', '');
    }
  });

  // 해당 대분류의 첫 번째 소분류 섹션으로 이동
  const targetSection = document.querySelector(`.category-section[data-main-id="${categoryId}"]`);
  if (targetSection) {
    isScrollingByClick = true;
    // scrollIntoView는 비동기적으로 완료될 수 있으므로, 약간의 지연 후 플래그 해제
    // 또는 scrollend 이벤트를 사용할 수도 있으나 호환성을 위해 타임아웃 사용
    targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    setTimeout(() => {
      isScrollingByClick = false;
    }, 1000); // 애니메이션 시간 고려
  }
}

// 메뉴 그리드 HTML 생성 (3열 카드 형태)
const createMenuGridHtml = (menus) => {
  return menus.map((menu) => {
    const images = menu.imageList && menu.imageList.length > 0 ? menu.imageList : [menu.imageUrl || '/static/images/common/logo.png'];
    const hasMultipleImages = images.length > 1;

    return `
      <div class="menu-card" data-id="${menu.menuId}" onclick="clickMenu(event)">
        <div class="image ${menu.imageUrl ? '' : 'no-image'}">
          ${hasMultipleImages ? `
            <div class="card-slider-wrapper" id="cardSlider-${menu.menuId}" data-current="0" data-total="${images.length}">
              ${images.map(img => `<div class="card-slide" style="background-image: url('${img}')"></div>`).join('')}
            </div>
            <button class="card-slider-btn prev hidden" onclick="moveCardSlider(event, ${menu.menuId}, -1)">
              <i class="ph-bold ph-caret-left"></i>
            </button>
            <button class="card-slider-btn next" onclick="moveCardSlider(event, ${menu.menuId}, 1)">
              <i class="ph-bold ph-caret-right"></i>
            </button>
            <div class="card-indicators">
              ${images.map((_, i) => `<div class="card-indicator ${i === 0 ? 'active' : ''}"></div>`).join('')}
            </div>
          ` : `
            <div class="card-slide" style="background-image: url('${images[0]}')"></div>
          `}
          ${(menu.optionList && menu.optionList.length > 0) ? '<span class="menu-hint">옵션</span>' :
        (menu.mainDescription && menu.mainDescription.trim()) ? '<span class="menu-hint">상세</span>' : ''}
        </div>
        <div class="info">
          <h3 class="ellipsis">${menu.menu}</h3>
          <span class="price">${menu.price.toLocaleString()}원</span>
        </div>
      </div>
    `;
  }).join('');
}

// 카드 썸네일 슬라이더 이동
const moveCardSlider = (event, menuId, delta) => {
  if (event) event.stopPropagation(); // 카드 클릭(모달 열기) 방지
  const wrapper = document.getElementById(`cardSlider-${menuId}`);
  if (!wrapper) return;

  const current = parseInt(wrapper.dataset.current);
  const total = parseInt(wrapper.dataset.total);
  const next = current + delta;

  if (next < 0 || next >= total) return;

  wrapper.dataset.current = next;
  wrapper.style.transform = `translateX(-${next * 100}%)`;

  // 버튼 가시성 업데이트 (있을 경우만)
  const container = wrapper.parentElement;
  const prevBtn = container.querySelector('.card-slider-btn.prev');
  const nextBtn = container.querySelector('.card-slider-btn.next');

  if (prevBtn) prevBtn.classList.toggle('hidden', next === 0);
  if (nextBtn) nextBtn.classList.toggle('hidden', next === total - 1);

  // 인디케이터 업데이트
  const indicators = container.querySelectorAll('.card-indicator');
  indicators.forEach((ind, i) => {
    ind.classList.toggle('active', i === next);
  });
}

// 스와이프 감지 설정
const setupSwipeEvents = (element, callback) => {
  let startX = 0;
  let startY = 0;
  let isDragging = false;

  const handleStart = (e) => {
    isDragging = true;
    startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
  };

  const handleEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;

    const endX = e.type.includes('touch') ? e.changedTouches[0].clientX : e.clientX;
    const endY = e.type.includes('touch') ? e.changedTouches[0].clientY : e.clientY;

    const diffX = endX - startX;
    const diffY = endY - startY;

    // 수평 스와이프가 수직 스크롤보다 우세한 경우만 처리
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        callback(-1); // Right swipe (Prev)
      } else {
        callback(1); // Left swipe (Next)
      }
      // 스와이프 발생 시 클릭 이벤트 방지를 위해 캡처링 단계에서 막을 수 있도록 설정 가능
    }
  };

  element.addEventListener('touchstart', handleStart, { passive: true });
  element.addEventListener('touchend', handleEnd, { passive: true });

  element.addEventListener('mousedown', handleStart);
  window.addEventListener('mouseup', (e) => {
    if (isDragging) handleEnd(e);
  });

  // 스와이프 발생 시 클릭 이벤트가 실행되지 않도록 방지
  element.addEventListener('click', (e) => {
    const endX = e.clientX;
    const endY = e.clientY;
    const diffX = Math.abs(endX - startX);
    const diffY = Math.abs(endY - startY);

    if (diffX > 5 || diffY > 5) {
      // 실제 드래그가 발생한 경우 클릭 이벤트 차단
      e.stopImmediatePropagation();
    }
  }, true); // Use capturing phase

  // 마우스 드래그 시 이미지 드래그 방지
  element.addEventListener('dragstart', (e) => e.preventDefault());
}

// 메뉴 클릭 시 (옵션 모달 오픈)
const clickMenu = (event) => {
  const menuId = event.currentTarget.dataset.id;
  const menu = getMenuData(menuId);
  STORE.currentMenu = {
    id: menu.menuId,
    name: menu.menu,
    price: menu.price,
    count: 1,
    options: [],
    imageUrl: menu.imageUrl || '/static/images/common/logo.png'
  };

  // 옵션이나 상세 설명이 있으면 모달 오픈, 없으면 바로 장바구니 추가
  const hasOptions = menu.optionList && menu.optionList.length > 0;
  const hasDescription = menu.mainDescription && menu.mainDescription.trim();

  if (hasOptions || hasDescription) {
    openOptionModal(menu);
  } else {
    addToBasketDirectly();
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

  const wrapper = document.getElementById('sliderWrapper');
  const indicators = document.getElementById('sliderIndicators');
  const imgList = menu.imageList && menu.imageList.length > 0 ? menu.imageList : [];
  STORE.currentImages = imgList;
  STORE.currentSlideIndex = 0;

  if (imgList.length > 0) {
    wrapper.innerHTML = imgList.map(img => `
      <div class="slide" style="background-image: url('${img}')"></div>
    `).join('');
    indicators.innerHTML = imgList.map((_, i) => `
      <div class="indicator ${i === 0 ? 'active' : ''}"></div>
    `).join('');

    // 버튼 가시성
    document.querySelector('.slider-btn.prev').classList.toggle('hidden', true);
    document.querySelector('.slider-btn.next').classList.toggle('hidden', imgList.length <= 1);
  } else {
    wrapper.innerHTML = `<div class="slide no-image"></div>`;
    indicators.innerHTML = '';
    document.querySelector('.slider-btn.prev').classList.add('hidden');
    document.querySelector('.slider-btn.next').classList.add('hidden');
  }
  wrapper.style.transform = `translateX(0)`;

  // 옵션 리스트 렌더링
  renderOptionItems();

  // 모달 이미지 스와이프 설정
  const sliderContainer = document.getElementById('menuSlider');
  if (imgList.length > 1) {
    setupSwipeEvents(sliderContainer, (delta) => {
      moveSlider(delta);
    });
  }

  modal.classList.add('active');
}

const closeOptionModal = () => {
  document.getElementById('optionModal').classList.remove('active');
}

// 슬라이더 이동 함수
const moveSlider = (delta) => {
  const wrapper = document.getElementById('sliderWrapper');
  const indicators = document.querySelectorAll('.indicator');
  const nextIndex = STORE.currentSlideIndex + delta;

  if (nextIndex < 0 || nextIndex >= STORE.currentImages.length) return;

  STORE.currentSlideIndex = nextIndex;
  wrapper.style.transform = `translateX(-${STORE.currentSlideIndex * 100}%)`;

  // 인디케이터 업데이트
  indicators.forEach((ind, i) => {
    ind.classList.toggle('active', i === STORE.currentSlideIndex);
  });

  // 버튼 업데이트
  document.querySelector('.slider-btn.prev').classList.toggle('hidden', STORE.currentSlideIndex === 0);
  document.querySelector('.slider-btn.next').classList.toggle('hidden', STORE.currentSlideIndex === STORE.currentImages.length - 1);
}

const addToBasketDirectly = () => {
  STORE.currentMenu.masterName = setMasterName(STORE.currentMenu);
  STORE.menuAllData.push(STORE.currentMenu);
  updateCartUI();
  showToast(`${STORE.currentMenu.name}이(가) 담겼습니다 :)`);
  openCart(); // 장바구니 자동 열기
}

const addToCartFromModal = () => {
  // 필수 옵션 검증
  const menu = getMenuData(STORE.currentMenu.id);
  if (menu.optionList) {
    for (const group of menu.optionList) {
      if (group.option_type === 'REQUIRED_SINGLE') {
        const hasSelection = STORE.currentMenu.options.some(o => o.groupId === group.id);
        if (!hasSelection) {
          showToast(`'${group.name}' 옵션을 선택해주세요.`);
          return;
        }
      } else if (group.option_type === 'REQUIRED_QUANTITY') {
        // 필수 수량 옵션: 해당 그룹의 옵션 중 하나라도 선택된 수량이 있어야 함 (또는 총 수량이 1 이상 등 정책에 따라)
        // 여기서는 "최소 하나 이상의 옵션이 1개 이상 선택되어야 함"으로 해석
        const totalCount = STORE.currentMenu.options
          .filter(o => o.groupId === group.id)
          .reduce((sum, o) => sum + o.count, 0);

        if (totalCount === 0) {
          showToast(`'${group.name}' 옵션을 최소 1개 이상 선택해주세요.`);
          return;
        }
      }
    }
  }

  STORE.currentMenu.masterName = setMasterName(STORE.currentMenu);
  STORE.menuAllData.push(STORE.currentMenu);
  updateCartUI();
  closeOptionModal();
  showToast(`${STORE.currentMenu.name}이(가) 담겼습니다 :)`);
  openCart(); // 장바구니 자동 열기
}

// 장바구니 UI 업데이트
const updateCartUI = () => {
  const basketData = setBasketData(STORE.menuAllData);
  const _cartList = document.getElementById('cartList');
  const _totalPriceEl = document.getElementById('totalPrice');
  const _itemCountEl = document.getElementById('cartItemCount');

  if (basketData.length === 0) {
    _cartList.innerHTML = `<div style="padding: 40px; text-align: center; color: #999;">장바구니가 비어 있습니다.</div>`;
    _totalPriceEl.innerText = '0원';
    _itemCountEl.innerText = '(0)';
    return;
  }

  let totalAmount = 0;
  let totalCount = 0;

  _cartList.innerHTML = basketData.map((item, index) => {
    const { data, length, masterName } = item;

    // 합계 계산 (메뉴 가격 * 수량 + 옵션들 가격 * 수량)
    let itemTotalPrice = data.price * length;
    if (data.options) {
      data.options.forEach(opt => {
        itemTotalPrice += (opt.price * opt.count) * length;
      });
    }

    totalAmount += itemTotalPrice;
    totalCount += length;

    return `
      <div class="cart-item">
        <div class="name-row">
          <span class="name">${data.name}</span>
          <button class="delete-btn" onclick="removeCartItem('${masterName}')">
            <i class="ph ph-x"></i>
          </button>
        </div>
        ${data.options && data.options.length > 0 ? `
          <div style="font-size: 13px; color: #999; margin-top: -8px;">
            ${data.options.map(o => `${o.name} ${o.count > 1 ? `x${o.count}` : ''}`).join(', ')}
          </div>
        ` : ''}
        <div class="controls">
          <span class="price">${itemTotalPrice.toLocaleString()}원</span>
          <div class="quantity-selector">
            <button onclick="changeQuantity('${masterName}', -1)">-</button>
            <span>${length}</span>
            <button onclick="changeQuantity('${masterName}', 1)">+</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  _totalPriceEl.innerText = totalAmount.toLocaleString() + '원';
  _itemCountEl.innerText = `(${totalCount})`;
}

const removeCartItem = (masterName) => {
  STORE.menuAllData = STORE.menuAllData.filter(item => item.masterName !== masterName);
  updateCartUI();
}

const changeQuantity = (masterName, delta) => {
  if (delta === 1) {
    const original = STORE.menuAllData.find(i => i.masterName === masterName);
    if (original) {
      STORE.menuAllData.push(deepCopy(original));
    }
  } else if (delta === -1) {
    const index = STORE.menuAllData.findLastIndex(i => i.masterName === masterName);
    if (index > -1) {
      STORE.menuAllData.splice(index, 1);
    }
  }
  updateCartUI();
}

const changeOptionQuantity = (id, name, price, groupId, type, delta) => {
  // 현재 옵션 리스트에서 해당 옵션 찾기
  const existingIdx = STORE.currentMenu.options.findIndex(o => o.id === id);

  if (existingIdx > -1) {
    // 이미 있는 경우 수량 변경
    const option = STORE.currentMenu.options[existingIdx];
    option.count += delta;

    if (option.count <= 0) {
      // 0 이하가 되면 제거
      STORE.currentMenu.options.splice(existingIdx, 1);
    }
  } else if (delta > 0) {
    // 없는데 증가시키는 경우 새로 추가
    STORE.currentMenu.options.push({
      id, name, price, groupId, type, count: 1
    });
  }
  // delta < 0 이고 없는 경우는 무시

  renderOptionItems();
}

const toggleOption = (id, name, price, groupId, type) => {
  const item = { id, name, price, count: 1, groupId, type }; // groupId, type 저장

  if (type === 'REQUIRED_SINGLE' || type === 'OPTIONAL_SINGLE') {
    // 같은 그룹의 기존 선택 제거
    const existingIdx = STORE.currentMenu.options.findIndex(o => o.groupId === groupId);
    if (existingIdx > -1) {
      const existing = STORE.currentMenu.options[existingIdx];
      STORE.currentMenu.options.splice(existingIdx, 1);

      // 만약 클릭한게 이미 선택된 거였고, OPTIONAL이면 제거만 하고 끝 (토글)
      // REQUIRED라면 다시 추가 (항상 선택되어 있어야 함 - 단, 지금은 클릭 시 교체 로직이므로 그냥 둠)
      // UI UX상 라디오버튼은 클릭시 해제되지 않음. 
      if (existing.id === id && type === 'OPTIONAL_SINGLE') {
        renderOptionItems();
        return;
      }
    }
    STORE.currentMenu.options.push(item);

  } else {
    // 다중 선택 (MULTIPLE 등)
    const existingIdx = STORE.currentMenu.options.findIndex(o => o.id === id);
    if (existingIdx > -1) {
      STORE.currentMenu.options.splice(existingIdx, 1);
    } else {
      STORE.currentMenu.options.push(item);
    }
  }

  renderOptionItems();
}

const renderOptionItems = () => {
  const groupsContainer = document.getElementById('optionGroups');
  const menu = getMenuData(STORE.currentMenu.id);

  if (!menu.optionList || menu.optionList.length === 0) {
    groupsContainer.innerHTML = '';
    return;
  }

  groupsContainer.innerHTML = menu.optionList.map(group => {
    const isSingle = group.option_type === 'REQUIRED_SINGLE' || group.option_type === 'OPTIONAL_SINGLE';
    const isQuantity = group.option_type === 'QUANTITY' || group.option_type === 'REQUIRED_QUANTITY';

    return `
      <div class="option-group">
        <div class="group-header">
          <h4>${group.name}</h4>
          ${(group.option_type === 'REQUIRED_SINGLE' || group.option_type === 'REQUIRED_QUANTITY') ? '<span class="required-badge">필수</span>' : ''}
        </div>
        <div class="group-options">
          ${group.options.map(opt => {
      // 현재 선택된 옵션 찾기
      const selectedOption = STORE.currentMenu.options.find(o => o.id === opt.id);
      const isSelected = !!selectedOption;
      const count = selectedOption ? selectedOption.count : 0;

      if (isQuantity) {
        return `
          <div class="option-item quantity-type ${count > 0 ? 'active' : ''}">
            <div class="option-info">
              <span class="name">${opt.name}</span>
              ${group.show_price !== false ? `<span class="price">+${opt.price.toLocaleString()}원</span>` : ''}
            </div>
            <div class="quantity-selector">
              <button onclick="changeOptionQuantity(${opt.id}, '${opt.name}', ${opt.price}, ${group.id}, '${group.option_type}', -1)">-</button>
              <span>${count}</span>
              <button onclick="changeOptionQuantity(${opt.id}, '${opt.name}', ${opt.price}, ${group.id}, '${group.option_type}', 1)">+</button>
            </div>
          </div>
        `;
      } else {
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
                  ${group.show_price !== false ? `<span class="price">+${opt.price.toLocaleString()}원</span>` : ''}
                </div>
              </div>
            `;
      }
    }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// 주문하기 클릭 시
const clickOrder = async (event) => {
  if (STORE.menuAllData.length === 0) {
    showToast('장바구니가 비어 있습니다.');
    return;
  }

  const url = `/order/`;
  const method = 'POST';
  const fetchData = {
    store_id: STORE.store_id,
    table_id: STORE.table_id,
    order_list: deepCopy(STORE.menuAllData)
  };

  socket.emit('new_order_pos_update', fetchData, async (response) => {
    console.log('Order response:', response);

    // 주문 슬립 시뮬레이션 (주방용)
    const storeInfoResult = await fetchDataAsync(`/pos/get_store_info`, 'GET', {});
    const orderData = {
      tableName: STORE.table_id, // 실제로는 테이블 이름 조회가 필요할 수 있음
      items: STORE.menuAllData.map(item => ({
        name: item.name,
        count: 1, // 개별 항목
        options: item.options
      }))
    };

    // 주방 주문 슬립 생성 (HTML만 생성)
    const slipHtml = ReceiptEngine.generateOrderSlip('kitchen', storeInfoResult, orderData);
    console.log('generated kitchen slip:', slipHtml);

    STORE.menuAllData = [];
    updateCartUI();
    showOverlay({
      message: '주문이 완료되었습니다.',
      showCloseBtn: true,
      showTimer: true,
      duration: 3,
      onClose: () => {
        closeRightPanel();
      }
    });
  });
}

// 나머지 헬퍼 함수들은 유지하거나 정리
const getMenuData = (menuId) => {
  for (const category of STORE.menu_list) {
    for (const sub of category.subCategoryList) {
      for (const page of sub.pageList) {
        const menu = page.menuList.find(m => m.menuId == menuId);
        if (menu) return menu;
      }
    }
  }
  return null;
};



// if (lastPath == 'login') {
//   getTableData();
// }
// if (lastPath == 'main') {
//   const table_id = getTableIdFromCurrentUrl('table_id');
//   console.log(table_id)
//   getMenuListData();
// }
const clickCallStaff = async () => {
  const modal = document.getElementById('staffCallModal');
  const listContainer = document.getElementById('staffCallItemList');

  modal.classList.add('active');
  listContainer.innerHTML = '<div class="loading-msg">항목을 불러오는 중...</div>';

  try {
    const data = await fetchDataAsync(`/table_order/get_staff_call_items?store_id=${STORE.store_id}`, 'GET', {});
    STORE.staffCallItems = data.items;
    STORE.staffCallGrid = data.grid || { rows: 4, cols: 4 };
    STORE.selectedStaffCallItems = {}; // 초기화

    renderStaffCallItems();
    renderStaffCallSidebar();
  } catch (error) {
    console.error('Staff Call Items Load Error:', error);
    listContainer.innerHTML = '<div class="loading-msg">항목을 불러오지 못했습니다.</div>';
  }
}

const closeStaffCallModal = () => {
  document.getElementById('staffCallModal').classList.remove('active');
}

// 왼쪽 그리드 렌더링
const renderStaffCallItems = () => {
  const listContainer = document.getElementById('staffCallItemList');
  if (STORE.staffCallItems.length === 0) {
    listContainer.innerHTML = '<div class="loading-msg">등록된 호출 항목이 없습니다.</div>';
    return;
  }

  // 그리드 설정 적용 (CSS Grid 사용)
  const grid = STORE.staffCallGrid || { rows: 4, cols: 4 };
  listContainer.style.gridTemplateRows = `repeat(${grid.rows}, 1fr)`;
  listContainer.style.gridTemplateColumns = `repeat(${grid.cols}, 1fr)`;

  const itemMap = {};
  STORE.staffCallItems.forEach(item => {
    itemMap[item.position] = item;
  });

  const totalSlots = grid.rows * grid.cols;
  let html = '';

  for (let i = 0; i < totalSlots; i++) {
    const item = itemMap[i];
    if (item) {
      const isSelected = STORE.selectedStaffCallItems[item.id] !== undefined;

      html += `
          <div class="staff-call-item ${isSelected ? 'active' : ''}" onclick="toggleStaffCallItem(${item.id})">
            ${item.image
          ? `<img src="${item.image}"> <span class="item-name">${item.name}</span>`
          : `<span class="item-text-only">${item.name}</span>`
        }
          </div>
        `;
    } else {
      html += `<div class="staff-call-item empty"></div>`;
    }
  }
  listContainer.innerHTML = html;
}

// 오른쪽 사이드바 렌더링
const renderStaffCallSidebar = () => {
  const selectedList = document.getElementById('selectedStaffCallList');
  const selectedIds = Object.keys(STORE.selectedStaffCallItems);

  if (selectedIds.length === 0) {
    selectedList.innerHTML = `
      <div class="empty-msg">
        <p>직원만 호출하고 싶을 땐<br>호출하기만 클릭 해 주세요!</p>
      </div>
    `;
  } else {
    // 선택된 항목 리스트 렌더링
    selectedList.innerHTML = selectedIds.map(id => {
      const item = STORE.staffCallItems.find(i => i.id == id);
      const qty = STORE.selectedStaffCallItems[id];

      return `
        <div class="selected-item-card">
          <div class="item-row">
            <span class="item-name">${item.name}</span>
            <button class="delete-btn" onclick="removeStaffCallItem(${item.id})">
              <i class="ph-bold ph-x"></i>
            </button>
          </div>
          <div class="qty-row">
            ${item.use_quantity ? `
              <div class="qty-control">
                <button class="qty-btn" onclick="updateStaffCallQty(${item.id}, -1)">-</button>
                <div class="qty-value">${qty}</div>
                <button class="qty-btn" onclick="updateStaffCallQty(${item.id}, 1)">+</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }
}

// 그리드 아이템 클릭 (토글)
const toggleStaffCallItem = (itemId) => {
  if (STORE.selectedStaffCallItems[itemId] !== undefined) {
    delete STORE.selectedStaffCallItems[itemId];
  } else {
    STORE.selectedStaffCallItems[itemId] = 1;
  }
  renderStaffCallItems();
  renderStaffCallSidebar();
}

// 수량 변경
const updateStaffCallQty = (itemId, delta) => {
  let currentQty = STORE.selectedStaffCallItems[itemId] || 1;
  currentQty += delta;

  if (currentQty <= 0) {
    delete STORE.selectedStaffCallItems[itemId];
  } else {
    STORE.selectedStaffCallItems[itemId] = currentQty;
  }
  renderStaffCallItems(); // 그리드 상태 업데이트 (혹시 삭제되면 active 제거해야 하므로)
  renderStaffCallSidebar();
}

// 항목 삭제
const removeStaffCallItem = (itemId) => {
  delete STORE.selectedStaffCallItems[itemId];
  renderStaffCallItems();
  renderStaffCallSidebar();
}

const requestStaffCall = async () => {
  const selectedKeys = Object.keys(STORE.selectedStaffCallItems);

  // 선택된 항목이 없으면 단순 호출 (Figma 디자인상 '호출하기' 버튼)
  // 선택된 항목이 있으면 항목 포함 호출 ('요청하기' 버튼)

  const requests = selectedKeys.map(id => ({
    item_id: parseInt(id),
    quantity: STORE.selectedStaffCallItems[id]
  }));

  const url = '/table_order/request_staff_call';
  const data = {
    store_id: STORE.store_id,
    table_id: STORE.table_id,
    requests: requests
    // requests가 빈 배열이면 백엔드에서 단순 호출로 처리한다고 가정 or 백엔드 로직 확인 필요
    // 기존 백엔드 로직: items 리스트가 오면 LogItem 생성, 없으면 그냥 Log 생성? 
    // 확인 결과: 기존 로직은 requests 순회하며 item create. 빈 배열이면?
    // 백엔드 server/app/routes/table_order.py (추정) 로직을 모르므로, 
    // 일반적으로 빈 배열 보내면 로그만 생성되거나, '호출'이라는 이름의 아이템이 없으므로 그냥 알림만 감.
  };

  try {
    const result = await fetchDataAsync(url, 'POST', data);
    if (result.message === 'Success') {
      showToast('직원 호출이 완료되었습니다.');
      closeStaffCallModal();
    }
  } catch (error) {
    console.error('Staff Call Request Error:', error);
    showToast('호출 요청 중 오류가 발생했습니다.');
  }
}

// 토글 상태 관리
const toggleOrderHistory = async () => {
  const panel = document.getElementById('rightPanel');
  const historyView = document.getElementById('historyView');
  const cartView = document.getElementById('cartView');

  // 이미 열려있고 주문내역인 경우 닫기
  if (panel.classList.contains('active') && !historyView.classList.contains('hidden')) {
    closeRightPanel();
    return;
  }

  // 주문 내역 데이터 로드 및 렌더링
  await loadOrderHistory();

  historyView.classList.remove('hidden');
  cartView.classList.add('hidden');
  panel.classList.add('active');
};

const toggleCart = () => {
  const panel = document.getElementById('rightPanel');
  const historyView = document.getElementById('historyView');
  const cartView = document.getElementById('cartView');

  // 이미 열려있고 장바구니인 경우 닫기
  if (panel.classList.contains('active') && !cartView.classList.contains('hidden')) {
    closeRightPanel();
    return;
  }

  openCart();
};

const openCart = () => {
  const panel = document.getElementById('rightPanel');
  const historyView = document.getElementById('historyView');
  const cartView = document.getElementById('cartView');

  historyView.classList.add('hidden');
  cartView.classList.remove('hidden');
  panel.classList.add('active');
};

const closeRightPanel = () => {
  const panel = document.getElementById('rightPanel');
  if (panel) panel.classList.remove('active');
};

// 외부 영역 클릭 시 닫기 로직
window.addEventListener('mousedown', (e) => {
  const panel = document.getElementById('rightPanel');
  if (!panel || !panel.classList.contains('active')) return;

  // 클릭된 요소가 패널 내부이거나, 패널을 여는 버튼(사이드바 버튼)인 경우 무시
  const isPanel = e.target.closest('.cart-panel');
  const isToggleButton = e.target.closest('.nav-btn');
  const isOptionModal = e.target.closest('.option-modal');
  const isMenuCard = e.target.closest('.menu-card');

  if (!isPanel && !isToggleButton && !isOptionModal && !isMenuCard) {
    closeRightPanel();
  }
});

const loadOrderHistory = async () => {
  try {
    const result = await fetchDataAsync(`/table_order/get_order_history/${STORE.table_id}`, 'GET', {});
    renderOrderHistory(result.data);
  } catch (error) {
    console.error('Order history load error:', error);
  }
};

const renderOrderHistory = (historyData) => {
  const _historyList = document.getElementById('orderHistoryList');
  const _totalOrderPriceEl = document.getElementById('totalOrderPrice');

  if (!historyData || historyData.length === 0) {
    _historyList.innerHTML = `<div style="padding: 40px; text-align: center; color: #999;">주문 내역이 없습니다.</div>`;
    _totalOrderPriceEl.innerText = '0원';
    return;
  }

  let totalSum = 0;
  _historyList.innerHTML = historyData.map(order => {
    totalSum += order.total_price;
    const optionsText = order.options.map(o => `${o.name}(${o.count})`).join(', ');

    return `
            <div class="history-item">
                <div class="top-row">
                    <span class="menu-name">${order.menu_name}</span>
                    <span class="order-time">${order.ordered_at.split(' ')[1]}</span>
                </div>
                ${optionsText ? `<div class="options-text">${optionsText}</div>` : ''}
                <div class="price-row">
                    ${order.total_price.toLocaleString()}원
                </div>
            </div>
        `;
  }).join('');

  _totalOrderPriceEl.innerText = totalSum.toLocaleString() + '원';
};



// 관리자 히든 버튼 로직
let secretClickCount = 0;
let secretClickTimeout;

const adminTriggerBtn = document.getElementById('adminTriggerBtn');
if (adminTriggerBtn) {
  adminTriggerBtn.addEventListener('click', () => {
    secretClickCount++;

    if (secretClickTimeout) {
      clearTimeout(secretClickTimeout);
    }

    if (secretClickCount >= 10) {
      secretClickCount = 0;
      openAdminModal();
    } else {
      // 1초 내에 다음 클릭이 없으면 초기화
      secretClickTimeout = setTimeout(() => {
        secretClickCount = 0;
      }, 1000);
    }
  });
}

const openAdminModal = () => {
  const modal = document.getElementById('adminModal');
  if (modal) {
    modal.classList.add('active');
  }
}

const closeAdminModal = () => {
  const modal = document.getElementById('adminModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

const exitTableOrder = () => {
  // 테이블 선택 화면으로 이동
  window.location.href = '/table_order/login';
}


/* -----------------------------------------------------------
   Overlay & Idle Logic
----------------------------------------------------------- */

let idleTimer = null;
const IDLE_TIMEOUT = 60 * 1000; // 1 minute

const initIdleTimer = () => {
  // Reset timer on any interaction
  ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(evt => {
    document.addEventListener(evt, resetIdleTimer, true);
  });

  // Start initial timer
  resetIdleTimer();
}

const resetIdleTimer = () => {
  if (idleTimer) clearTimeout(idleTimer);

  idleTimer = setTimeout(() => {
    // 1분간 조작 없으면 주문 내역 확인 후 적절한 오버레이 표시
    const hasOrders = hasOrderHistory();

    // 이미 오버레이가 떠있으면 무시 (단, 떠있는 오버레이가 welcome/in-use가 아닐 때만? 
    // 아니면 덮어씌울 필요가 있나? 보통은 그냥 둔다. 
    // 하지만 Welcome/In-use는 서로 전환될 수 있어야 함.)
    if (document.querySelector('.table-overlay.active')) return;

    if (hasOrders) {
      showInUseOverlay();
    } else {
      // 주문 내역 없으면 다시 Welcome 화면
      checkAndShowWelcomeOverlay();
    }
  }, IDLE_TIMEOUT);
}

const hasOrderHistory = () => {
  // Check if order history list has items (excluding "no data" msg)
  const historyList = document.getElementById('orderHistoryList');
  if (!historyList) return false;

  return historyList.querySelectorAll('.history-item').length > 0;
}

const checkAndShowWelcomeOverlay = () => {
  if (!hasOrderHistory()) {
    showOverlay({
      type: 'welcome',
      showCloseBtn: true,
      showTimer: false
    });
  }
}

const showInUseOverlay = () => {
  // Don't show if already showing an overlay (e.g. payment)
  if (document.querySelector('.table-overlay.active')) return;

  showOverlay({
    type: 'in-use',
    showCloseBtn: true,
    showTimer: false
  });
}

const resetTableOrder = () => {
  // 1. Clear Cart
  STORE.menuAllData = [];
  updateCartUI();

  // 2. Clear Order History (UI only, backend data remains until new session starts? 
  // Actually POS payment clears order in backend usually. 
  // We should reload history to confirm it's empty.)
  loadOrderHistory().then(() => {
    // 3. Show Welcome Overlay
    checkAndShowWelcomeOverlay();
  });

  // Close any open panels
  closeRightPanel();
  closeOptionModal();
  closeStaffCallModal();
}

