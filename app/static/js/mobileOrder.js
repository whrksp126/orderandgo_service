/* =============================================================
   mobileOrder.js — QR 손님용 모바일 전용 주문 페이지
   백엔드 API / 소켓 이벤트는 tableOrder.js(데스크톱)와 동일하게 재사용.
   공통 유틸(fetchDataAsync, showToast, showOverlay, setBasketData,
   setMasterName, deepCopy)은 common.js 에서 제공.
   ============================================================= */

if (typeof socket === 'undefined') {
  socket = io();
}

const MO = {
  store_id: null,
  table_id: null,
  menu_list: null,
  menuAllData: [],        // 장바구니(개별 항목 배열)
  currentMenu: null,      // 옵션 모달에서 편집 중인 메뉴
  currentImages: [],
  currentSlideIndex: 0,
  staffCallItems: [],
  staffCallGrid: { rows: 4, cols: 4 },
  selectedStaffCallItems: {},
  activeSheet: null       // 'cart' | 'history' | 'payment' | null
};

// =============================================================
//  초기화
// =============================================================
const initApp = async () => {
  try {
    const info = await fetchDataAsync('/table_order/get_info', 'GET', {});
    MO.store_id = info.store_id;
    window.STORE_ID = info.store_id;
    // QR 손님이면 쿠키 컨텍스트의 table_id 우선, 없으면 URL 파라미터
    MO.table_id = info.table_id || getTableIdFromCurrentUrl('table_id');
    window.TABLE_ID = MO.table_id;

    socket.emit('join_table_order', { store_id: MO.store_id, table_id: MO.table_id });

    // 지오펜스용 위치 미리 확보(권한 프롬프트 워밍업)
    captureGeolocation();

    await getMenuListData();
    await loadOrderHistory();
  } catch (error) {
    console.error('Mobile Order Init Error:', error);
  }
};

document.addEventListener('DOMContentLoaded', initApp);

// =============================================================
//  소켓 이벤트
// =============================================================
socket.on('new_order_notification', (data) => {
  if (data && data.message) showToast(data.message);
  loadOrderHistory();
});

socket.on('payment_finished', () => {
  showToast('결제가 완료되었습니다. 이용해 주셔서 감사합니다 :)', 'success');
  resetTableOrder();
});

// =============================================================
//  메뉴 로드 & 렌더링 (세로 리스트)
// =============================================================
const getMenuListData = async () => {
  const result = await fetchDataAsync('/pos/get_menu_list', 'GET', {});
  MO.menu_list = result;
  renderCategoryTabs();
  renderMenuList();
};

const renderCategoryTabs = () => {
  const tabs = document.getElementById('moCategoryTabs');
  if (!tabs || !MO.menu_list) return;
  tabs.innerHTML = MO.menu_list.map((data, index) => `
    <li data-id="${data.categoryId}" data-state="${index === 0 ? 'active' : ''}">
      <button type="button" onclick="changeMenuCategory(${data.categoryId})">${data.category}</button>
    </li>
  `).join('');
};

const renderMenuList = () => {
  const listEl = document.getElementById('moMenuList');
  if (!listEl) return;

  let html = '';
  MO.menu_list.forEach((categoryData) => {
    categoryData.subCategoryList.forEach((sub, subIdx) => {
      let menus = [];
      sub.pageList.forEach(page => { menus = menus.concat(page.menuList); });
      if (menus.length === 0) return;

      html += `
        <section class="mo-cat-section" data-main-id="${categoryData.categoryId}">
          <h2 class="mo-cat-header">
            <span class="main-cat">${categoryData.category}</span>
            <span class="sep">&gt;</span>
            <span class="sub-cat">${sub.subCategory}</span>
          </h2>
          <div class="mo-menu-rows">
            ${menus.map(menu => createMenuRowHtml(menu)).join('')}
          </div>
        </section>
      `;
    });
  });

  listEl.innerHTML = html || '<div class="mo-empty" style="padding:60px 20px;">등록된 메뉴가 없습니다.</div>';
  setupScrollSpy();
};

