let mainCategoryData;
let subCategoryData;
let allMenuData;
let menuImgData = [];

// 메인카테고리 데이터 가져오기
const callMainCategoryList = () => {
  const onSuccess = (data) => {
    console.log(data);
    mainCategoryData = data;
    createSeleteBox({ main: data }, 'changeCategory', '.seletebox_main_category', 'main', '메인 카테고리');
  }
  fetchData(`/store/get_main_category`, 'GET', {}, onSuccess)
}
callMainCategoryList();

// 서브카테고리 데이터 가져오기
const callSubCategoryList = (main_category_id = undefined) => {
  const submit_data = main_category_id != undefined ? { main_category_id } : '';
  const onSuccess = (data) => {
    console.log(data);
    subCategoryData = data;
    createSeleteBox({ sub: data }, 'changeCategory', '.seletebox_sub_category', 'sub', '서브카테고리');
  }
  fetchData(`/store/get_sub_category`, 'GET', submit_data, onSuccess)
}
callSubCategoryList();

// 메뉴 데이터 가져오기
const callAllMenuList = () => {
  const onSuccess = (data) => {
    console.log(data);
    allMenuData = data;
    createMenuTable(data);
  }
  fetchData(`/store/all_menu_list`, 'GET', {}, onSuccess)
}
callAllMenuList();

// 메뉴 리스트 테이블 html 만들기
const createMenuTable = (data) => {
  const html = `
    <li class="table_header">
      <div><label class="custom-checkbox"><input type="checkbox" onclick="clickAllCheckBox(event)"><span class="checkmark"></span></label></div>
      <div>메인카테고리</div>
      <div>서브카테고리</div>
      <div>메뉴명</div>
      <div>옵션</div>
      <div>가격</div>
    </li>
    ${data.map(({ id, main_category_id, main_category_name, sub_category_id, sub_category_name, name, price, option }) => `
    <li data-id="${id}" onclick="clickCallMenuData(event)">
      <div>
        <label class="custom-checkbox">
          <input type="checkbox">
          <span class="checkmark"></span>
        </label>
      </div>
      <div>${main_category_name}</div>
      <div>${sub_category_name}</div>
      <div>
        <div class="is_soldout"></div>
        <span>${name}</span>
      </div>
      <div>${option.length == 0 ? `-` : `${option.map((data) => data.option_name).join(', ')}`}</div>
      <div>${price.toLocaleString()}</div>
    </li>`).join('')}
  `
  const _menuTable = document.querySelector('.set_menu_product main article .article_bottom ul');
  _menuTable.innerHTML = html;
  const secondChild = _menuTable.querySelector(`li:nth-child(2)`);
  if (secondChild) {
    secondChild.click();
  }
}

// 셀렉트 박스 html 만들기
// 셀렉트 박스 html 만들기
const createSeleteBox = (category, fun, target, type, ko_category) => {
  const checkedCategorys = category[type].filter(({ checked }) => checked);
  const selectedId = checkedCategorys.length > 0 ? checkedCategorys[0].id : '';

  const html = `
    <select class="input_box" onchange="${fun}(event)">
      <option value="0" ${selectedId == '' || selectedId == 0 ? 'selected' : ''}>${ko_category}</option>
      ${category[type].map(({ id, name }) => `
        <option value="${id}" ${id == selectedId ? 'selected' : ''}>${name}</option>
      `).join('')}
    </select>
  `
  const _selectBox = document.querySelector(target);
  _selectBox.innerHTML = html;
}

// 메인 카테고리 셀렉트 박스에서 현재 메인 카테고리 변경 시
const changeCategory = (event) => {
  const target = event.target;
  if (target.closest(".seletebox_main_category") == undefined) return;
  const category_id = target.value;
  callSubCategoryList(category_id)
}

// 메뉴 영역 확장 버튼 클릭 시
const clickResponsiveBtn = (event) => {
  const _main = document.querySelector('main');
  _main.classList.toggle('open_aside')
}

