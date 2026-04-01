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
    const asideMainBox = document.querySelector('.set_menu_product main aside .main_category_box');
    if (asideMainBox) {
      asideMainBox.innerHTML = createInlineCategoryManagerHtml({ main: data }, 'main');
      initCategoryManagerDrag();
    }
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
    const asideSubBox = document.querySelector('.set_menu_product main aside .sub_category_box');
    if (asideSubBox) {
      asideSubBox.innerHTML = createInlineCategoryManagerHtml({ sub: data }, 'sub');
      initCategoryManagerDrag();
    }
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
  const isEmpty = category[type].length === 0;
  const defaultLabel = isEmpty ? '카테고리 없음' : ko_category;

  const html = `
    <select class="input_box" onchange="${fun}(event)" ${isEmpty ? 'disabled' : ''}>
      <option value="0" ${selectedId == '' || selectedId == 0 ? 'selected' : ''}>${defaultLabel}</option>
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
            <div class="main_category_box">
              ${createInlineCategoryManagerHtml(category, 'main')}
            </div>
          </label>
          <label for="">
            <span>서브 카테고리</span>
            <div class="sub_category_box">
              ${createInlineCategoryManagerHtml(category, 'sub')}
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
          </div>
          <div class="menu_option_groups">
            ${option_groups.map((group) => createMenuOptionGroupHtml(group)).join("")}
          </div>
          <button class="add_group_btn" onclick="clickAddOptionGroupBtn(event)">
            <i class="ph ph-plus"></i>
            <span>옵션 그룹 추가</span>
          </button>
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
  const isEmpty = category[type].length === 0;
  const defaultLabel = isEmpty ? '카테고리 없음' : ko_category;

  const html = `
    <select
      class="input_box"
      data-type="form"
      data-title="${type}_category"
      data-category="${type}"
      onchange="changeSetMenuCategory(event)"
      ${isEmpty ? 'disabled' : ''}
    >
      <option value="" ${selectedId == '' ? 'selected' : ''} disabled hidden>${defaultLabel}</option>
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
    setMenuOptionDrag();
    initCategoryManagerDrag();
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
  setMenuHtmlEmptyData.category.main = mainCategoryData;
  setMenuHtmlEmptyData.category.sub = [];
  const html = setMenuHtml(setMenuHtmlEmptyData);
  const _asideEl = document.querySelector('.set_menu_product main aside');

  clickResponsiveBtn(event) // 메뉴 편집 창 열기
  _asideEl.innerHTML = html;
  setMenuOptionDrag();
  initCategoryManagerDrag();
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
const createMenuOptionGroupHtml = ({ id, name, option_type, options, show_price }) => {
  const isShowPrice = show_price !== false;

  return `
    <div class="option_group" data-type="group" data-id="${id || ''}">
      <div class="group_header">
        <span class="group_label">옵션 그룹명</span>
        <div class="group_meta">
          <div class="option_type_btn" onclick="toggleOptionTypeDropdown(event)">
            <span>${getOptionTypeLabel(option_type)}</span>
            <i class="ph ph-caret-down"></i>
            <input type="hidden" data-title="option_type" value="${option_type}">
            <ul class="option_type_list">
              <li data-value="REQUIRED_SINGLE" onclick="selectOptionType(event)">필수 (하나만)</li>
              <li data-value="OPTIONAL_SINGLE" onclick="selectOptionType(event)">선택 (하나만)</li>
              <li data-value="MULTIPLE" onclick="selectOptionType(event)">다중 선택</li>
              <li data-value="QUANTITY" onclick="selectOptionType(event)">수량 조절 (선택)</li>
              <li data-value="REQUIRED_QUANTITY" onclick="selectOptionType(event)">수량 조절 (필수)</li>
            </ul>
          </div>
          <div class="is_show_price_toggle">
            <span>가격 표시</span>
            <button onclick="toggleGroupPrice(event)" data-active="${isShowPrice}">
              <div class="ball"></div>
            </button>
            <input type="checkbox" data-title="show_price" ${isShowPrice ? 'checked' : ''}>
          </div>
        </div>
      </div>
      <div class="group_name_row">
        <i class="ph ph-dots-six-vertical group_drag_btn"></i>
        <input type="text" data-title="group_name" placeholder="그룹명 (예: 맵기 선택)" value="${name}">
        <button class="delete_group_btn" onclick="this.closest('.option_group').remove()">
          <i class="ph ph-trash"></i>
        </button>
      </div>
      <div class="menu_options">
        ${createMenuOptionHtml(options, isShowPrice)}
      </div>
      <button class="add_option_btn" onclick="clickAddOptionBtn(event)">
        <i class="ph ph-plus"></i>
        <span>옵션 추가</span>
      </button>
    </div>
  `
}