const createMenuRowHtml = (menu) => {
  const img = (menu.imageList && menu.imageList.length > 0) ? menu.imageList[0]
    : (menu.imageUrl || '/static/images/common/logo.png');
  const hasImage = !!(menu.imageUrl || (menu.imageList && menu.imageList.length > 0));
  const badge = (menu.optionList && menu.optionList.length > 0) ? '<span class="mo-badge">옵션</span>'
    : (menu.mainDescription && menu.mainDescription.trim()) ? '<span class="mo-badge">상세</span>' : '';

  return `
    <div class="mo-menu-row" data-id="${menu.menuId}" onclick="clickMenu(event)">
      <div class="mo-menu-thumb ${hasImage ? '' : 'no-image'}" style="background-image:url('${img}')">
        ${badge}
      </div>
      <div class="mo-menu-info">
        <h3 class="mo-menu-name">${menu.menu}</h3>
        <span class="mo-menu-price">${menu.price.toLocaleString()}원</span>
      </div>
      <button type="button" class="mo-menu-add"><i class="ph-bold ph-plus"></i></button>
    </div>
  `;
};

// =============================================================
//  카테고리 탭 / 스크롤스파이
// =============================================================
let isScrollingByClick = false;

const getHeaderOffset = () => {
  const header = document.querySelector('.mo-header');
  return (header ? header.offsetHeight : 150) + 12;
};

