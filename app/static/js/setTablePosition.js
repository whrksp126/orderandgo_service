let tableData;
let curCategoryIndex = 0;
let curPage = 0;
let state = {
  has_click_item : false,
  click_item : null,
}

// 테이블 리스트 호출
const callTableList = () => {
  const onSuccess = (data) => {
    console.log(data);
    tableData=data;
    createTableHtml(data, curCategoryIndex, curPage);
  }
  fetchData(`/store/get_table`, 'GET', {}, onSuccess);
}
callTableList();

// 테이블 html 만들기
const createTableHtml = (data, categoryNum, pageNum) => {
  const curData = data[categoryNum].pages[pageNum].tables;
  const categoryHtml = data.sort((a,b)=>a.position - b.position).map((category,index)=> `
    <li data-id="${category.id}" data-state="${index == categoryNum ? 'active': ''}">
      <button onclick="changeTableCategory(event,${index})">${category.name}</button>
    </li>
  `).join('');
  document.querySelector('.set_table_position main section nav ul').innerHTML = categoryHtml;
  const tableList = new Array(20).fill(false);
  curData.forEach(data => tableList[data.position-1] = data);
  
  const html = tableList.map((table, index)=>`${table?`
    <button class="item" data-id="${table.id}" data-name="${table.name}" data-active="false" data-has="true" data-page="${pageNum}" data-position="${index+1}" onclick="clickTableArea(event)">
      <h2>${table.name}</h2>
      <div class="icons">
        <i class="ph ph-pencil"></i>
        <i class="ph ph-trash"></i>
      </div>
      <div class="active"><i class="ph ph-arrows-out-cardinal"></i></div>
    </button>
  `:`
    <button class="item" data-has="false" data-page="${pageNum}" data-position="${index+1}" onclick="clickTableArea(event)"><i class="ph ph-plus"></i></button>
  `}`).join('');
  const _items = document.querySelector('.set_table_position main section article .items');
  _items.innerHTML = html;

  const _article = document.querySelector('main section article');

  _article.classList.toggle('hasPrevPage', data[categoryNum].pages[pageNum - 1] !== undefined);
  _article.classList.toggle('hasNextPage', data[categoryNum].pages[pageNum + 1] !== undefined);

}

// 카테고리 클릭 시
const changeTableCategory = (event, index) => {
  curCategoryIndex = index;
  const _table = document.querySelector('main section article .items');
  const PAGE_INDEX = 0;
  createTableHtml(tableData, index, PAGE_INDEX);  
  _table.setAttribute('data-page', PAGE_INDEX);
  const _article = document.querySelector('main section article');
  _article.classList.remove('hasNextPage');
  _article.classList.remove('hasPrevPage');
  const curCategoryId = document.querySelector('main section nav ul li[data-state="active"]').dataset.id;
  const pageLen = tableData.find((category)=>category.id == Number(curCategoryId)).pages.length;
  if(PAGE_INDEX < pageLen-1){_article.classList.add('hasNextPage')};
}

// 테이블 영역 클릭 시
const clickTableArea = async (event) => {
  const _target = findParentTarget(event.target, 'button.item');
  const isHas = JSON.parse(_target.dataset.has);
  const page = Number(_target.dataset.page);
  const position = Number(_target.dataset.position);
  const name = _target.dataset.name;
  if(isHas){ // 유효한 테이블 클릭
    const isTrash = findParentTarget(event.target, 'i.ph-trash') != undefined ? true : false;
    const isSetName = findParentTarget(event.target, 'i.ph-pencil') != undefined ? true : false;
    if(isSetName || isTrash){ // 연필 클릭 시
      const tableName = _target.dataset.name;
      const id = Number(_target.dataset.id);
      const modal = openDefaultModal();
      modal.top.innerHTML = modalTopHtml('테이블 명 변경');
      modal.middle.innerHTML = `
        <h3>테이블 명</h3>
        <input type="text" value="${tableName}"/>
      `;
      const btns = [
        {class:`red`, text:`삭제`, fun:`onclick="callDeleteTable(event, ${id})"`},
        {class:`brand_fill`, text:`저장`, fun:`onclick="callChangeTableName(event,${id})"`},
      ]
      modal.bottom.innerHTML = modalBottomHtml(btns);
      return;
    }
    if(state.has_click_item){ // 테이블 위치 변경 api 요청
      const data = {
        table_id_fir : Number(_target.dataset.id),
        table_id_sec : state.click_item.id,
      }
      const onSuccess = () => {
        // 이전 클릭 테이블 변경
        const _preTarget = state.click_item.el;
        _preTarget.dataset.active = false;
        _preTarget.dataset.id = _target.dataset.id;
        _preTarget.dataset.name = _target.dataset.name;
        _preTarget.querySelector('h2').innerHTML = _target.dataset.name;
  
        // 현재 클릭 테이블 변경
        _target.dataset.active = false;
        _target.dataset.id = state.click_item.id;
        _target.dataset.name = state.click_item.name;
        _target.querySelector('h2').innerHTML = state.click_item.name;
        state.has_click_item=false;
        state.click_item = null;
      }
      
      await callChangeTablePostion(data, onSuccess);
      return;
    }
    _target.dataset.active = true;
    state.has_click_item = true;
    state.click_item = {
      id: Number(_target.dataset.id),
      page: page,
      position: position,
      name: name,
      el: _target
    }
    // 클릭 테이블 이동 준비;
  }else{ // 빈 테이블 클릭
    if(state.has_click_item){ // 테이블 위치 변경 api 요청
      const _preTarget = state.click_item.el;
      _preTarget.dataset.active = false;
      _preTarget.dataset.has = false;
      _preTarget.innerHTML = `<i class="ph ph-plus"></i>`;

      _target.dataset.active = false;
      _target.dataset.has = true;
      _target.dataset.id = state.click_item.id;
      _target.dataset.name = state.click_item.name;
      _target.innerHTML = `
        <h2>${state.click_item.name}</h2>
        <div class="icons">
          <i class="ph ph-pencil"></i>
          <i class="ph ph-trash"></i>
        </div>
        <div class="active"><i class="ph ph-arrows-out-cardinal"></i></div>
      `
      state.has_click_item=false;
      state.click_item = null;
      return ;
    }else{
      // 테이블 추가 api 요청;
      const url = `/adm/create_table`;
      const method = 'POST';
      console.log('curCategoryIndex,,',curCategoryIndex)
      const fetchData = {
        name :`${tableData[curCategoryIndex].name} ${position}`,
        seat_count : 4,
        table_category: tableData[curCategoryIndex].id,
        page : page+1,
        position : position,
      };
      const result = await fetchDataAsync(url, method, fetchData);
      console.log('result,',result)
      _target.dataset.has = true;
      _target.dataset.name = `${tableData[curCategoryIndex].name} ${position}`;
      _target.dataset.id = result.table_id;
      _target.innerHTML = `
        <h2>${tableData[curCategoryIndex].name} ${position}</h2>
        <div class="icons">
          <i class="ph ph-pencil"></i>
          <i class="ph ph-trash"></i>
        </div>
        <div class="active"><i class="ph ph-arrows-out-cardinal"></i></div>
      `
    }
  }
}