// 메뉴 옵션 추가 버튼 클릭 시
const clickAddOptionBtn = (event) => {
  const _groupEl = event.target.closest('.option_group');
  const _menuOptionsEl = _groupEl.querySelector('.menu_options');
  const toggleBtn = _groupEl.querySelector('.is_show_price_toggle button');
  const showPrice = toggleBtn ? JSON.parse(toggleBtn.dataset.active) : true;
  const html = createMenuOptionHtml([{ name: '', price: '' }], showPrice);
  _menuOptionsEl.insertAdjacentHTML('beforeend', html);
  // SortableJS handles new children automatically for existing containers
}

// 옵션 input html 만들기
const createMenuOptionHtml = (optionsData, showPrice = true) => {
  return optionsData.map(({ name, price }) => `
    <div class="option_item">
      <i class="ph ph-dots-six-vertical drag_btn"></i>
      <input data-title="option_name" data-type="form" type="text" value="${name}" placeholder="옵션명">
      <input data-title="option_price" data-type="form" type="text" value="${price}" placeholder="가격" style="${showPrice ? '' : 'display:none'}">
      <button class="delete_btn" onclick="clickDeleteOptionBtn(event)">
        <i class="ph ph-trash"></i>
      </button>
    </div>
  `).join('')
}

const OPTION_TYPE_LABELS = {
  REQUIRED_SINGLE: '필수 (하나만)',
  OPTIONAL_SINGLE: '선택 (하나만)',
  MULTIPLE: '다중 선택',
  QUANTITY: '수량 조절 (선택)',
  REQUIRED_QUANTITY: '수량 조절 (필수)',
}

const getOptionTypeLabel = (value) => OPTION_TYPE_LABELS[value] || value;

const toggleOptionTypeDropdown = (event) => {
  const btn = event.currentTarget;
  const isOpen = btn.classList.contains('open');
  document.querySelectorAll('.option_type_btn.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) btn.classList.add('open');
}

const selectOptionType = (event) => {
  event.stopPropagation();
  const li = event.currentTarget;
  const btn = li.closest('.option_type_btn');
  const value = li.dataset.value;
  btn.querySelector('span').textContent = OPTION_TYPE_LABELS[value];
  btn.querySelector('input[type="hidden"]').value = value;
  btn.classList.remove('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.option_type_btn')) {
    document.querySelectorAll('.option_type_btn.open').forEach(el => el.classList.remove('open'));
  }
});

const toggleGroupPrice = (event) => {
  const btn = event.currentTarget;
  const isActive = JSON.parse(btn.dataset.active);
  const newState = !isActive;
  btn.dataset.active = newState;
  const checkbox = btn.nextElementSibling;
  checkbox.checked = newState;
  const groupEl = btn.closest('.option_group');
  groupEl.querySelectorAll('input[data-title="option_price"]').forEach(input => {
    input.style.display = newState ? '' : 'none';
  });
}

const toggleShowPrice = (event) => {
  const btn = event.currentTarget;
  const isActive = JSON.parse(btn.dataset.active);
  btn.dataset.active = !isActive;
  const checkbox = btn.nextElementSibling;
  checkbox.checked = !isActive;
}

