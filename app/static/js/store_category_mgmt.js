let menuData = [];
let currentMainCategoryId = null;

// 초기화
const initCategoryMgmt = async () => {
  await fetchMenuData();
  renderMainCategories();
  updateTime();
  setInterval(updateTime, 1000 * 60);

  // Sortable 초기화
  initSortable('main_category_list');
  initSortable('sub_category_list');
};

// Sortable 초기화 함수
const initSortable = (elementId) => {
  const el = document.getElementById(elementId);
  if (el) {
    new Sortable(el, {
      handle: '.drag_handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: (evt) => {
        // 드래그 종료 시점에 별도 로직이 필요하다면 여기에 추가 (예: 즉시 저장 등)
        // 현재는 '저장' 버튼 클릭 시 전체 순서를 수집하므로 별도 동작 불필요
      }
    });
  }
}


// 시간 업데이트
const updateTime = () => {
  const now = new Date();
  const timeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}(${['일', '월', '화', '수', '목', '금', '토'][now.getDay()]}) ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const timeEl = document.querySelector('.cur_time');
  if (timeEl) timeEl.textContent = timeString;
}

// 메뉴 데이터 가져오기
const fetchMenuData = async () => {
  const url = `/pos/get_menu_list?t=${new Date().getTime()}`;
  const method = `GET`;
  const fetchData = {};
  try {
    const result = await fetchDataAsync(url, method, fetchData);
    console.log('Menu Data:', result);
    menuData = result;
  } catch (error) {
    console.error('Failed to fetch menu list:', error);
    showToast('데이터를 불러오는데 실패했습니다.', 'error');
  }
};

// 대분류 리스트 렌더링
const renderMainCategories = () => {
  const list = document.getElementById('main_category_list');
  list.innerHTML = '';

  menuData.forEach((cat, index) => {
    const li = createCategoryItemHtml(cat.category, cat.categoryId, 'MAIN', index);
    list.appendChild(li);

    // 이전에 선택된 카테고리가 있다면 다시 활성화
    if (currentMainCategoryId !== null && cat.categoryId === currentMainCategoryId) {
      li.classList.add('active');
    }
  });
};

// 소분류 리스트 렌더링
const renderSubCategories = (mainIndex) => {
  const list = document.getElementById('sub_category_list');
  const emptyState = document.getElementById('sub_empty_state');
  const saveBtn = document.getElementById('sub_save_btn');

  if (mainIndex === null || !menuData[mainIndex]) {
    list.style.display = 'none';
    emptyState.style.display = 'flex';
    saveBtn.disabled = true;
    return;
  }

  list.style.display = 'flex';
  emptyState.style.display = 'none';
  saveBtn.disabled = false;
  list.innerHTML = '';

  const subCategories = menuData[mainIndex].subCategoryList || [];
  subCategories.forEach((sub, index) => {
    const li = createCategoryItemHtml(sub.subCategory, sub.subCategoryId, 'SUB');
    list.appendChild(li);
  });
};

// 카테고리 아이템 HTML 생성 (View Mode / Edit Mode)
const createCategoryItemHtml = (name, id, type, index = null, isEditMode = false) => {
  const li = document.createElement('li');
  li.className = 'category_item';
  li.dataset.id = id || '';
  li.dataset.name = name || ''; // 원본 이름 저장

  if (type === 'MAIN' && index !== null) {
    li.dataset.index = index;
    li.onclick = (e) => clickMainCategoryItem(e, index, id);
  }

  if (isEditMode) {
    renderEditMode(li, name, type);
  } else {
    renderViewMode(li, name, type);
  }

  return li;
};

// View Mode 렌더링
const renderViewMode = (li, name, type) => {
  li.innerHTML = `
        <div class="drag_handle">
            <i class="ph-bold ph-dots-six-vertical"></i>
        </div>
        <div class="view_content">
            <span class="text_span">${name}</span>
            <div class="btn_group">
                <button class="icon_btn edit" onclick="clickEditBtn(event)">
                    <i class="ph-bold ph-pencil-simple"></i>
                </button>
                <button class="icon_btn delete" onclick="clickDeleteItem(event, '${type}')">
                    <i class="ph-bold ph-trash"></i>
                </button>
            </div>
        </div>
    `;
  li.classList.remove('edit_mode');
};

// Edit Mode 렌더링
const renderEditMode = (li, name, type) => {
  li.innerHTML = `
         <div class="drag_handle">
            <i class="ph-bold ph-dots-six-vertical"></i>
        </div>
        <div class="edit_content">
            <input type="text" class="edit_input" value="${name}" placeholder="카테고리명 입력" onclick="event.stopPropagation()">
            <div class="btn_group">
                <button class="icon_btn confirm" onclick="clickConfirmEdit(event, '${type}')">
                    <i class="ph-bold ph-check"></i>
                </button>
                 <button class="icon_btn cancel" onclick="clickCancelEdit(event, '${type}')">
                    <i class="ph-bold ph-x"></i>
                </button>
            </div>
        </div>
    `;
  li.classList.add('edit_mode');

  // 인풋에 포커스
  setTimeout(() => {
    const input = li.querySelector('input');
    if (input) {
      input.focus();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') clickConfirmEdit(e, type);
        if (e.key === 'Escape') clickCancelEdit(e, type);
      });
    }
  }, 0);
};


// 대분류 클릭 핸들러
const clickMainCategoryItem = (event, index, id) => {
  // 편집 모드이거나 버튼 클릭인 경우 무시 (이미 event.stopPropagation 처리됨)
  // 하지만 li click 이벤트가 버블링으로 들어올 수 있으므로 체크

  if (event.target.closest('button') || event.target.closest('input')) return;

  // Active 스타일 적용
  document.querySelectorAll('#main_category_list .category_item').forEach(item => item.classList.remove('active'));
  event.currentTarget.classList.add('active');

  currentMainCategoryId = id;
  renderSubCategories(index);
};