// 이미지 프리뷰 만들기
function previewImage(event) {
  const _input = event.target;
  const _imgBox = event.target.closest('.img_box');
  const _img = _imgBox.querySelector('img');
  const _mainImgBox = document.querySelector('.main_img');
  const _mainImg = _mainImgBox.querySelector('img');
  const imgBoxIndex = Number(_imgBox.dataset.index);
  if (_input.files && _input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      _img.setAttribute('src', e.target.result);
      menuImgData[imgBoxIndex - 1] = e.target.result;
      _mainImg.setAttribute('src', e.target.result);
    }
    reader.readAsDataURL(_input.files[0]);
    _imgBox.classList.add('active');
    _mainImgBox.classList.add('active');
    _mainImgBox.dataset.index = imgBoxIndex;
  }
}
// 멀티 이미지 프리뷰 만들기 
function multiPreviewImage(event) {
  event.preventDefault();
  const _mainInput = document.querySelector('#main_menu_img');
  const _mainImgBox = document.querySelector('.main_img'); // 변수 정의 위치 이동

  if (_mainInput.files.length > 4) {
    showToast('메뉴 이미지는 최대 4개까지 설정이 가능합니다.', 'warning')
    return;
  }
  if (!_mainInput.files) return;

  for (let i = 0; i < _mainInput.files.length && i < 4; i++) {
    const _imgBox = document.querySelector(`.img_box[data-index="${i + 1}"]`);
    const _img = _imgBox.querySelector('img');
    const reader = new FileReader();
    reader.onload = function (e) {
      _img.setAttribute('src', e.target.result);
      menuImgData[i] = e.target.result;
      if (i == 0) {
        const _mainImg = _mainImgBox.querySelector('img');
        _mainImg.setAttribute('src', e.target.result)
      }
      _imgBox.classList.add('active');
    }
    reader.readAsDataURL(_mainInput.files[i]);
  }
  _mainImgBox.classList.add('active');
  _mainImgBox.dataset.index = 1;
}

// 이미지 클릭 시
const clickMenuImg = (event) => {
  const _img = event.currentTarget;
  const _imgBox = event.target.closest('.img_box');
  const _mainImgBox = document.querySelector('.main_img');
  const _mainImg = _mainImgBox.querySelector('img');
  const imgBoxIndex = Number(_imgBox.dataset.index);
  _mainImg.setAttribute('src', _img.src);
  _mainImgBox.classList.add('active');
  _mainImgBox.dataset.index = imgBoxIndex;
}

// 가격 표시 토글 핸들러 (이벤트 위임 사용 권장하지만, 간단하게 인라인이 아니라 change 이벤트로 처리)
document.addEventListener('change', (e) => {
  if (e.target.dataset.title === 'show_price') {
    const checkbox = e.target;
    const icon = checkbox.nextElementSibling;
    if (checkbox.checked) {
      icon.classList.replace('ph-eye-slash', 'ph-eye');
      icon.style.color = '#1FAA9C';
    } else {
      icon.classList.replace('ph-eye', 'ph-eye-slash');
      icon.style.color = '#CCC';
    }
  }
});

// 이미지 삭제 클릭 시
const clickDeleteImg = (event) => {
  const target = event.target.closest('button');
  const _mainImgBox = document.querySelector('.main_img');
  const _mainImg = _mainImgBox.querySelector('img');

  let imgBoxIndex;
  let _imgBox;

  if (target.closest('.main_img')) {
    imgBoxIndex = Number(_mainImgBox.dataset.index);
    _imgBox = document.querySelector(`.img_box[data-index="${imgBoxIndex}"]`);
  } else {
    _imgBox = target.closest('.img_box');
    imgBoxIndex = Number(_imgBox.dataset.index);
  }

  const _img = _imgBox.querySelector('img');
  menuImgData[imgBoxIndex - 1] = '';
  _img.setAttribute('src', '');
  _imgBox.classList.remove('active');

  // 현재 삭제한 이미지가 메인 이미지에 표시 중이었거나, 메인 이미지 박스에서 삭제를 누른 경우
  if (Number(_mainImgBox.dataset.index) === imgBoxIndex) {
    _mainImg.setAttribute('src', '');
    _mainImgBox.classList.remove('active');
    _mainImgBox.dataset.index = '';

    const _activeImg = document.querySelectorAll('.img_box.active');
    if (_activeImg.length != 0) {
      _mainImg.setAttribute('src', _activeImg[0].querySelector('img').src);
      _mainImgBox.dataset.index = _activeImg[0].dataset.index;
      _mainImgBox.classList.add('active');
    }
  }
}

// 드래그 앤 드랍 핸들러
const handleDragOver = (event) => {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.add('drag_over');
};

const handleDragLeave = (event) => {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('drag_over');
};