// 메뉴 데이터 설정에서 메뉴 카테고리 변경 시 (상단 필터 select용)
const changeSetMenuCategory = (event) => {
  const target = event.currentTarget;
  const categoryType = target.dataset.category;
  if (categoryType == 'main') {
    const submit_data = { 'main_category_id': Number(target.value) };
    const onSuccess = (data) => {
      console.log(data);
      const _subCategoryEl = document.querySelector('.sub_category_box');
      if (_subCategoryEl) {
        _subCategoryEl.innerHTML = createInlineCategoryManagerHtml({ 'sub': data }, 'sub');
        initCategoryManagerDrag();
      }
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
// 조회 구분 드롭다운 토글
const clickDropDownBtn = (event) => {
  const _dropDownBtn = event.currentTarget;
  const _dropDownList = _dropDownBtn.nextElementSibling;
  _dropDownList.classList.toggle('active');
}

// 조회 구분 드롭다운 항목 선택
const clickCategory = (event) => {
  const _target = event.currentTarget;
  const _dropDownList = _target.closest('.dropdown-list');
  const _dropDownBox = _dropDownList.closest('.dropdown-box');
  const _dropDownBtn = _dropDownBox.querySelector('.btn-dropdown');
  _dropDownBtn.querySelector('span').textContent = _target.dataset.name;
  _dropDownBtn.dataset.id = _target.dataset.id;
  _dropDownBtn.dataset.name = _target.dataset.name;
  _dropDownList.classList.remove('active');
}


// ===== 인라인 카테고리 매니저 =====

// HTML 생성
const createInlineCategoryManagerHtml = (category, type) => {
  const categories = category[type] || [];
  const selected = categories.find(c => c.checked);
  const selectedId = selected ? selected.id : '';
  const selectedName = selected ? selected.name : '';
  const titleAttr = type === 'main' ? 'main_category' : 'sub_category';
  const placeholder = type === 'main' ? '메인 카테고리 선택' : '서브 카테고리 선택';

  const itemsHtml = categories.length === 0
    ? `<li class="cat_empty">카테고리가 없습니다</li>`
    : categories.map(cat => `
        <li class="cat_item${cat.checked ? ' selected' : ''}" data-id="${cat.id}" data-name="${cat.name}"
            onmousedown="if(!event.target.closest('.cat_drag_handle')) event.preventDefault();"
            onclick="clickSelectCategoryItem(event, '${type}')">
          <i class="ph ph-dots-six-vertical cat_drag_handle"></i>
          <span class="cat_name">${cat.name}</span>
          <button type="button" class="cat_delete_btn"
                  onmousedown="event.preventDefault(); event.stopPropagation();"
                  onclick="event.stopPropagation(); clickDeleteCategoryItem(event, '${type}')">
            <i class="ph ph-x"></i>
          </button>
        </li>
      `).join('');

  return `
    <div class="inline_cat_mgr" data-type="${type}">
      <input type="hidden" data-type="form" data-title="${titleAttr}" value="${selectedId}"
             data-edit-id="${selectedId}" data-edit-name="${selectedName}">
      <div class="cat_input_wrap">
        <input type="text" class="cat_input"
               value="${selectedName}" placeholder="${placeholder}"
               onfocus="openCatDropdown(event)"
               oninput="filterCatList(event)"
               onkeydown="onCatInputKeydown(event, '${type}')">
        <button type="button" class="cat_edit_btn" style="display:${selectedId ? 'flex' : 'none'}"
                onmousedown="event.preventDefault(); event.stopPropagation();"
                onclick="clickCatEditBtn(event)">
          <i class="ph ph-pencil-simple"></i>
        </button>
        <i class="ph ph-caret-down cat_caret" onmousedown="toggleCatDropdownByIcon(event)"></i>
      </div>
      <div class="cat_dropdown" style="display:none" onclick="event.stopPropagation()">
        <ul class="cat_list">${itemsHtml}</ul>
      </div>
    </div>
  `;
};

// 드래그 초기화
const initCategoryManagerDrag = () => {
  const lists = document.querySelectorAll('.set_menu_product .inline_cat_mgr .cat_list');
  lists.forEach(list => {
    if (list._sortable) { list._sortable.destroy(); list._sortable = null; }
    list._sortable = new Sortable(list, {
      handle: '.cat_drag_handle',
      animation: 150,
      onEnd: () => {
        const type = list.closest('.inline_cat_mgr').dataset.type;
        const mainCategoryId = getSelectedMainCategoryId();
        saveCategoryData(type, mainCategoryId);
      }
    });
  });
};

// 현재 선택된 메인 카테고리 ID
const getSelectedMainCategoryId = () => {
  const el = document.querySelector('.inline_cat_mgr[data-type="main"] input[data-title="main_category"]');
  return el && el.value ? Number(el.value) : null;
};

// 드롭다운 위치 계산 후 열기
const openCatDropdown = (event) => {
  const input = event.currentTarget;
  const manager = input.closest('.inline_cat_mgr');
  if (manager.dataset.editMode === 'true') return;
  if (manager.classList.contains('open')) return;

  document.querySelectorAll('.inline_cat_mgr.open').forEach(el => {
    if (el !== manager) closeCatDropdown(el);
  });

  const rect = input.getBoundingClientRect();
  const dropdown = manager.querySelector('.cat_dropdown');
  dropdown.style.display = 'flex';
  dropdown.style.flexDirection = 'column';
  dropdown.style.position = 'fixed';
  dropdown.style.top = (rect.bottom + 4) + 'px';
  dropdown.style.left = rect.left + 'px';
  dropdown.style.width = rect.width + 'px';
  manager.classList.add('open');
};

// 캐럿 아이콘 클릭 토글 (mousedown으로 blur 방지)
const toggleCatDropdownByIcon = (event) => {
  event.preventDefault();
  const manager = event.currentTarget.closest('.inline_cat_mgr');
  const input = manager.querySelector('.cat_input');
  if (manager.classList.contains('open')) {
    closeCatDropdown(manager);
    input.blur();
  } else {
    input.focus();
  }
};

// 단일 드롭다운 닫기
const closeCatDropdown = (manager) => {
  manager.classList.remove('open');
  const dropdown = manager.querySelector('.cat_dropdown');
  if (dropdown) dropdown.style.display = 'none';
  // 필터 초기화
  manager.querySelectorAll('.cat_item').forEach(el => el.style.display = '');
};

// 모든 카테고리 드롭다운 닫기
const closeAllCatDropdowns = () => {
  document.querySelectorAll('.inline_cat_mgr.open').forEach(el => closeCatDropdown(el));
};

// 드롭다운 외부 mousedown 시 닫기 (blur보다 먼저 처리)
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('.inline_cat_mgr')) closeAllCatDropdowns();
});