// 카테고리 추가 버튼 클릭 -> 즉시 Edit Mode로 추가
const clickAddCategory = (type) => {
  const listId = type === 'MAIN' ? 'main_category_list' : 'sub_category_list';
  const list = document.getElementById(listId);

  if (type === 'SUB' && document.getElementById('sub_category_list').style.display === 'none') {
    showToast('대분류를 먼저 선택해주세요.', 'warning');
    return;
  }

  const li = createCategoryItemHtml('', null, type, null, true); // isEditMode = true
  list.appendChild(li);

  li.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// 수정 버튼 클릭 -> View Mode에서 Edit Mode로 전환
const clickEditBtn = (event) => {
  event.stopPropagation();
  const li = event.target.closest('.category_item');
  const name = li.dataset.name;
  // type 유추 (DOM 구조상 알기 어려우면 dataset에 type도 저장하면 좋음. 현재는 부모 리스트 ID로 판별 가능)
  const type = li.closest('#main_category_list') ? 'MAIN' : 'SUB';

  renderEditMode(li, name, type);
};

// 수정 확인(체크) 버튼 클릭 -> 임시 저장(UI 갱신) 후 View Mode로 전환
const clickConfirmEdit = (event, type) => {
  event.stopPropagation();
  const li = event.target.closest('.category_item');
  const input = li.querySelector('input');
  const newName = input.value.trim();

  if (!newName) {
    showToast('카테고리 이름을 입력해주세요.', 'warning');
    input.focus();
    return;
  }

  li.dataset.name = newName; // 데이터 갱신
  renderViewMode(li, newName, type);
};

// 수정 취소(X) 버튼 클릭 -> 원래 이름으로 복구하거나, 신규 생성 중이었다면 삭제
const clickCancelEdit = (event, type) => {
  event.stopPropagation();

  const li = event.target.closest('.category_item');
  const originalName = li.dataset.name;
  const id = li.dataset.id;

  if (!id && !originalName) {
    // 신규 추가 중 취소하면 삭제
    li.remove();
  } else {
    // 기존 항목 수정 취소하면 원래대로 복구
    renderViewMode(li, originalName, type);
  }
};

// 아이템 삭제 버튼 클릭
const clickDeleteItem = async (event, type) => {
  event.stopPropagation();

  const li = event.target.closest('.category_item');
  const id = li.dataset.id ? Number(li.dataset.id) : null;
  const list = li.parentElement;

  if (list.querySelectorAll('.category_item').length <= 1) {
    return showToast(`최소 한 개의 카테고리는 남아있어야 합니다.`, 'error');
  }

  if (id) {
    // 실제 삭제 전 확인
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const url = `/adm/check_delete_category`;
    const method = 'GET';
    const fetchData = type === "MAIN" ? { main_category_id: id } : { sub_category_id: id };

    try {
      const result = await fetchDataAsync(url, method, fetchData);
      if (result.status) {
        li.remove();
        if (type === 'MAIN' && currentMainCategoryId === id) {
          renderSubCategories(null);
          currentMainCategoryId = null;
        }
      } else {
        showToast('주문 내역이 존재하는 메뉴가 포함된 카테고리는 삭제할 수 없습니다.', 'error');
      }
    } catch (e) {
      showToast('삭제 가능 여부 확인 중 오류가 발생했습니다.', 'error');
    }
  } else {
    li.remove();
  }
};

// 전체 저장 버튼 클릭
const clickSaveCategory = async (type) => {
  const listId = type === 'MAIN' ? 'main_category_list' : 'sub_category_list';
  const listItems = document.querySelectorAll(`#${listId} .category_item`);

  // 편집 중인 항목이 있는지 확인
  if (document.querySelectorAll(`#${listId} .category_item.edit_mode`).length > 0) {
    return showToast('편집 중인 항목을 먼저 완료(체크)해주세요.', 'warning');
  }

  if (listItems.length === 0) {
    return showToast('저장할 카테고리가 없습니다.', 'warning');
  }

  const listData = [];

  listItems.forEach((li, index) => {
    const name = li.dataset.name; // 저장된 데이터 사용
    listData.push({
      id: li.dataset.id ? Number(li.dataset.id) : null,
      name: name,
      position: index + 1
    });
  });

  const url = `/adm/update_${type === 'MAIN' ? 'main' : 'sub'}_category`;
  const method = 'PATCH';
  const payloadKey = `${type === 'MAIN' ? 'main' : 'sub'}_category_list`;
  const fetchData = {
    [payloadKey]: listData
  };

  try {
    const result = await fetchDataAsync(url, method, fetchData);
    if (result.code === 200) {
      showToast('저장되었습니다.', 'success');
      await fetchMenuData();

      if (type === 'MAIN') {
        renderMainCategories();
        if (currentMainCategoryId) {
          const newIndex = menuData.findIndex(c => c.categoryId === currentMainCategoryId);
          if (newIndex !== -1) {
            document.querySelectorAll('#main_category_list .category_item')[newIndex].classList.add('active'); // active 복구
            renderSubCategories(newIndex);
          } else {
            currentMainCategoryId = null;
            renderSubCategories(null);
          }
        } else {
          renderSubCategories(null);
        }
      } else {
        if (currentMainCategoryId) {
          const index = menuData.findIndex(c => c.categoryId === currentMainCategoryId);
          renderSubCategories(index);
        }
      }

    } else {
      showToast(result.msg || '저장에 실패했습니다.', 'error');
    }
  } catch (error) {
    console.error(error);
    showToast('저장 중 오류가 발생했습니다.', 'error');
  }
};

// 초기 실행
initCategoryMgmt();
