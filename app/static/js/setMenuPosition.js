let curCategoryIndex = 0;
let curPage = 0;
let menuData;
let state = {
  has_click_item : false,
  click_item : null,
}
let indexData = {
  main: 0,
  sub: 0,
  page: 0
}
const initGetMenuList = async () => {
  const url = `/pos/get_menu_list`;
  const method = `GET`;
  const fetchData = {};
  const result = await fetchDataAsync(url, method, fetchData);
  console.log(result);
  menuData = result;
  createHtml(result);
}
initGetMenuList();

const createHtml = (menuPageData) => {
  const _mainCatgory = document.querySelector('main section nav.main ul');
  _mainCatgory.innerHTML = menuPageData.map((data,index)=>`
    <li data-id="${data.categoryId}" data-state="${index == indexData.main ? 'active': ''}">
      <button onclick="changeMenuCategory(event, ${index})">${data.category}</button>
    </li>
  `).join('');


  const _subCatgory = document.querySelector('main section nav.sub ul');
  const subCategoryData = menuPageData[indexData.main].subCategoryList;
  _subCatgory.innerHTML = subCategoryData.map((data, index)=>`
    <li data-id="${data.subCategoryId}" data-state="${index == indexData.sub ? 'active': ''}">
      <button onclick="changeMainMenuCategory(event, ${index})">${data.subCategory}</button>
    </li>
  `).join('');

  const _menuList = document.querySelector('main section article .items');
  subCategoryData[indexData.sub].pageList.sort((a, b) => a.page - b.page);
  const menuListData = subCategoryData[indexData.sub]?.pageList[indexData.page]?.menuList ?? [];
  _menuList.innerHTML = changeMenuHtml(menuListData)
  _menuList.setAttribute('data-page', indexData.page);

  const _article = document.querySelector('main section article')
  const maxPageIndex = menuData[indexData.main].subCategoryList[indexData.sub].pageList.length - 1;
  _article.classList.remove('hasNextPage');
  _article.classList.remove('hasPrevPage');
  console.log(indexData.page, maxPageIndex)
  if(0 < indexData.page){_article.classList.add('hasPrevPage')};
  if(indexData.page < maxPageIndex){_article.classList.add('hasNextPage')};
}

// 메뉴 html 변경
const changeMenuHtml = (menus) => {
  console.log('menus,',menus)
  menus.sort((a,b)=> a.position - b.position);
  const forArray = Array.from({ length: 24 }, () => false);
  menus.forEach((menu)=>forArray[menu.position-1] = menu);
  return forArray.map((menu,index)=> `
    ${menu == false ? `
      <button class="menu item hidden" data-active="false" data-page="${indexData.page+1}" data-position="${index+1}" onclick="clickMenu(event)"></button>` 
      : `
      <button class="menu item" 
        data-active="${state.has_click_item && menu.menuId == Number(state.click_item.id) ? `true` : `false`}" 
        data-id="${menu.menuId}" 
        data-name="${menu.menu}" 
        data-price="${menu.price}" 
        data-page="${indexData.page+1}" 
        data-position="${index+1}" 
        onclick="clickMenu(event)"
      >
        <div class="title">
          <h2 class="ellipsis">${menu.menu}</h2>
        </div>
        <span class="price">${menu.price.toLocaleString()}원</span>
        <div class="active"><i class="ph ph-arrows-out-cardinal"></i></div>
      </button>
    ` }
  `).join('');
}