const handleDrop = (event) => {
  event.preventDefault();
  event.stopPropagation();
  const target = event.currentTarget;
  target.classList.remove('drag_over');

  const files = event.dataTransfer.files;
  if (!files || files.length === 0) return;

  const isMain = target.classList.contains('main_img');
  if (isMain) {
    if (files.length > 4) {
      showToast('메뉴 이미지는 최대 4개까지 설정이 가능합니다.', 'warning');
      return;
    }
    processFiles(files, true);
  } else {
    const index = Number(target.dataset.index);
    processFiles([files[0]], false, index);
  }
};

// 파일 처리 공통 로직
const processFiles = (files, isMulti = false, targetIndex = 1) => {
  const _mainImgBox = document.querySelector('.main_img');
  const _mainImg = _mainImgBox.querySelector('img');

  for (let i = 0; i < files.length && i < 4; i++) {
    const currentIndex = isMulti ? i + 1 : targetIndex;
    const _imgBox = document.querySelector(`.img_box[data-index="${currentIndex}"]`);
    if (!_imgBox) continue;

    const _img = _imgBox.querySelector('img');
    const reader = new FileReader();
    reader.onload = function (e) {
      const result = e.target.result;
      _img.setAttribute('src', result);
      menuImgData[currentIndex - 1] = result;

      if (isMulti && i === 0) {
        _mainImg.setAttribute('src', result);
        _mainImgBox.classList.add('active');
        _mainImgBox.dataset.index = 1;
      } else if (!isMulti) {
        _mainImg.setAttribute('src', result);
        _mainImgBox.classList.add('active');
        _mainImgBox.dataset.index = currentIndex;
      }
      _imgBox.classList.add('active');
    };
    reader.readAsDataURL(files[i]);
  }
};

const setMenuHtmlEmptyData = {
  id: '',
  imgList: [],
  name: '',
  price: '',
  description: '',
  category: {
    main: [],
    sub: [],
  },
  option_groups: []
}
// 메뉴데이터 수정 html 만들기
const setMenuHtml = ({ id, imgList, name, price, description, category, option_groups, is_soldout }) => {
  const imgCountArray = new Array(4).fill(false);
  const sortImgList = imgList.sort((a, b) => {
    const numA = parseInt(a.match(/_(\d+)\.png/) ? a.match(/_(\d+)\.png/)[1] : 0, 10);
    const numB = parseInt(b.match(/_(\d+)\.png/) ? b.match(/_(\d+)\.png/)[1] : 0, 10);
    return numA - numB;
  });
  const html = `
    <button class="responsive_btn" onclick="clickResponsiveBtn(event)">
      <i class="ph ph-caret-left"></i>
      <i class="ph ph-caret-right"></i>
    </button>
    <div class="top scrollbar_hidden">
      <div class="main_img ${sortImgList[0] != undefined ? `active` : ``}" data-index="1" 
           ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)">
        <label for="main_menu_img"><i class="ph ph-plus"></i></label>
        <input id="main_menu_img" hidden multiple  type="file" onchange="multiPreviewImage(event)">
        <img src="${sortImgList[0] != undefined ? `${sortImgList[0]}` : ``}" alt="">
        <button class="delete_btn" onclick="clickDeleteImg(event)">
          <i class="ph ph-trash"></i>
        </button>
      </div>
      <div class="imgs">
        ${imgCountArray.map((data, index) => {
    const regex = /_(\d+)\.png$/;
    const match = sortImgList[0]?.match(regex);
    let is_match = false;
    let match_img = null;
    if (match && Number(match[1]) == index + 1) {
      is_match = true;
      match_img = sortImgList.shift();
    }
    return `
        <div class="img_box ${is_match ? `active` : ``}" data-index="${index + 1}"
             ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)">
          <label for="menu_img_${index + 1}"><i class="ph ph-plus"></i></label>
          <input data-title="image" data-type="form" id="menu_img_${index + 1}" hidden type="file" onchange="previewImage(event)">
          <img src="${is_match ? `${match_img}` : ``}" alt="" onclick="clickMenuImg(event)">
          <button class="delete_btn" onclick="clickDeleteImg(event)">
            <i class="ph ph-trash"></i>
          </button>
        </div>`
  }).join('')}
      </div>
    </div>
    <div class="middle scrollbar_hidden">
      <div class="row info_row">
        <label for="" class="name_label">
          <span>메뉴명</span>
          <div class="is_soldout ${is_soldout ? 'true' : ''}">
            <span>sold out</span>
            <button onclick="toggleSoldOut(event)" data-soldout="${is_soldout}">
              <div class="ball"></div>
            </button>
            <input type="checkbox" ${is_soldout ? 'checked' : ''}>
          </div>
          <input data-title="name" data-required="true" data-type="form" type="text" value="${name}">
        </label>
        <label for="" class="price_label">
          <span>판매가</span>
          <input data-title="price" data-required="true" data-type="form" type="text" value="${price}">
        </label>
      </div>
      
      <div class="row detail_row">
        <div class="category_side">
          <label for="">
            <span>메인 카테고리</span>
            <div class="dropdown-box seletebox_menu main_category_box">
              ${createCategoryBoxHtml(category, 'main', '메인카테고리')}
            </div>
          </label>
          <label for="">
            <span>서브 카테고리</span>
            <div class="dropdown-box seletebox_menu sub_category_box">
              ${createCategoryBoxHtml(category, 'sub', '서브카테고리')}
            </div>
          </label>
        </div>
        <div class="description_side">
          <label for="">
            <span>메뉴 설명</span>
            <textarea data-title="main_description" data-type="form">${description || ''}</textarea>
          </label>
        </div>
      </div>

      <div class="row option_row">
        <label for="" class="set_menu_options">
          <div class="option_header">
            <span>옵션 그룹</span>
            <button class="add_group_btn" onclick="clickAddOptionGroupBtn(event)">
              <i class="ph ph-plus"></i>
              <span>그룹 추가</span>
            </button>
          </div>
          <div class="menu_option_groups">
            ${option_groups.map((group) => createMenuOptionGroupHtml(group)).join("")}
          </div>
        </label>
      </div>
    </div>
    <div class="bottom">
      <button class="delete" onclick="clickDeleteMenuData(event, ${id})">${id == '' ? '취소' : '삭제'}</button>
      <button class="save" onclick="clickSaveMenuData(event, '${id == '' ? 'POST' : 'PATCH'}', ${id})">
        ${id == '' ? '저장' : '수정'}
      </button>
    </div>
  `
  return html
}