const callChangeTablePostion = async (data, onSuccess) => { // 테이블 위치 변경
  fetchData('/adm/update_table_position', 'PATCH', data, onSuccess)
}

const callDeleteTable = async (event, id) => { // 테이블 삭제
  const result = await fetchDataAsync(`/store/set_table`, 'DELETE', {id: id});
  if(result.code != 200) alert(result.msg);
  const target = document.querySelector(`button.item[data-id="${id}"]`);
  target.dataset.has = false; 
  target.innerHTML = `<i class="ph ph-plus"></i>`;
  document.querySelector('.modal').click();
}
const callChangeTableName = async (event, id) => {
  const _modal = document.querySelector('.modal');
  const text = _modal.querySelector('input[type="text"]').value;
  const data = {
    table_id : id,
    name : text,
  }
  const result = await fetchDataAsync('/adm/update_table_name', 'PATCH', data)
  if(result.code != 200){
    return alert(result.msg);
  }
  const target = document.querySelector(`button.item[data-id="${id}"]`)
  target.querySelector('h2').innerHTML = text;
  target.dataset.name = text;
  removeModal();
}

// 페이지 변경 클릭 시
const clickChangeTablePosition = (event, type) => {
  if(type == 'prev'){ // 이전 페이지
    curPage -= 1;
  }
  if(type == 'next') { // 다음 페이지
    curPage += 1;
  }
  createTableHtml(tableData, curCategoryIndex, curPage);
}

// 테이블 카테고리 수정 버튼 클릭 시
const clickSetTableCategoryBtn = () => {
  const modal = openDefaultModal();
  modal.container.classList.add('category');
  modal.top.innerHTML = modalTopHtml('구역 설정');
  modal.middle.innerHTML = modalSetTableCategoryHtml(tableData);
  const btns = [
    {class: "close brand", text: "취소", fun: ``},
    {class: "brand_fill", text: "저장", fun: `onclick="clickSetTabelCategroySaveBtn(event)"`}
  ]
  modal.bottom.innerHTML = modalBottomHtml(btns);
  new Sortable(document.querySelector('.modal_middle ul'), {
    handle: '.move',
    animation: 150
  });
}

// 테이블 카테고리 수정 내용 저장 버튼 클릭 시
const clickSetTabelCategroySaveBtn = async (event) => {
  const __category = document.querySelectorAll('.modal_middle li');
  let isSuccess = true;
  const items = [... __category].map((_category, index)=>{
    const name = _category.querySelector('input').value
    const item = {
      id: _category.dataset.id == '' ? null : Number(_category.dataset.id),
      category_name: name,
      position : index+1
    }
    if(name.replace(/\s+/g, '').length < 2){
      isSuccess = false;
      _category.querySelector('input').classList.add('required');
    }
    return item
  })
  if(!isSuccess) return alert('구역명이 올바르지 않습니다.');
  const url = `/store/set_table_category`;
  const method = 'POST'
  const fetchData = items
  const result = await fetchDataAsync(url, method, fetchData);
  console.log(result)
  if(result.code != 200){
    return alert(result.msg);
  }
  alert(result.msg)
  window.location.reload();
}

// 카테고리 추가 버튼 클릭 시
const clickAddCategoryBtn = (event) => {
  const _ul = document.querySelector('.modal_middle ul');
  _ul.insertAdjacentHTML('beforeend', modalAddCategroyLiHtml());
}

// 카테고리 아이템 삭제 버튼 클릭 시
const clickDeleteCategoryItem = async (event) => {
  const _li = findParentTarget(event.target, 'li');
  const id = _li.dataset.id == '' ? null : Number(_li.dataset.id);
  if(id){ // 이용 중인 테이블이 있는지 확인하는 api 통신
    const url = '/store/get_table_id_yn';
    const method = 'GET';
    const fetchData = {id:id};
    const result = await fetchDataAsync(url, method, fetchData);
    console.log('result,', result);
    if(result.status){
      _li.remove(); 
    }else{
      alert('이용 중인 테이블 있어 삭제가 불가능합니다.')
    }
  }
}