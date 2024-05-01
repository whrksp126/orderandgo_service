const socket = io.connect('http://' + document.domain + ':' + location.port); 
socket.emit('table_order_login', {user_type: 'table_order'}, (response) => {
  alert(response.msg)
});

const STORE = {
  table_list : null,
  cur_category_index : 0,
  cur_page_index: 0,
  menu_list : null,
  index_data : {
    main: 0,
    sub: 0,
    page: 0
  },
  menuAllData : [],
  currentMenu : null
};

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
  const categoryNum = STORE.cur_category_index;
  const pageNum = STORE.cur_page_index;
  const curData = data[categoryNum].pages[pageNum].tables;
  const categoryHtml = data.sort((a,b)=>a.position - b.position).map((category,index)=> `
    <li data-id="${category.id}" data-state="${index == categoryNum ? 'active': ''}">
      <button onclick="changeTableCategory(event,${index})">${category.name}</button>
    </li>
  `).join('');
  document.querySelector('.table_order main section nav ul').innerHTML = categoryHtml;
  const tableList = new Array(20).fill(false);
  curData.forEach(data => tableList[data.position-1] = data);
  
  const html = tableList.map((table, index)=>`${table?`
    <button class="item" data-id="${table.id}" data-name="${table.name}" data-active="false" data-has="true" data-page="${pageNum}" data-position="${index+1}" onclick="clickTableArea(event)">
      <h2>${table.name}</h2>
      <span>접속</span>
    </button>
  `:`
    <button class="item" data-has="false" data-page="${pageNum}" data-position="${index+1}" onclick=""></button>
  `}`).join('');
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
  const pageLen = STORE.table_list.find((category)=>category.id == Number(curCategoryId)).pages.length;
  if(STORE.cur_page_index < pageLen-1){_article.classList.add('hasNextPage')};
}
// 페이지 변경 클릭 시
const clickChangeTablePosition = (event, type) => {
  if(type == 'prev'){ // 이전 페이지
    STORE.cur_page_index -= 1;
  }
  if(type == 'next') { // 다음 페이지
    STORE.cur_page_index += 1;
  }
  createTableHtml();
}

// 테이블 접속 클릭 시
const clickTableArea = (event) => {
  const table_id = Number(findParentTarget(event.target, '.item').dataset.id);
  window.location.href = `/table_order/main?table_id=${table_id}`;
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
  menuPageData = STORE.menu_list;
  const _mainCatgory = document.querySelector('main section nav.main ul');
  _mainCatgory.innerHTML = menuPageData.map((data,index)=>`
    <li data-id="${data.categoryId}" data-state="${index == STORE.index_data.main ? 'active': ''}">
      <button onclick="changeMenuCategory(event, ${index})">${data.category}</button>
    </li>
  `).join('');

  const _subCatgory = document.querySelector('main section nav.sub ul');
  const subCategoryData = menuPageData[STORE.index_data.main].subCategoryList;
  _subCatgory.innerHTML = subCategoryData.map((data, index)=>`
    <li data-id="${data.subCategoryId}" data-state="${index == STORE.index_data.sub ? 'active': ''}">
      <button onclick="changeMainMenuCategory(event, ${index})">${data.subCategory}</button>
    </li>
  `).join('');

  const _menuList = document.querySelector('main section article .items');
  subCategoryData[STORE.index_data.sub].pageList.sort((a, b) => a.page - b.page);
  const menuListData = subCategoryData[STORE.index_data.sub]?.pageList[STORE.index_data.page]?.menuList ?? [];
  _menuList.innerHTML = changeMenuHtml(menuListData)
  _menuList.setAttribute('data-page', STORE.index_data.page);

  const _article = document.querySelector('main section article')
  const maxPageIndex = STORE.menu_list[STORE.index_data.main].subCategoryList[STORE.index_data.sub].pageList.length - 1;
  _article.classList.remove('hasNextPage');
  _article.classList.remove('hasPrevPage');
  if(0 < STORE.index_data.page){_article.classList.add('hasPrevPage')};
  if(STORE.index_data.page < maxPageIndex){_article.classList.add('hasNextPage')};
}
// 페이지 변경 클릭 시
const clickChageMenuListPageBtn = (event, type) => {
  const maxPageIndex = STORE.menu_list[STORE.index_data.main].subCategoryList[STORE.index_data.sub].pageList.length - 1;
  if(type == 'prev') STORE.index_data.page -= 1;
  if(type == 'next' && STORE.index_data.page < maxPageIndex) STORE.index_data.page += 1;
  createMenuListHtml()
}