// 메뉴 설정에서 카테고리 html 만들기
// 메뉴 설정에서 카테고리 html 만들기
const createCategoryBoxHtml = (category, type, ko_category) => {
  const checkedCategorys = category[type].filter(({ checked }) => checked);
  const selectedId = checkedCategorys.length > 0 ? checkedCategorys[0].id : '';

  const html = `
    <select 
      class="input_box" 
      data-type="form"
      data-title="${type}_category"
      data-category="${type}"
      onchange="changeSetMenuCategory(event)"
    >
      <option value="" ${selectedId == '' ? 'selected' : ''} disabled hidden>${ko_category}</option>
      ${category[type].map(({ id, name }) => `
        <option value="${id}" ${id == selectedId ? 'selected' : ''}>${name}</option>
      `).join('')}
    </select>
  `
  return html;
}

// 테이블에서 메뉴 클릭 시
const clickCallMenuData = (event) => {
  const target = event.currentTarget;
  const _li = findParentTarget(target, 'li');
  const menu_id = Number(_li.dataset.id);
  // 메뉴 id로 메뉴 데이터 호출 후 html 리로딩
  document.querySelector('.set_menu_product main article .article_bottom ul li.active')?.classList?.remove('active');
  _li.classList.add('active');

  const _asideEl = document.querySelector('.set_menu_product main aside');
  const onSuccess = (data) => {
    console.log(data)
    const html = setMenuHtml(data);
    _asideEl.innerHTML = html;
    setMenuOptionDrag()
  }
  fetchData(`/store/get_menu`, 'GET', { menu_id }, onSuccess)
}

const setMenuOptionDrag = () => {
  // 1. 옵션 그룹 드래그 (그룹 간 순서 변경)
  const groupContainer = document.querySelector('.menu_option_groups');
  if (groupContainer) {
    Sortable.create(groupContainer, {
      animation: 150,
      handle: ".group_drag_btn",
      group: "option_groups" // 그룹끼리만 이동 가능하게
    });
  }

  // 2. 옵션 드래그 (그룹 내 옵션 순서 변경)
  // 모든 .menu_options 컨테이너에 대해 Sortable 적용
  const optionContainers = document.querySelectorAll('.menu_options');
  optionContainers.forEach(el => {
    Sortable.create(el, {
      animation: 150,
      handle: ".drag_btn",
      group: "options" // 옵션끼리만 이동 가능하게 (다른 그룹으로 이동 가능하게 하려면 같은 그룹명 사용)
    });
  });
}