// 타이핑 시 목록 필터링
const filterCatList = (event) => {
  const input = event.currentTarget;
  const manager = input.closest('.inline_cat_mgr');
  const query = input.value.toLowerCase();

  manager.querySelectorAll('.cat_item').forEach(item => {
    item.style.display = item.dataset.name.toLowerCase().includes(query) ? '' : 'none';
  });

  // 편집 모드면 선택 해제하지 않음
  if (manager.dataset.editMode === 'true') return;

  const hiddenInput = manager.querySelector('input[data-type="form"]');
  if (input.value !== hiddenInput.dataset.editName) {
    hiddenInput.dataset.editId = '';
    const editBtn = manager.querySelector('.cat_edit_btn');
    if (editBtn) editBtn.style.display = 'none';
  }
};

// 인풋 키 이벤트 (Enter / Escape)
const onCatInputKeydown = (event, type) => {
  if (event.key === 'Escape') {
    delete manager.dataset.editMode;
    manager.querySelector('.cat_input_wrap').classList.remove('editing');
    // 이름 원복
    const hiddenInput2 = manager.querySelector('input[data-type="form"]');
    if (hiddenInput2.dataset.editName) input.value = hiddenInput2.dataset.editName;
    input.blur();
    closeAllCatDropdowns();
    return;
  }
  if (event.key !== 'Enter') return;
  event.preventDefault();

  const input = event.currentTarget;
  const manager = input.closest('.inline_cat_mgr');
  const hiddenInput = manager.querySelector('input[data-type="form"]');
  const name = input.value.trim();

  if (!name) { closeAllCatDropdowns(); return; }

  const mainCategoryId = getSelectedMainCategoryId();
  if (type === 'sub' && !mainCategoryId) {
    showToast('먼저 메인 카테고리를 선택해주세요.', 'warning');
    return;
  }

  const editId = Number(hiddenInput.dataset.editId) || 0;

  if (editId) {
    // 기존 항목 수정 (rename)
    if (name === hiddenInput.dataset.editName) {
      hiddenInput.value = editId;
      closeAllCatDropdowns();
      return;
    }
    const item = manager.querySelector(`.cat_item[data-id="${editId}"]`);
    if (item) {
      item.dataset.name = name;
      item.querySelector('.cat_name').textContent = name;
    }
    hiddenInput.value = editId;
    hiddenInput.dataset.editName = name;
    saveCategoryData(type, mainCategoryId);
    showToast('카테고리 이름이 변경되었습니다.', 'success');
  } else {
    // 새 카테고리 생성
    saveCategoryData(type, mainCategoryId, { action: 'add', name });
  }

  delete manager.dataset.editMode;
  manager.querySelector('.cat_input_wrap').classList.remove('editing');
  closeAllCatDropdowns();
};

// 카테고리 아이템 클릭 (선택)
const clickSelectCategoryItem = (event, type) => {
  const target = event.currentTarget;
  const manager = target.closest('.inline_cat_mgr');
  const categoryId = Number(target.dataset.id);
  const categoryName = target.dataset.name;

  manager.querySelectorAll('.cat_item').forEach(el => el.classList.remove('selected'));
  target.classList.add('selected');

  const hiddenInput = manager.querySelector('input[data-type="form"]');
  hiddenInput.value = categoryId;
  hiddenInput.dataset.editId = categoryId;
  hiddenInput.dataset.editName = categoryName;

  const catInput = manager.querySelector('.cat_input');
  if (catInput) catInput.value = categoryName;

  const editBtn = manager.querySelector('.cat_edit_btn');
  if (editBtn) editBtn.style.display = 'flex';

  closeCatDropdown(manager);

  if (type === 'main') {
    fetchData('/store/get_sub_category', 'GET', { main_category_id: categoryId }, (data) => {
      subCategoryData = data;
      const subBox = document.querySelector('.sub_category_box');
      if (subBox) {
        subBox.innerHTML = createInlineCategoryManagerHtml({ sub: data }, 'sub');
        initCategoryManagerDrag();
      }
    });
  }
};