// 메뉴 카테고리 변경
const changeMenuCategory = (event, index) => {
  STORE.index_data.main = index;
  STORE.index_data.sub = 0;
  STORE.index_data.page = 0;
  createMenuListHtml()
}

// 서브 카테고리 변경
const changeMainMenuCategory = (event, index) => {
  STORE.index_data.sub = index;
  STORE.index_data.page = 0;
  createMenuListHtml()
}

// 메뉴 html 변경
const changeMenuHtml = (menus) => {
  menus.sort((a,b)=> a.position-b.position);
  const forArray = Array.from({ length: 24 }, () => false);
  menus.forEach((menu)=>forArray[menu.position-1] = menu);
  return forArray.map((menu)=> `
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
  const _optionHtml = document.querySelector('#container.order main section aside');
  const __menu = document.querySelectorAll('main section article .item');

  resetMenuBackground(__menu);

  let hasMenu = false;

  STORE.currentMenu = {
    id: menu.menuId,
    name: menu.menu,
    price: menu.price,
    count: 1,
    options: [],
  }
  STORE.currentMenu.masterName = setMasterName(STORE.currentMenu);

  STORE.menuAllData.push(STORE.currentMenu);
  
  changeBasketHtml(setBasketData(STORE.menuAllData))

  const targetType = 'menu';
  const optionIndex = undefined;

  const basketItems = document.querySelectorAll('.basket li');
  const menuIndex = Array
    .from(basketItems)
    .findIndex(el=> el.querySelector('div').dataset.master == STORE.currentMenu.masterName);

  maintainActive(targetType, menuIndex, optionIndex);


  // 메뉴 옵션 HTML 토글
  if(menu.optionList.length != 0){
    showMenuOptionHtml(menu.optionList)
    _optionHtml.classList.add('active');
    setMenuDisabled(__menu, event.currentTarget);
    document.querySelector('.option_background').classList.add('active');
    
  }else {
    _optionHtml.classList.remove('active');
  }
}

// 장바구니 버튼 클릭 시
const clickBasketBtn = (event) => {
  document.querySelector('.basket_container .count_btns').innerHTML = posMenuListBasketTopBtnsHtml();

  changeBasketHtml(setBasketData(STORE.menuAllData));
  const _basketContainer = document.querySelector('.basket_container');
  _basketContainer.dataset.type="basket";
  const _orderHistoryBtn = document.querySelector('.basket_container > .count_btns button.order_history');

  _orderHistoryBtn.dataset.check = false;
  const _countBtns = document.querySelectorAll('.count_btns button.minus, .count_btns button.plus, .count_btns button.delete');
  _countBtns.forEach(btn=>btn.dataset.active=false);
  closeOptionContainer();

  const _orderBtn = document.querySelector('.order_btns ul li.order button');
  _orderBtn.innerHTML = `주문하기`;
  document.querySelector('.order_btns ul li.order').dataset.iscancel = false;
}

// 카테고리id, 메뉴id 로 메뉴 찾기
const getMenuData = (menuId) => {
  const pageMenuList = STORE.menu_list[STORE.index_data.main].subCategoryList[STORE.index_data.sub].pageList[STORE.index_data.page].menuList;
  return pageMenuList.find((menu)=> menu.menuId == menuId);
};

// 메뉴 백그라운드 제거
const resetMenuBackground = (__menu) => {
  __menu.forEach((_menu, index)=>{
    _menu.classList.remove('disabled');
    _menu.classList.remove('active');
  })
}


// 장바구니 클릭 상태 유지
const maintainActive = (targetType, menuIndex, optionIndex) => {
  const basketItems = document.querySelectorAll('.basket li');
  const basketLength = basketItems.length;
  const _countBtns = document.querySelectorAll('.count_btns button.minus, .count_btns button.plus, .count_btns button.delete');
  if (basketLength === 0) {
    _countBtns.forEach( btn => btn.dataset.active = false);
    return
  };
  let targetEl;
  if(targetType == 'menu'){
    targetEl = basketItems[menuIndex]?.querySelector('[data-type="menu"]');
    if(targetEl == undefined){
      while(menuIndex >= 0){
        if(basketItems[menuIndex]?.querySelector('[data-type="menu"]') != undefined) {
          targetEl = basketItems[menuIndex].querySelector('[data-type="menu"]');
          break
        }
        menuIndex -= 1;
      }
    }
  }else {
    targetEl = basketItems[menuIndex].querySelectorAll('[data-type="menu_option"]')[optionIndex]
    if(targetEl == undefined) {
      while(optionIndex >= 0){
        if(basketItems[menuIndex].querySelectorAll('[data-type="menu_option"]')[optionIndex] != undefined) {
          targetEl = basketItems[menuIndex].querySelectorAll('[data-type="menu_option"]')[optionIndex]
          break
        }
        optionIndex -= 1;
      }
      if(optionIndex == -1){
        targetEl = basketItems[menuIndex].querySelector('[data-type="menu"]');
      }
    }
  }
  _countBtns.forEach( btn => btn.dataset.active = true);
  targetEl.classList.add('active');
}


const showMenuOptionHtml = (optionDatas) => {
  const _optionHtml = document.querySelector('main section aside .items');
  let curPage = 0;
  const optionPageData = optionDatas.reduce((result, item, index) => {
    const groupIndex = Math.floor(index / 8);
    if (!result[groupIndex]) result[groupIndex] = []; 
    result[groupIndex].push(item);
    return result;
  }, []);
  _optionHtml.innerHTML = createMenuOptionsHtml(optionPageData[curPage]);
  const _optionContainer = document.querySelector('.option_container')
  _optionContainer.classList.remove('hasNextPage')
  _optionContainer.classList.remove('hasPrevPage')
  const optionPageLen = optionPageData.length;
  if(optionPageLen>1){
    
    _optionContainer.classList.add('hasNextPage')
    const _nextBtn = document.querySelector('.option_container .next_page_btn');
    const _prevBtn = document.querySelector('.option_container .prev_page_btn');
    _nextBtn.addEventListener('click',(event)=>{
      curPage += 1;
      if(!optionPageData[curPage]) {
        curPage -= 1; 
        return
      };
      if(curPage > 0) { // prev 버튼 보이게 하기
        _optionContainer.classList.add('hasPrevPage')
      }
      if(curPage == optionPageLen-1 ) { // next 버튼 안보이게 하기
        _optionContainer.classList.remove('hasNextPage')
      }
      _optionHtml.innerHTML = createMenuOptionsHtml(optionPageData[curPage]);
    })
    _prevBtn.addEventListener('click',(event)=>{
      curPage -= 1;
      if(!optionPageData[curPage]) {
        curPage += 1; 
        return
      };
      if(curPage == 0){ // prev 버튼 안보이게 하기
        _optionContainer.classList.remove('hasPrevPage')
      }
      if(curPage != optionPageLen -1){
        _optionContainer.classList.add('hasNextPage')
      }
      _optionHtml.innerHTML = createMenuOptionsHtml(optionPageData[curPage]);
    })
  }
}

// 옵션 리스트 HTML 만들기
const createMenuOptionsHtml = (optionPageData) => {
  const maxOptionBox = optionPageData.length < 4 ? 4 : 8
  let html = ``;
  for(let i=0; i<maxOptionBox; i++){
    html += `
    ${optionPageData[i] ? `
    <button data-id="${optionPageData[i].optionId}" class="menu item" onclick="clickMenuOption(event)" >
      <div class="title">
        <h2>${optionPageData[i].option}</h2>
      </div>
      <span class="price">${optionPageData[i].price.toLocaleString()}원</span>
    </button>
    ` : `<button class="menu item hidden"></button>`}
    
    `
  }
  return html
}

// 메뉴 백그라운드 활성화
const setMenuDisabled = (__menu, target) => {
  __menu.forEach((_menu, index)=>{
    _menu.classList.add('disabled');
  })
  target.classList.remove('disabled');
  target.classList.add('active');
}

// 옵션 상자 외부 클릭 시 옵션 상자 닫기
const closeOptionContainer = (event) => {
  document.querySelector('.option_container').classList.remove('active');
  document.querySelector('.option_background').classList.remove('active');
  const __menu = document.querySelectorAll('main section article .item');
    resetMenuBackground(__menu)
}

// 메뉴 옵션 클릭 시
const clickMenuOption = (event) => {
  const menuId = document.querySelector('main section article .item.active').dataset.id;
  const optionId = event.currentTarget.dataset.id;
  const option = getMenuOptionData(menuId, optionId);
  const newOption = {
    id: option.optionId,
    name: option.option,
    price: option.price,
    count: 1,
  }
  let isHas = false;
  STORE.currentMenu = STORE.menuAllData[STORE.menuAllData.length-1]
  STORE.currentMenu.options.forEach((option)=>{
    if(option.id == newOption.id){
      option.count = option.count + 1; 
      isHas = true;
    }
  })
  if(!isHas || STORE.currentMenu.length == 0){
    STORE.currentMenu.options.push(newOption)
  }
  STORE.currentMenu.masterName = setMasterName(STORE.currentMenu);
  changeBasketHtml(setBasketData(STORE.menuAllData))

  const targetType = 'menu_option';
  const basketItems = document.querySelectorAll('.basket li');
  const menuIndex = Array
    .from(basketItems)
    .findIndex(el=> el.querySelector('div').dataset.master == STORE.currentMenu.masterName);
  const optionData = [...basketItems][menuIndex].querySelectorAll('[data-type="menu_option"]')
  const optionIndex = [...optionData].findIndex(el=> el.dataset.id == option.optionId)

  maintainActive(targetType, menuIndex, optionIndex);

}

// 카테고리id, 메뉴id, 옵션id 로 옵션 찾기
const getMenuOptionData = (menuId, optionId) => {
  const pageMenuList = STORE.menu_list[STORE.index_data.main].subCategoryList[STORE.index_data.sub].pageList[STORE.index_data.page].menuList;
  const menu = pageMenuList.find((menu)=> menu.menuId == menuId);
  return menu.optionList.find((option) => option.optionId == optionId);
};

// 장바구니 아이템 클릭 시
const clickBasketMenu = (event) => {
  const __basketMenu = document.querySelectorAll('.basket_container .basket li > div');
  const target = event.currentTarget;
  __basketMenu.forEach((_basketMenu)=>{
    _basketMenu.classList.remove('active');
  })
  target.classList.add('active');
  const _countBtns = document.querySelectorAll('.count_btns button.minus, .count_btns button.plus, .count_btns button.delete');
  _countBtns.forEach(btn=>btn.dataset.active=true);
  closeOptionContainer();
}

// 장바구니 - 클릭 시
const minusBasketMenu = (event) => {
  if(STORE.menuAllData.length == 0) return;
  const basketItems = document.querySelectorAll('.basket li');
  let menuIndex;
  menuIndex = Array
    .from(basketItems)
    .findIndex(el => el.querySelector('div').classList.contains('active'))
  if(menuIndex == -1) {
    menuIndex = Array
      .from(basketItems)
      .findIndex((el)=>el.querySelector('div.active[data-type="menu_option"]') != undefined)
  }

  const target = document.querySelector('.basket li div.active');
  const targetType = target.dataset.type;
  const pargetEl = target.closest('li').querySelector('[data-type="menu"]')
  const masterName = targetType == "menu" ? target.dataset.master : pargetEl.dataset.master;

  let optionIndex = undefined;

  if(targetType == 'menu'){
    const dataIndex = STORE.menuAllData.findIndex(data=>data.masterName == masterName)
    STORE.menuAllData.splice(dataIndex, 1);
  }
  if(targetType == 'menu_option'){
    const filterData = STORE.menuAllData
      .filter(data=>data.masterName == masterName);
    optionIndex = filterData[0].options
      .findIndex(option => Number(option.id) == Number(target.dataset.id));
    if(filterData[0].options[optionIndex].count > 1) {
      filterData.forEach(({options}) => options[optionIndex].count -= 1 );
    }else{
      filterData.forEach((data)=>data.options.splice(optionIndex, 1))
    }
  }
  STORE.menuAllData.forEach(data =>data.masterName = setMasterName(data))
  changeBasketHtml(setBasketData(STORE.menuAllData))
  maintainActive(targetType, menuIndex, optionIndex);
  closeOptionContainer();

}
// 장바구니 + 클릭 시
const plusBasketMenu = (event) => {
  const type = findParentTarget(event.currentTarget, 'aside').dataset.type
  if(type == 'order_list'){
    console.log('주문내역에서 플러스 클릭함')
  }
  if(type == 'basket'){
    if(STORE.menuAllData.length == 0) return;
    const basketItems = document.querySelectorAll('.basket li');
    let menuIndex;
    menuIndex = Array
      .from(basketItems)
      .findIndex(el => el.querySelector('div').classList.contains('active'))
    if(menuIndex == -1) {
      menuIndex = Array
        .from(basketItems)
        .findIndex((el)=>el.querySelector('div.active[data-type="menu_option"]') != undefined)
    }
  
    const target = document.querySelector('.basket li div.active');
    const targetType = target.dataset.type;
    const pargetEl = target.closest('li').querySelector('div[data-type="menu"]')
    const masterName = targetType == "menu" ? target.dataset.master : pargetEl.dataset.master;
    let optionIndex = undefined;
    if(targetType == 'menu'){
      const data = STORE.menuAllData.find(data=>data.masterName == masterName);
      STORE.menuAllData.push(deepCopy(data));
    }
    if(targetType == 'menu_option'){
      const filterData = STORE.menuAllData
        .filter(data =>data.masterName == masterName);
      optionIndex = filterData[0].options
        .findIndex(option => Number(option.id) == Number(target.dataset.id));
      filterData.forEach(({options}) => options[optionIndex].count+=1 );
  
    }
    
    STORE.menuAllData.forEach(data =>data.masterName = setMasterName(data))
    changeBasketHtml(setBasketData(STORE.menuAllData))
    
    maintainActive(targetType, menuIndex, optionIndex);
    closeOptionContainer();
  }
  
}


// 장바구니 삭제 클릭 시
const deleteBasketMenu = (event) => {
  const type = findParentTarget(event.currentTarget, 'aside').dataset.type
  if(type == 'order_list'){
    console.log('주문내역에서 휴지통 클릭함')
  }
  if(type == 'basket'){
    if(STORE.menuAllData.length == 0) return;
  
    const target = document.querySelector('.basket .active');
    const targetType = target.dataset.type;
    const pargetEl = target.closest('li').querySelector('[data-type="menu"]')
    const masterName = targetType == "menu" ? target.dataset.master : pargetEl.dataset.master;
  
    const basketItems = document.querySelectorAll('.basket li');
    let menuIndex;
    menuIndex = Array
      .from(basketItems)
      .findIndex(el => el.querySelector('div').classList.contains('active'))
    if(menuIndex == -1) {
      menuIndex = Array
        .from(basketItems)
        .findIndex((el)=>el.querySelector('div.active[data-type="menu_option"]') != undefined)
    }
  
    let optionIndex = undefined;
    if(targetType == 'menu'){
      STORE.menuAllData = deepCopy(STORE.menuAllData.filter(data => data.masterName != masterName))
    }
    if(targetType == 'menu_option'){
      const filterData = STORE.menuAllData
        .filter(data => data.masterName == masterName);
      optionIndex = filterData[0].options
        .findIndex(option => Number(option.id) == Number(target.dataset.id));
  
      filterData.forEach((data)=>data.options.splice(optionIndex, 1))
    }
    STORE.menuAllData.forEach(data =>data.masterName = setMasterName(data))
    changeBasketHtml(setBasketData(STORE.menuAllData))
    
    maintainActive(targetType, menuIndex, optionIndex);
    closeOptionContainer();
  }
  
}

// 주문하기 클릭 시
const clickOrder = async (event) => {
  const target = findParentTarget(event.target, 'li.order');
  if(target.dataset.iscancel == 'false'){ // 주문하기
    console.log('주문하기')
    const url = `/order`;
    const method = 'POST';
    const fetchData = {
      table_id : getTableIdFromCurrentUrl('table_id'),
      order_list : deepCopy(STORE.menuAllData)
    };
    // const result = await fetchDataAsync(url, method, fetchData);
    // if(result.code == 200){
    // }
    socket.emit('new_order_pos_update', fetchData, (response)=>{
      console.log('response:',response)
    });
  }else{ // 주문취소
    console.log('주문취소')
    const url = `/order/delete_order`;
    const method = `POST`;
    const fetchData = {order_id_list:cancel_order_list.map((data)=>data.order_id)}
    const result = await fetchDataAsync(url, method, fetchData)
    if(result.code == 200){
      window.location.href = '/pos/tableList'
    }
  }
}



if(lastPath == 'login') {
  getTableData();
}
if(lastPath == 'main') {
  const table_id = getTableIdFromCurrentUrl('table_id');
  console.log(table_id)
  getMenuListData();
}