const changeMenuCategory = (categoryId) => {
  document.querySelectorAll('#moCategoryTabs li').forEach(li => {
    const active = li.getAttribute('data-id') == categoryId;
    li.setAttribute('data-state', active ? 'active' : '');
    if (active && li.scrollIntoView) {
      li.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  });

  const target = document.querySelector(`.mo-cat-section[data-main-id="${categoryId}"]`);
  if (target) {
    isScrollingByClick = true;
    const y = target.getBoundingClientRect().top + window.scrollY - getHeaderOffset();
    window.scrollTo({ top: y, behavior: 'smooth' });
    setTimeout(() => { isScrollingByClick = false; }, 800);
  }
};

const setupScrollSpy = () => {
  const sections = () => document.querySelectorAll('.mo-cat-section');
  window.onscroll = () => {
    if (isScrollingByClick) return;
    const offset = getHeaderOffset();
    let currentId = '';
    sections().forEach(section => {
      const top = section.getBoundingClientRect().top + window.scrollY;
      if (window.scrollY >= top - offset) currentId = section.getAttribute('data-main-id');
    });
    if (currentId) {
      document.querySelectorAll('#moCategoryTabs li').forEach(li => {
        li.setAttribute('data-state', li.getAttribute('data-id') === currentId ? 'active' : '');
      });
    }
  };
};

// =============================================================
//  메뉴 클릭 → 옵션 모달 or 바로 담기
// =============================================================
const getMenuData = (menuId) => {
  for (const category of MO.menu_list) {
    for (const sub of category.subCategoryList) {
      for (const page of sub.pageList) {
        const menu = page.menuList.find(m => m.menuId == menuId);
        if (menu) return menu;
      }
    }
  }
  return null;
};

const clickMenu = (event) => {
  const menuId = event.currentTarget.dataset.id;
  const menu = getMenuData(menuId);
  if (!menu) return;

  MO.currentMenu = {
    id: menu.menuId,
    name: menu.menu,
    price: menu.price,
    count: 1,
    options: [],
    imageUrl: menu.imageUrl || '/static/images/common/logo.png'
  };

  const hasOptions = menu.optionList && menu.optionList.length > 0;
  const hasDescription = menu.mainDescription && menu.mainDescription.trim();

  if (hasOptions || hasDescription) {
    openOptionModal(menu);
  } else {
    addToBasketDirectly();
  }
};

// =============================================================
//  옵션 모달
// =============================================================
const openOptionModal = (menu) => {
  const modal = document.getElementById('moOptionModal');
  document.getElementById('moOptionName').innerText = menu.menu;
  document.getElementById('moOptionPrice').innerText = menu.price.toLocaleString() + '원';

  const descEl = document.getElementById('moOptionDesc');
  if (menu.mainDescription && menu.mainDescription.trim()) {
    descEl.innerText = menu.mainDescription;
    descEl.style.display = 'block';
  } else {
    descEl.innerText = '';
    descEl.style.display = 'none';
  }

  const wrapper = document.getElementById('moSliderWrapper');
  const indicators = document.getElementById('moSliderIndicators');
  const imgList = (menu.imageList && menu.imageList.length > 0) ? menu.imageList : [];
  MO.currentImages = imgList;
  MO.currentSlideIndex = 0;

  if (imgList.length > 0) {
    wrapper.innerHTML = imgList.map(img => `<div class="mo-slide" style="background-image:url('${img}')"></div>`).join('');
    indicators.innerHTML = imgList.map((_, i) => `<div class="mo-indicator ${i === 0 ? 'active' : ''}"></div>`).join('');
  } else {
    const fallback = menu.imageUrl || '/static/images/common/logo.png';
    wrapper.innerHTML = `<div class="mo-slide ${menu.imageUrl ? '' : 'no-image'}" style="background-image:url('${fallback}')"></div>`;
    indicators.innerHTML = '';
  }
  wrapper.style.transform = 'translateX(0)';

  renderOptionItems();

  const slider = document.getElementById('moSlider');
  if (imgList.length > 1) {
    setupSwipeEvents(slider, (delta) => moveSlider(delta));
  }

  modal.classList.add('active');
};

const closeOptionModal = () => {
  document.getElementById('moOptionModal').classList.remove('active');
};

const moveSlider = (delta) => {
  const wrapper = document.getElementById('moSliderWrapper');
  const indicators = document.querySelectorAll('#moSliderIndicators .mo-indicator');
  const next = MO.currentSlideIndex + delta;
  if (next < 0 || next >= MO.currentImages.length) return;

  MO.currentSlideIndex = next;
  wrapper.style.transform = `translateX(-${next * 100}%)`;
  indicators.forEach((ind, i) => ind.classList.toggle('active', i === next));
};

const renderOptionItems = () => {
  const container = document.getElementById('moOptionGroups');
  const menu = getMenuData(MO.currentMenu.id);

  if (!menu.optionList || menu.optionList.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = menu.optionList.map(group => {
    const isSingle = group.option_type === 'REQUIRED_SINGLE' || group.option_type === 'OPTIONAL_SINGLE';
    const isQuantity = group.option_type === 'QUANTITY' || group.option_type === 'REQUIRED_QUANTITY';
    const isRequired = group.option_type === 'REQUIRED_SINGLE' || group.option_type === 'REQUIRED_QUANTITY';

    return `
      <div class="mo-option-group">
        <div class="mo-group-header">
          <h4>${group.name}</h4>
          ${isRequired ? '<span class="mo-required">필수</span>' : ''}
        </div>
        <div class="mo-group-options">
          ${group.options.map(opt => {
            const selected = MO.currentMenu.options.find(o => o.id === opt.id);
            const count = selected ? selected.count : 0;
            const priceHtml = group.show_price !== false ? `<span class="price">+${opt.price.toLocaleString()}원</span>` : '';

            if (isQuantity) {
              return `
                <div class="mo-option-item quantity-type ${count > 0 ? 'active' : ''}">
                  <div class="mo-option-label"><span class="name">${opt.name}</span>${priceHtml}</div>
                  <div class="mo-qty">
                    <button type="button" onclick="changeOptionQuantity(${opt.id}, '${escapeQuote(opt.name)}', ${opt.price}, ${group.id}, '${group.option_type}', -1)">-</button>
                    <span>${count}</span>
                    <button type="button" onclick="changeOptionQuantity(${opt.id}, '${escapeQuote(opt.name)}', ${opt.price}, ${group.id}, '${group.option_type}', 1)">+</button>
                  </div>
                </div>
              `;
            }
            const iconClass = selected
              ? (isSingle ? 'ph-fill ph-radio-button' : 'ph-fill ph-check-square')
              : (isSingle ? 'ph ph-circle' : 'ph ph-square');
            return `
              <div class="mo-option-item ${selected ? 'active' : ''}"
                   onclick="toggleOption(${opt.id}, '${escapeQuote(opt.name)}', ${opt.price}, ${group.id}, '${group.option_type}')">
                <div class="mo-check"><i class="${iconClass}"></i></div>
                <div class="mo-option-label"><span class="name">${opt.name}</span>${priceHtml}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
};

const escapeQuote = (s) => String(s).replace(/'/g, "\\'");

const toggleOption = (id, name, price, groupId, type) => {
  const item = { id, name, price, count: 1, groupId, type };

  if (type === 'REQUIRED_SINGLE' || type === 'OPTIONAL_SINGLE') {
    const existingIdx = MO.currentMenu.options.findIndex(o => o.groupId === groupId);
    if (existingIdx > -1) {
      const existing = MO.currentMenu.options[existingIdx];
      MO.currentMenu.options.splice(existingIdx, 1);
      if (existing.id === id && type === 'OPTIONAL_SINGLE') {
        renderOptionItems();
        return;
      }
    }
    MO.currentMenu.options.push(item);
  } else {
    const existingIdx = MO.currentMenu.options.findIndex(o => o.id === id);
    if (existingIdx > -1) MO.currentMenu.options.splice(existingIdx, 1);
    else MO.currentMenu.options.push(item);
  }
  renderOptionItems();
};

const changeOptionQuantity = (id, name, price, groupId, type, delta) => {
  const existingIdx = MO.currentMenu.options.findIndex(o => o.id === id);
  if (existingIdx > -1) {
    const option = MO.currentMenu.options[existingIdx];
    option.count += delta;
    if (option.count <= 0) MO.currentMenu.options.splice(existingIdx, 1);
  } else if (delta > 0) {
    MO.currentMenu.options.push({ id, name, price, groupId, type, count: 1 });
  }
  renderOptionItems();
};

const addToBasketDirectly = () => {
  MO.currentMenu.masterName = setMasterName(MO.currentMenu);
  MO.menuAllData.push(MO.currentMenu);
  updateCartUI();
  showToast(`${MO.currentMenu.name}이(가) 담겼습니다 :)`);
};

const addToCartFromModal = () => {
  const menu = getMenuData(MO.currentMenu.id);
  if (menu.optionList) {
    for (const group of menu.optionList) {
      if (group.option_type === 'REQUIRED_SINGLE') {
        if (!MO.currentMenu.options.some(o => o.groupId === group.id)) {
          showToast(`'${group.name}' 옵션을 선택해주세요.`);
          return;
        }
      } else if (group.option_type === 'REQUIRED_QUANTITY') {
        const total = MO.currentMenu.options.filter(o => o.groupId === group.id).reduce((s, o) => s + o.count, 0);
        if (total === 0) {
          showToast(`'${group.name}' 옵션을 최소 1개 이상 선택해주세요.`);
          return;
        }
      }
    }
  }

  MO.currentMenu.masterName = setMasterName(MO.currentMenu);
  MO.menuAllData.push(MO.currentMenu);
  updateCartUI();
  closeOptionModal();
  showToast(`${MO.currentMenu.name}이(가) 담겼습니다 :)`);
};

// =============================================================
//  장바구니
// =============================================================
const updateCartBar = (count, total) => {
  const bar = document.getElementById('moCartBar');
  if (!bar) return;
  document.getElementById('moCartCount').innerText = count;
  document.getElementById('moCartTotal').innerText = total.toLocaleString() + '원';
  bar.classList.toggle('visible', count > 0);
};

const updateCartUI = () => {
  const basketData = setBasketData(MO.menuAllData);
  const cartList = document.getElementById('moCartList');
  const totalEl = document.getElementById('moCartTotalPrice');
  const countEl = document.getElementById('moCartItemCount');

  if (basketData.length === 0) {
    cartList.innerHTML = '<div class="mo-empty">장바구니가 비어 있습니다.</div>';
    totalEl.innerText = '0원';
    countEl.innerText = '(0)';
    updateCartBar(0, 0);
    return;
  }

  let totalAmount = 0;
  let totalCount = 0;

  cartList.innerHTML = basketData.map(item => {
    const { data, length, masterName } = item;
    let itemTotal = data.price * length;
    if (data.options) data.options.forEach(opt => { itemTotal += (opt.price * opt.count) * length; });
    totalAmount += itemTotal;
    totalCount += length;

    return `
      <div class="mo-cart-item">
        <div class="mo-cart-top">
          <span class="mo-cart-name">${data.name}</span>
          <button type="button" class="mo-cart-del" onclick="removeCartItem('${masterName}')"><i class="ph ph-x"></i></button>
        </div>
        ${data.options && data.options.length > 0 ? `
          <div class="mo-cart-opts">${data.options.map(o => `${o.name}${o.count > 1 ? ` x${o.count}` : ''}`).join(', ')}</div>
        ` : ''}
        <div class="mo-cart-bottom">
          <span class="mo-cart-price">${itemTotal.toLocaleString()}원</span>
          <div class="mo-qty">
            <button type="button" onclick="changeQuantity('${masterName}', -1)">-</button>
            <span>${length}</span>
            <button type="button" onclick="changeQuantity('${masterName}', 1)">+</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  totalEl.innerText = totalAmount.toLocaleString() + '원';
  countEl.innerText = `(${totalCount})`;
  updateCartBar(totalCount, totalAmount);
};

const removeCartItem = (masterName) => {
  MO.menuAllData = MO.menuAllData.filter(item => item.masterName !== masterName);
  updateCartUI();
};

const changeQuantity = (masterName, delta) => {
  if (delta === 1) {
    const original = MO.menuAllData.find(i => i.masterName === masterName);
    if (original) MO.menuAllData.push(deepCopy(original));
  } else if (delta === -1) {
    const index = MO.menuAllData.findLastIndex(i => i.masterName === masterName);
    if (index > -1) MO.menuAllData.splice(index, 1);
  }
  updateCartUI();
};

// =============================================================
//  바텀시트 (장바구니 / 주문내역 / 결제내역)
// =============================================================
const openSheet = (name) => {
  const map = { cart: 'moCartSheet', history: 'moHistorySheet', payment: 'moPaymentSheet' };
  ['moCartSheet', 'moHistorySheet', 'moPaymentSheet'].forEach(id => {
    document.getElementById(id).classList.toggle('active', id === map[name]);
  });
  document.getElementById('moBackdrop').classList.add('active');
  MO.activeSheet = name;
};

const closeSheet = () => {
  ['moCartSheet', 'moHistorySheet', 'moPaymentSheet'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
  document.getElementById('moBackdrop').classList.remove('active');
  MO.activeSheet = null;
};

const toggleCart = () => {
  if (MO.activeSheet === 'cart') { closeSheet(); return; }
  openSheet('cart');
};

const openOrderHistory = async () => {
  if (MO.activeSheet === 'history') { closeSheet(); return; }
  await loadOrderHistory();
  openSheet('history');
};

const openPaymentHistory = async () => {
  if (MO.activeSheet === 'payment') { closeSheet(); return; }
  await loadPaymentHistory();
  openSheet('payment');
};

// =============================================================
//  주문하기 (지오펜스)
// =============================================================
let _lastCoords = null;
const captureGeolocation = () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => { _lastCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
    () => { _lastCoords = null; },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
  );
};

const getCurrentCoords = () => new Promise((resolve) => {
  if (!navigator.geolocation) { resolve(null); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => resolve(_lastCoords),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
  );
});

const clickOrder = async () => {
  if (MO.menuAllData.length === 0) {
    showToast('장바구니가 비어 있습니다.');
    return;
  }

  const coords = await getCurrentCoords();
  const fetchData = {
    store_id: MO.store_id,
    table_id: MO.table_id,
    order_list: deepCopy(MO.menuAllData),
    lat: coords ? coords.lat : null,
    lng: coords ? coords.lng : null
  };

  socket.emit('new_order_pos_update', fetchData, async (response) => {
    if (response && response.ok === false) {
      showToast(response.message || '주문할 수 없습니다.');
      return;
    }

    MO.menuAllData = [];
    updateCartUI();
    showToast('주문이 완료되었습니다 :)', 'success');
    // 주문 직후 주문 내역을 갱신해 바로 보여준다
    await loadOrderHistory();
    openSheet('history');
  });
};

// =============================================================
//  주문 내역 / 결제 내역
// =============================================================
const loadOrderHistory = async () => {
  try {
    const result = await fetchDataAsync(`/table_order/get_order_history/${MO.table_id}`, 'GET', {});
    renderOrderHistory(result.data);
  } catch (error) {
    console.error('Order history load error:', error);
  }
};

const renderOrderHistory = (historyData) => {
  const list = document.getElementById('moHistoryList');
  const totalEl = document.getElementById('moHistoryTotal');

  if (!historyData || historyData.length === 0) {
    list.innerHTML = '<div class="mo-empty">주문 내역이 없습니다.</div>';
    totalEl.innerText = '0원';
    return;
  }

  let totalSum = 0;
  list.innerHTML = historyData.map(order => {
    totalSum += order.total_price;
    const optionsText = order.options.map(o => `${o.name}(${o.count})`).join(', ');
    return `
      <div class="mo-history-item">
        <div class="mo-history-top">
          <span class="mo-history-name">${order.menu_name}</span>
          <span class="mo-history-time">${order.ordered_at.split(' ')[1]}</span>
        </div>
        ${optionsText ? `<div class="mo-history-opts">${optionsText}</div>` : ''}
        <div class="mo-history-price">${order.total_price.toLocaleString()}원</div>
      </div>
    `;
  }).join('');

  totalEl.innerText = totalSum.toLocaleString() + '원';
};

// 결제 내역 = 현재 식사 세션 영수증 (주문총액 · 결제분 · 남은 금액)
const loadPaymentHistory = async () => {
  try {
    const result = await fetchDataAsync('/table_order/get_current_receipt', 'GET', {});
    renderReceipt(result.data);
  } catch (error) {
    console.error('Receipt load error:', error);
  }
};

const renderReceipt = (data) => {
  const list = document.getElementById('moPaymentList');
  if (!list) return;

  if (!data || (!data.in_use && !(data.payments && data.payments.length))) {
    list.innerHTML = '<div class="mo-empty">현재 이용 내역이 없습니다.</div>';
    return;
  }

  const won = (n) => (n || 0).toLocaleString() + '원';
  const rows = [`<div class="mo-rc-row"><span>주문 총액</span><span>${won(data.order_total)}</span></div>`];
  if (data.discount) rows.push(`<div class="mo-rc-row"><span>할인</span><span class="minus">-${won(data.discount)}</span></div>`);
  if (data.extra_charge) rows.push(`<div class="mo-rc-row"><span>추가 금액</span><span>+${won(data.extra_charge)}</span></div>`);

  if (data.payments && data.payments.length) {
    rows.push('<div class="mo-rc-divider"></div>');
    rows.push('<div class="mo-rc-label">결제한 내역</div>');
    data.payments.forEach(p => {
      const t = p.paid_at ? p.paid_at.slice(0, 5) : '';
      rows.push(`<div class="mo-rc-row"><span>${p.method}${t ? ` <em>${t}</em>` : ''}</span><span class="minus">-${won(p.amount)}</span></div>`);
    });
  }

  rows.push('<div class="mo-rc-divider strong"></div>');
  rows.push(`<div class="mo-rc-total"><span>남은 금액</span><span>${won(data.remaining)}</span></div>`);
  list.innerHTML = `<div class="mo-receipt">${rows.join('')}</div>`;
};

// =============================================================
//  직원 호출
// =============================================================
const clickCallStaff = async () => {
  const modal = document.getElementById('moStaffModal');
  const grid = document.getElementById('moStaffGrid');
  modal.classList.add('active');
  grid.innerHTML = '<div class="mo-loading">항목을 불러오는 중...</div>';

  try {
    const data = await fetchDataAsync(`/table_order/get_staff_call_items?store_id=${MO.store_id}`, 'GET', {});
    MO.staffCallItems = data.items || [];
    MO.staffCallGrid = data.grid || { rows: 4, cols: 4 };
    MO.selectedStaffCallItems = {};
    renderStaffCallItems();
    renderStaffCallSidebar();
  } catch (error) {
    console.error('Staff Call Items Load Error:', error);
    grid.innerHTML = '<div class="mo-loading">항목을 불러오지 못했습니다.</div>';
  }
};

const closeStaffCallModal = () => {
  document.getElementById('moStaffModal').classList.remove('active');
};

const renderStaffCallItems = () => {
  const grid = document.getElementById('moStaffGrid');
  if (MO.staffCallItems.length === 0) {
    grid.style.gridTemplateColumns = '';
    grid.innerHTML = '<div class="mo-loading">등록된 호출 항목이 없습니다.</div>';
    return;
  }

  // 모바일: 열 수는 최대 3열로 제한(원본 그리드가 넓어도 세로로 흐르게)
  // minmax(0,1fr) — 정사각형 아이템의 min-content가 트랙을 밀어내 넘치는 것 방지
  const cols = Math.min(MO.staffCallGrid.cols || 3, 3);
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  const items = [...MO.staffCallItems].sort((a, b) => (a.position || 0) - (b.position || 0));
  grid.innerHTML = items.map(item => {
    const isSelected = MO.selectedStaffCallItems[item.id] !== undefined;
    return `
      <div class="mo-staff-item ${isSelected ? 'active' : ''}" onclick="toggleStaffCallItem(${item.id})">
        ${item.image
          ? `<img src="${item.image}"><span class="name">${item.name}</span>`
          : `<span class="name text-only">${item.name}</span>`}
      </div>
    `;
  }).join('');
};

const renderStaffCallSidebar = () => {
  const selectedList = document.getElementById('moStaffSelected');
  const ids = Object.keys(MO.selectedStaffCallItems);

  if (ids.length === 0) {
    selectedList.innerHTML = '<div class="mo-empty">필요한 항목을 선택하거나, 바로 호출하기를 눌러주세요.</div>';
    return;
  }

  selectedList.innerHTML = ids.map(id => {
    const item = MO.staffCallItems.find(i => i.id == id);
    const qty = MO.selectedStaffCallItems[id];
    return `
      <div class="mo-staff-selected-item">
        <span class="name">${item.name}</span>
        ${item.use_quantity ? `
          <div class="mo-qty">
            <button type="button" onclick="updateStaffCallQty(${item.id}, -1)">-</button>
            <span>${qty}</span>
            <button type="button" onclick="updateStaffCallQty(${item.id}, 1)">+</button>
          </div>
        ` : ''}
        <button type="button" class="mo-staff-del" onclick="removeStaffCallItem(${item.id})"><i class="ph-bold ph-x"></i></button>
      </div>
    `;
  }).join('');
};

const toggleStaffCallItem = (itemId) => {
  if (MO.selectedStaffCallItems[itemId] !== undefined) delete MO.selectedStaffCallItems[itemId];
  else MO.selectedStaffCallItems[itemId] = 1;
  renderStaffCallItems();
  renderStaffCallSidebar();
};

const updateStaffCallQty = (itemId, delta) => {
  let qty = (MO.selectedStaffCallItems[itemId] || 1) + delta;
  if (qty <= 0) delete MO.selectedStaffCallItems[itemId];
  else MO.selectedStaffCallItems[itemId] = qty;
  renderStaffCallItems();
  renderStaffCallSidebar();
};

const removeStaffCallItem = (itemId) => {
  delete MO.selectedStaffCallItems[itemId];
  renderStaffCallItems();
  renderStaffCallSidebar();
};

const requestStaffCall = async () => {
  const requests = Object.keys(MO.selectedStaffCallItems).map(id => ({
    item_id: parseInt(id),
    quantity: MO.selectedStaffCallItems[id]
  }));

  try {
    const result = await fetchDataAsync('/table_order/request_staff_call', 'POST', {
      store_id: MO.store_id,
      table_id: MO.table_id,
      requests
    });
    if (result.message === 'Success') {
      showToast('직원 호출이 완료되었습니다.');
      closeStaffCallModal();
    }
  } catch (error) {
    console.error('Staff Call Request Error:', error);
    showToast('호출 요청 중 오류가 발생했습니다.');
  }
};

// =============================================================
//  결제 완료 후 상태 초기화
// =============================================================
const resetTableOrder = () => {
  MO.menuAllData = [];
  updateCartUI();
  loadOrderHistory();
  closeSheet();
  closeOptionModal();
  closeStaffCallModal();
};

// =============================================================
//  스와이프 감지 (옵션 모달 이미지 슬라이더)
// =============================================================
const setupSwipeEvents = (element, callback) => {
  let startX = 0, startY = 0, dragging = false;

  const start = (e) => {
    dragging = true;
    startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
  };
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    const endX = e.type.includes('touch') ? e.changedTouches[0].clientX : e.clientX;
    const endY = e.type.includes('touch') ? e.changedTouches[0].clientY : e.clientY;
    const dx = endX - startX, dy = endY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      callback(dx > 0 ? -1 : 1);
    }
  };

  element.addEventListener('touchstart', start, { passive: true });
  element.addEventListener('touchend', end, { passive: true });
  element.addEventListener('mousedown', start);
  window.addEventListener('mouseup', (e) => { if (dragging) end(e); });
  element.addEventListener('dragstart', (e) => e.preventDefault());
};