// 메뉴 추가 버튼 클릭 시
const clickAddMenuBtn = (event) => {
  setMenuHtmlEmptyData.category.main = mainCategoryData
  const html = setMenuHtml(setMenuHtmlEmptyData);
  const _asideEl = document.querySelector('.set_menu_product main aside');
  const _tableHeader = document.querySelector('.table_header');

  clickResponsiveBtn(event) // 메뉴 편집 창 열기
  _asideEl.innerHTML = html;
  const _inputName = document.querySelector('input[data-title="name"]');
  _inputName.focus();
}

// 메뉴 옵션 그룹 추가 버튼 클릭 시
const clickAddOptionGroupBtn = (event) => {
  const _groupsEl = document.querySelector('.menu_option_groups');
  const html = createMenuOptionGroupHtml({ name: '', option_type: 'REQUIRED_SINGLE', options: [] });
  _groupsEl.insertAdjacentHTML('beforeend', html);
  setMenuOptionDrag(); // 드래그 핸들러 다시 초기화 (새로 추가된 요소 적용)
}

// 메뉴 옵션 그룹 HTML 만들기
// 메뉴 옵션 그룹 HTML 만들기
const createMenuOptionGroupHtml = ({ id, name, option_type, options, show_price }) => {
  const groupId = id || `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const isShowPrice = show_price !== false;

  return `
    <div class="option_group" data-type="group" data-id="${id || ''}">
      <div class="group_header">
        <div class="group_drag_btn"><i class="ph-fill ph-caret-up-down"></i></div>
        <input type="text" data-title="group_name" placeholder="그룹명 (예: 맵기 선택)" value="${name}">
        <select data-title="option_type">
          <option value="REQUIRED_SINGLE" ${option_type == 'REQUIRED_SINGLE' ? 'selected' : ''}>필수 (하나만)</option>
          <option value="OPTIONAL_SINGLE" ${option_type == 'OPTIONAL_SINGLE' ? 'selected' : ''}>선택 (하나만)</option>
          <option value="MULTIPLE" ${option_type == 'MULTIPLE' ? 'selected' : ''}>다중 선택</option>
          <option value="QUANTITY" ${option_type == 'QUANTITY' ? 'selected' : ''}>수량 조절 (선택)</option>
          <option value="REQUIRED_QUANTITY" ${option_type == 'REQUIRED_QUANTITY' ? 'selected' : ''}>수량 조절 (필수)</option>
        </select>
        
        <div class="is_show_price_toggle">
          <span>가격 표시</span>
          <button onclick="toggleGroupPrice(event)" data-active="${isShowPrice}">
            <div class="ball"></div>
          </button>
          <input type="checkbox" data-title="show_price" ${isShowPrice ? 'checked' : ''}>
        </div>

        <button class="add_option_btn" onclick="clickAddOptionBtn(event)">
          <i class="ph ph-plus"></i>
        </button>
        <button class="delete_group_btn" onclick="this.closest('.option_group').remove()">
          <i class="ph ph-x"></i>
        </button>
      </div>
      <div class="menu_options">
        ${createMenuOptionHtml(options)}
      </div>
    </div>
  `
}

// 메뉴 옵션 추가 버튼 클릭 시
const clickAddOptionBtn = (event) => {
  const _groupEl = event.target.closest('.option_group');
  const _menuOptionsEl = _groupEl.querySelector('.menu_options');
  const html = createMenuOptionHtml([{ name: '', price: '', show_price: true }]);
  _menuOptionsEl.insertAdjacentHTML('beforeend', html);
  // SortableJS handles new children automatically for existing containers
}

// 옵션 input html 만들기
const createMenuOptionHtml = (optionsData) => {
  return optionsData.map(({ name, price }) => `
    <div class="option_item">
      <div class="option_top">
        <div class="drag_btn"><i class="ph-fill ph-caret-up-down"></i></div>
        <button class="delete_btn" onclick="clickDeleteOptionBtn(event)">
          <i class="ph ph-x"></i>
        </button>
      </div>
      <div class="option_inputs">
        <input data-title="option_name" data-type="form" type="text" value="${name}" placeholder="옵션명">
        <div class="price_row">
          <input data-title="option_price" data-type="form" type="text" value="${price}" placeholder="가격">
        </div>
      </div>
    </div>
  `).join('')
}

const toggleGroupPrice = (event) => {
  const btn = event.currentTarget;
  const isActive = JSON.parse(btn.dataset.active);
  btn.dataset.active = !isActive;
  const checkbox = btn.nextElementSibling;
  checkbox.checked = !isActive;
}

const toggleShowPrice = (event) => {
  const btn = event.currentTarget;
  const isActive = JSON.parse(btn.dataset.active);
  btn.dataset.active = !isActive;
  const checkbox = btn.nextElementSibling;
  checkbox.checked = !isActive;
}

// 메뉴 데이터 설정에서 메뉴 카테고리 변경 시
const changeSetMenuCategory = (event) => {
  const target = event.currentTarget;
  const categoryType = target.dataset.category;
  if (categoryType == 'main') {
    const submit_data = { 'main_category_id': Number(target.value) };
    const onSuccess = (data) => {
      console.log(data);
      const _subCategoryEl = document.querySelector('.sub_category_box');
      _subCategoryEl.innerHTML = createCategoryBoxHtml({ 'sub': data }, 'sub', '서브카테고리')
    }
    fetchData(`/store/get_sub_category`, 'GET', submit_data, onSuccess)
  }
}

// 옵션 삭제 버튼 클릭 시 
const clickDeleteOptionBtn = (event) => {
  const target = event.currentTarget;
  const optionBox = target.closest(".option_item");
  optionBox.remove();
}

// 메뉴 데이터 저장 버튼 클릭 시
const clickSaveMenuData = async (event, type, id) => {
  const elements = document.querySelectorAll('*[data-type="form"]');
  const new_data = {};
  const form_data = [];
  let optionsCount = 0;
  elements.forEach((element) => {
    const title = element.dataset.title;
    let value = element.value;
    if (title == 'image') {
      if (!new_data[title]) {
        new_data[title] = [];
      }
      const _imgBox = findParentTarget(element, '.img_box');
      const _img = _imgBox?.querySelector('img');
      const imgData = _img?.getAttribute('src');
      if (imgData == '') return
      form_data.push({
        key: element.id,
        value: imgData.startsWith('/static/images/') ? imgData : getUriToBlobToFile(imgData),
      })
      new_data[title].push(element.id);
    }
    else if (title == 'main_category' || title == 'sub_category') {
      value = Number(element.value);
      new_data[title] = value;
    }
    else if (title == 'option_name' || title == 'option_price' || title == 'show_price') {
      // Skip individual options as they are handled by group loop below
    }
    else {
      new_data[title] = value;
    }
  })

  // 카테고리 유효성 검사
  if (!new_data['main_category']) {
    showToast('메인 카테고리를 선택해주세요.', 'warning');
    return;
  }
  if (!new_data['sub_category']) {
    showToast('서브 카테고리를 선택해주세요.', 'warning');
    return;
  }

  // 옵션 그룹 및 옵션 수집
  new_data.option_groups = [];
  const _groupEls = document.querySelectorAll('.option_group');
  _groupEls.forEach((groupEl) => {
    const groupName = groupEl.querySelector('[data-title="group_name"]').value;
    const optionType = groupEl.querySelector('[data-title="option_type"]').value;
    // 그룹 헤더에서 show_price 체크박스 확인
    const showPriceEl = groupEl.querySelector('.group_header [data-title="show_price"]');
    const showPrice = showPriceEl ? showPriceEl.checked : true;
    const options = [];

    const _optionEls = groupEl.querySelectorAll('.menu_options .option_item');
    _optionEls.forEach((optEl) => {
      const optName = optEl.querySelector('[data-title="option_name"]').value;
      const optPrice = optEl.querySelector('[data-title="option_price"]').value;

      if (optName) {
        options.push({ name: optName, price: optPrice || 0 });
      }
    });

    if (groupName) {
      new_data.option_groups.push({
        name: groupName,
        option_type: optionType,
        show_price: showPrice,
        options: options
      });
    }
  });
  new_data['id'] = id;
  const url = `/store/set_menu`;
  const method = type == 'PATCH' ? 'PATCH' : 'POST';
  const fetchData = {
    json_data: new_data,
    form_data: form_data
  }
  try {
    const result = await fetchDataAsync(url, method, fetchData, true);
    if (result.code == 200 || result.code == 201) {
      showToast(result.msg || result.message, 'success');
      callAllMenuList(); // 메뉴 목록 새로고침
      clickResponsiveBtn(event); // 편집창 닫기
    } else {
      showToast(result.msg || result.message || '저장 중 오류가 발생했습니다.', 'error');
    }
  } catch (error) {
    showToast('서버와의 통신 중 오류가 발생했습니다.', 'error');
  }
}
// 체크박스 전체 토글
const clickAllCheckBox = (event) => {
  const isChecked = event.target.checked;
  const _checkBoxs = document.querySelectorAll('.set_menu_product main article .article_bottom ul li div:first-child input');
  _checkBoxs.forEach((_checkBox) => _checkBox.checked = isChecked)
}

// 전체 선택 버튼 클릭 시
const clickAllSeleteBtn = (e) => {
  const _checkBoxs = document.querySelectorAll('.set_menu_product main article .article_bottom ul li div:first-child input');
  _checkBoxs.forEach((_checkBox) => _checkBox.checked = true)
}

// 전체 취소 버튼 클릭 시
const clickAllCnacelSeleteBtn = (e) => {
  const _checkBoxs = document.querySelectorAll('.set_menu_product main article .article_bottom ul li div:first-child input');
  _checkBoxs.forEach((_checkBox) => _checkBox.checked = false)
}

// 메뉴 삭제 버튼 클릭 시
const clickDeleteMenu = (e) => {
  const _checkBoxs = document.querySelectorAll('.set_menu_product main article .article_bottom ul li:not(.table_header) div:first-child input:checked');

  const menuList = [..._checkBoxs].map((checkBox) => findParentTarget(checkBox, 'li'));
  const menuIdList = menuList.map((menu) => Number(menu.dataset.id));

  // 삭제 api 연결,
  menuList.forEach(async (menu) => {
    const id = Number(menu.dataset.id);
    const url = `/store/set_menu`;
    const method = `DELETE`;
    const fetchData = { id: id };
    const result = await fetchDataAsync(url, method, fetchData);
    if (result.code == 200) {
      menu.remove();
    }
    if (result.code == 422) {
      const name = document.querySelector('.article_bottom ul li:not(:first-child) div:nth-child(4) span').textContent;
      showToast(`${name} : ${result.message}`, 'warning');
    }
  });


}
// 메뉴 상세 보기에서 삭제 클릭 시
const clickDeleteMenuData = async (e, id) => {
  const url = `/store/set_menu`;
  const method = `DELETE`;
  const fetchData = { id: id };
  const result = await fetchDataAsync(url, method, fetchData);
  console.log('result,', result)
  if (result.code == 422) {
    showToast(result.message, 'warning')
    return;
  }
  if (result.code == 200) {
    window.location.reload()
  }
}
const toggleSoldOut = (event) => {
  const _soldOutBtn = event.currentTarget;
  const isSoldOut = JSON.parse(_soldOutBtn.dataset.soldout);
  _soldOutBtn.dataset.soldout = !isSoldOut;
  const _checkBox = _soldOutBtn.nextElementSibling;
  _checkBox.checked = !_checkBox.checked;
}

// 메뉴 조회 페이지 상단 조회 클릭 시
const clickSearchMenuData = async (event) => {
  let main_category_id = document.querySelector('.seletebox_main_category select').value;
  main_category_id = main_category_id == '' || main_category_id == 0 ? null : Number(main_category_id);
  let sub_category_id = document.querySelector('.seletebox_sub_category select').value;
  sub_category_id = sub_category_id == '' || sub_category_id == 0 ? null : Number(sub_category_id);
  const is_name = 0; // 이 부분은 일단 0으로 고정하거나 필요시 수정 (원본 코드 참조)
  const search = document.querySelector('.search_box').value ?? null;

  const fetchData = {};
  if (main_category_id) { fetchData.main_category_id = main_category_id }
  if (sub_category_id) { fetchData.sub_category_id = sub_category_id }
  if (is_name) { fetchData.is_name = is_name }
  if (search) { fetchData.search = search };
  const result = await fetchDataAsync(`/store/all_menu_list`, 'GET', fetchData);
  console.log(result);
  allMenuData = result;
  createMenuTable(result);
}