// 카테고리 수정 버튼 클릭 — 편집 모드 (드롭다운 열지 않음)
const clickCatEditBtn = (event) => {
  const manager = event.currentTarget.closest('.inline_cat_mgr');
  const input = manager.querySelector('.cat_input');
  manager.dataset.editMode = 'true';
  manager.querySelector('.cat_input_wrap').classList.add('editing');
  input.focus();
  input.select();
  showToast('카테고리 이름을 수정하고 Enter를 눌러주세요.', 'info');
};

// 카테고리 삭제 버튼 클릭
const clickDeleteCategoryItem = async (event, type) => {
  const item = event.currentTarget.closest('.cat_item');
  const categoryId = Number(item.dataset.id);
  const list = item.closest('.cat_list');

  const paramKey = type === 'main' ? 'main_category_id' : 'sub_category_id';
  const check = await fetchDataAsync(`/adm/check_delete_category?${paramKey}=${categoryId}`, 'GET', {});
  if (!check.status) {
    showToast('주문 내역이 있는 카테고리는 삭제할 수 없습니다.', 'error');
    return;
  }

  item.remove();
  const mainCategoryId = getSelectedMainCategoryId();
  saveCategoryData(type, mainCategoryId);
};

// DOM 기준으로 카테고리 저장
const saveCategoryData = async (type, mainCategoryId, extra = null) => {
  const manager = document.querySelector(`.inline_cat_mgr[data-type="${type}"]`);
  if (!manager) return;

  const items = [...manager.querySelectorAll('.cat_item')];
  const categoryList = items.map((el, i) => ({
    id: Number(el.dataset.id),
    name: el.dataset.name,
    position: i + 1,
  }));
  if (extra?.action === 'add') {
    categoryList.push({ id: 0, name: extra.name, position: categoryList.length + 1 });
  }

  if (type === 'main') {
    const result = await fetchDataAsync('/adm/update_main_category', 'PATCH', { main_category_list: categoryList });
    if (result?.code === 200) reloadMainCategoryManager();
  } else {
    if (!mainCategoryId) return;
    const result = await fetchDataAsync('/adm/update_sub_category', 'PATCH', {
      sub_category_list: categoryList,
      main_category_id: mainCategoryId,
    });
    if (result?.code === 200) reloadSubCategoryManager(mainCategoryId);
  }
};

// 메인 카테고리 매니저 재로드
const reloadMainCategoryManager = () => {
  const curSelectedId = document.querySelector('.inline_cat_mgr[data-type="main"] input[data-title="main_category"]')?.value || '';
  fetchData('/store/get_main_category', 'GET', {}, (data) => {
    mainCategoryData = data;
    createSeleteBox({ main: data }, 'changeCategory', '.seletebox_main_category', 'main', '메인 카테고리');
    const asideMainBox = document.querySelector('.set_menu_product main aside .main_category_box');
    if (asideMainBox) {
      const dataWithChecked = data.map(c => ({ ...c, checked: String(c.id) === curSelectedId }));
      asideMainBox.innerHTML = createInlineCategoryManagerHtml({ main: dataWithChecked }, 'main');
      initCategoryManagerDrag();
    }
  });
};

// 서브 카테고리 매니저 재로드
const reloadSubCategoryManager = (mainCategoryId) => {
  const curSelectedId = document.querySelector('.inline_cat_mgr[data-type="sub"] input[data-title="sub_category"]')?.value || '';
  fetchData('/store/get_sub_category', 'GET', { main_category_id: mainCategoryId }, (data) => {
    subCategoryData = data;
    const asideSubBox = document.querySelector('.set_menu_product main aside .sub_category_box');
    if (asideSubBox) {
      const dataWithChecked = data.map(c => ({ ...c, checked: String(c.id) === curSelectedId }));
      asideSubBox.innerHTML = createInlineCategoryManagerHtml({ sub: dataWithChecked }, 'sub');
      initCategoryManagerDrag();
    }
  });
};