// 메뉴 영역 클릭 시
const clickMenu = async (event) => {
  const _target = event.currentTarget;
  const isHidden = _target.classList.contains('hidden');
  if(isHidden && !state.has_click_item) { // 빈 영역만 클릭 
    return
  }
  const name = _target.dataset.name;
  const price = Number(_target.dataset.price);
  const page = Number(_target.dataset.page);
  const position = Number(_target.dataset.position);
  if(!isHidden && !state.has_click_item){ // 유효 메뉴 클릭, active가 없음  
    _target.dataset.active = !JSON.parse(_target.dataset.active);
    state.has_click_item = true;
    state.click_item = {
      id: Number(_target.dataset.id),
      page: page,
      position: position,
      name: name,
      price: price,
      el: _target,
      main: menuData[indexData.main].categoryId,
      mainIndex: indexData.main,
      sub : menuData[indexData.main].subCategoryList[indexData.sub].subCategoryId,
      subIndex: indexData.sub
    }
    return 
  }
  if(state.has_click_item) { // 유효 메뉴 클릭, active가 있음
    if(_target.dataset.id == state.click_item.id){ // 동일 메뉴 클릭 시
      state.has_click_item = false;
      state.click_item = null;
      _target.dataset.active = false;
      return;
    }
    // 위치 변경 api
    if(isHidden){ // 단일 위치 변경
      const url = `/store/set_menu_position`;
      const method = 'PATCH';
      const fetchData = [{
        menu_id : state.click_item.id,
        sub_category_id : menuData[indexData.main].subCategoryList[indexData.sub].subCategoryId,
        page : page,
        position : position
      }]
      const result = await fetchDataAsync(url, method, fetchData);
      if(result.code != 200){
        return alert(result.msg);
      }
      const mainIndex = state.click_item.mainIndex;
      const subIndex = state.click_item.subIndex;
      const menuId = state.click_item.id;
      const pageList = menuData[mainIndex].subCategoryList[subIndex].pageList;
      const pageIndex = pageList.findIndex(p => p.page == state.click_item.page);
      const menuList = pageList[pageIndex].menuList;
      const menuIndex = menuList.findIndex(m => m.menuId == menuId);
      if (menuIndex !== -1) {
        const foundMenu = menuList.splice(menuIndex, 1)[0];
        foundMenu.position = position
        foundMenu.page = page
        menuData[indexData.main]
          .subCategoryList[indexData.sub]
          .pageList
          .find(data=> data.page == page)
          .menuList
          .push(foundMenu)
      }
      state.has_click_item=false;
      state.click_item=null;
      createHtml(menuData)

    }else{ // 멀티 위치 변경
      const url = `/store/set_menu_position`;
      const method = 'PATCH';
      const fetchData = [{
        menu_id : state.click_item.id,
        sub_category_id : menuData[indexData.main].subCategoryList[indexData.sub].subCategoryId,
        page : Number(_target.dataset.page),
        position : Number(_target.dataset.position)
      },{
        menu_id : Number(_target.dataset.id),
        sub_category_id : state.click_item.sub,
        page : state.click_item.page,
        position : state.click_item.position
      }]
      const result = await fetchDataAsync(url, method, fetchData);
      if(result.code != 200){
        return alert(result.msg);
      }
      const firTargetData = menuData[state.click_item.mainIndex]
        .subCategoryList[state.click_item.subIndex]
        .pageList
        .find(data=>data.page == state.click_item.page)
        .menuList
        .find(data=>data.menuId == state.click_item.id);
      const secTargetData = menuData[indexData.main]
        .subCategoryList[indexData.sub]
        .pageList
        .find(data=>data.page == Number(_target.dataset.page))
        .menuList
        .find(data=>data.menuId == Number(_target.dataset.id));

      const temp = {...firTargetData};
      for (let key of ['menu', 'menuId', 'optionList', 'price']) {
        firTargetData[key] = secTargetData[key];
        secTargetData[key] = temp[key];
      }
      state.has_click_item=false;
      state.click_item=null;
      createHtml(menuData)
    }
    return 
  }
}

// 페이지 변경 클릭 시
const clickChageMenuListPageBtn = (event, type) => {
  const maxPageIndex = menuData[indexData.main].subCategoryList[indexData.sub].pageList.length - 1;
  if(type == 'prev') indexData.page -= 1;
  if(type == 'next' && indexData.page < maxPageIndex) indexData.page += 1;
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

// 카테고리 설정 클릭 시
const clickSetCategory = (event, type) => {
  const modal = openDefaultModal();
  modal.container.classList.add('category');
  let categorys = [];
  if(type == 'MAIN'){
    modal.top.innerHTML = modalTopHtml('메인 카테고리 설정');
    categorys = menuData.map(data => ({
      name: data.category,
      id: data.categoryId
    }));    
  }else{
    modal.top.innerHTML = modalTopHtml('서브 카테고리 설정');
    categorys = menuData[indexData.main].subCategoryList.map(data => ({
      name: data.subCategory,
      id : data.subCategoryId
    }));
  }
  modal.middle.innerHTML = modalSetMenuMainCategoryHtml(categorys, type);
  const btns = [
    {class: 'brand close',text: '취소', fun: ''},
    {class: 'brand_fill close',text: '저장', fun: `onclick="clickSetMenuCategoryData(event, '${type}')"`}
  ]
  modal.bottom.innerHTML = modalBottomHtml(btns);

  new Sortable(document.querySelector('.modal_middle ul'), {
    handle: '.move',
    animation: 150
  });
}

// 카테고리 추가 버튼 클릭 시
const clickAddCategoryBtn = (event) => {
  const _ul = document.querySelector('.modal_middle ul');
  _ul.insertAdjacentHTML('beforeend', modalAddCategroyLiHtml());
}

// 카테고리 삭제 버튼 클릭 시
const clickDeleteCategoryItem = async (event, type) => {
  const _li = findParentTarget(event.target, 'li');
  const id = _li.dataset.id == '' ? null : Number(_li.dataset.id);
  console.log(type)
  if(id){ // 이용 중인 메뉴 카테고리가 있는지 확인하는 api 통신
    const url = `/adm/check_delete_category`;
    const method = 'GET';
    const fetchData =  type == "MAIN" ? {main_category_id:id} : {sub_category_id:id};
    const result = await fetchDataAsync(url, method, fetchData);
    console.log('result,', result);
    if(result.status){
      _li.remove(); 
    }else{
      alert('식사 중인 메뉴가 포함된 카테고리는 삭제할 수 없습니다.')
    }
  }
}

// 카테고리 데이터 수정 저장 시
const clickSetMenuCategoryData = async (event, type) => {
  console.log(type)
  const __li = document.querySelectorAll('.modal_middle > div ul li');
  const url = `/adm/update_${type=='MAIN'? 'main':'sub'}_category`;
  const method = 'PATCH';
  const fetchData = {
    [`${type == 'MAIN' ? 'main' : 'sub'}_category_list`] : 
    [...__li].map((_li, index)=>{
      return {
        id : Number(_li.dataset.id),
        name : _li.querySelector('.input_box input').value,
        position : index + 1
      };
    })
  }
  console.log(fetchData)
  const result = await fetchDataAsync(url, method, fetchData);
  console.log(result)
  
}