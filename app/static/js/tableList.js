// Socket initialization, pos_login, and staff_call_notification are now handled in common.js

// common.js에서 주문 알림 시 호출되는 콜백
function onOrderUpdate(data) {
  loadTableData();
}

// =============================================
//  Canvas constants (view mode) — set_table과 동일한 그리드
// =============================================
const COLS  = 20;
const ROWS  = 12;
const GAP   = 16;
const MIN_W = 2;
const MIN_H = 2;

let CELL_W = 60;
let CELL_H = 60;

const updateCellSize = () => {
  const canvas = document.getElementById('table-canvas');
  if (!canvas) return;
  CELL_W = (canvas.clientWidth  + GAP) / COLS;
  CELL_H = (canvas.clientHeight + GAP) / ROWS;
};

let tableData;
let cachingData = null;
let curPage = 1;

// =============================================
//  Data load
// =============================================

const loadTableData = () => {
  fetch('/pos/get_table_page', { method: 'GET' })
    .then(r => r.json())
    .then(data => {
      tableData = setInitFetchData(data);
      createHtml(tableData);
    })
    .catch(err => console.error('Error:', err));
};

loadTableData();

// 주문 리스트 초기 병합
const setInitFetchData = (categories) => {
  const data = JSON.parse(JSON.stringify(categories));
  data.forEach((cat) => {
    cat.tableList.forEach((table) => {
      table.orderList = mergeOrders(table.orderList);
    });
  });
  return data;
};

function mergeOrders(orders) {
  const mergedOrders = [];
  const orderMap = {};
  orders.forEach((order) => {
    const { menuId } = order;
    if (!orderMap[menuId]) {
      orderMap[menuId] = { ...order };
      mergedOrders.push(orderMap[menuId]);
    } else {
      orderMap[menuId].count += order.count;
      orderMap[menuId].optionList.push(...order.optionList);
    }
  });
  return mergedOrders;
}

// =============================================
//  HTML 생성 — 카테고리 탭 + 첫 번째 캔버스
// =============================================

const createHtml = (data) => {
  const _navUl = document.querySelector('main section nav ul');
  const canvas = document.getElementById('table-canvas');

  if (!data || data.length === 0) {
    _navUl.innerHTML = '';
    canvas.innerHTML = `
      <div class="canvas-empty-state">
        <i class="ph ph-table"></i>
        <p>등록된 테이블이 없습니다.</p>
      </div>
    `;
    return;
  }

  let navHtml = '';
  data.forEach((cat, index) => {
    navHtml += `
      <li data-id="${cat.categoryId}" data-state="${index === 0 ? 'active' : ''}">
        <button onclick="changeTableCategory(event,${index})">${cat.category}</button>
      </li>`;
  });
  _navUl.innerHTML = navHtml;

  renderViewCanvas(data[0].tableList);
};

// =============================================
//  페이지 네비게이션
// =============================================

const getPageCount = (tables) => {
  return tables.reduce((max, t) => {
    if (t.gridX !== null && t.gridX !== undefined) return Math.max(max, t.page || 1);
    return max;
  }, 1);
};

const renderPageNav = (tables) => {
  const nav = document.getElementById('page-nav');
  if (!nav) return;

  const pageCount = getPageCount(tables);

  const prevBtn = curPage > 1
    ? `<button class="page-arrow-btn" onclick="changePageTo(${curPage - 1})"><i class="ph-bold ph-caret-left"></i></button>`
    : `<span class="page-arrow-placeholder"></span>`;

  const nextBtn = curPage < pageCount
    ? `<button class="page-arrow-btn" onclick="changePageTo(${curPage + 1})"><i class="ph-bold ph-caret-right"></i></button>`
    : `<span class="page-arrow-placeholder"></span>`;

  nav.innerHTML = prevBtn + nextBtn;
};

const changePageTo = (page) => {
  curPage = page;
  const idx = getCurCategoryIndex();
  const tables = cachingData
    ? cachingData[idx].tableList
    : tableData[idx].tableList;
  renderViewCanvas(tables);
};

// =============================================
//  Canvas 렌더링 (view mode)
// =============================================

const renderViewCanvas = (tables) => {
  updateCellSize();
  const canvas = document.getElementById('table-canvas');
  canvas.innerHTML = '';

  const placed = tables.filter(t =>
    t.gridX !== null && t.gridX !== undefined && (t.page || 1) === curPage
  );

  if (placed.length === 0) {
    canvas.innerHTML = `
      <div class="canvas-empty-state">
        <i class="ph ph-table"></i>
        <p>배치된 테이블이 없습니다.</p>
      </div>
    `;
    renderPageNav(tables);
    return;
  }

  placed.forEach((table) => {
    canvas.appendChild(createViewCard(table));
  });

  renderPageNav(tables);
};

const applyViewCardRect = (card) => {
  const gx = Number(card.dataset.gx), gy = Number(card.dataset.gy);
  const gw = Number(card.dataset.gw), gh = Number(card.dataset.gh);
  card.style.left   = `${gx * CELL_W}px`;
  card.style.top    = `${gy * CELL_H}px`;
  card.style.width  = `${gw * CELL_W - GAP}px`;
  card.style.height = `${gh * CELL_H - GAP}px`;
};

const createViewCard = (table) => {
  const gw = table.gridW || MIN_W;
  const gh = table.gridH || MIN_H;
  const gx = table.gridX;
  const gy = table.gridY;

  const card = document.createElement('div');
  card.className = `table-card view-card${table.isGroup ? ' has-group' : ''}${table.select ? ' select' : ''}`;
  card.dataset.id = table.tableId;
  card.dataset.gx = gx;
  card.dataset.gy = gy;
  card.dataset.gw = gw;
  card.dataset.gh = gh;
  card.dataset.status = table.statusId;

  const stateLabel = table.statusId === 1 ? '조리 중'
    : table.statusId === 2 ? '조리대기' : '';

  if (table.groupId && table.groupId !== 0) {
    card.style.border = `2px solid ${table.groupColor}`;
  }

  const bodyContent = table.orderList.length > 0
    ? `<ul>${table.orderList.slice(0, 3).map((o, i) => `
        <li data-id="${o.menuId}">
          <span>${o.menu}</span>
          <span>${o.count}</span>
        </li>
        ${i === 2 && table.orderList.length > 3 ? `<li class="order_more">외 ${table.orderList.length - 3}</li>` : ''}
      `).join('')}</ul>`
    : `<div class="view-empty-icon"><i class="ph ph-plus"></i></div>`;

  card.innerHTML = `
    ${table.isGroup ? `<div class="item_grop_num" data-id="${table.groupId}" style="background:${table.groupColor}">${table.groupId}</div>` : ''}
    <div class="transparent_group_box" onclick="clickTransparentGroupTable(event)">
      <i class="ph-fill ph-check-fat"></i>
    </div>
    <div class="transparent_move_box" onclick="clickTransparentMoveTable(event)">
      <i class="ph ph-arrows-out-cardinal"></i>
    </div>
    <div class="card-title">
      <h2>${table.table} <i class="ph-fill ph-bell-ringing"></i></h2>
      <div class="table_state">${stateLabel}</div>
    </div>
    <div class="card-body">
      ${bodyContent}
    </div>
  `;

  applyViewCardRect(card);
  card.addEventListener('click', () => clickTable(table.tableId));

  return card;
};

// =============================================
//  카테고리 전환
// =============================================

const changeTableCategory = (event, index) => {
  document.querySelector('main section nav ul li[data-state="active"]').dataset.state = '';
  event.target.closest('li').dataset.state = 'active';
  curPage = 1;

  const tables = cachingData
    ? cachingData[index].tableList
    : tableData[index].tableList;

  renderViewCanvas(tables);
};

// =============================================
//  테이블 클릭 → 메뉴리스트 이동
// =============================================

function clickTable(table_id) {
  window.location.href = `/pos/menuList/${table_id}`;
}

// =============================================
//  현재 카테고리의 tableList 가져오기 (헬퍼)
// =============================================

const getCurCategoryIndex = () => {
  const activeLi = document.querySelector('main section nav ul li[data-state="active"]');
  if (!activeLi) return 0;
  const curId = Number(activeLi.dataset.id);
  return tableData.findIndex(cat => cat.categoryId === curId);
};

const getCurTableList = (data) => {
  const idx = getCurCategoryIndex();
  return data[idx] ? data[idx].tableList : [];
};

// =============================================
//  설정 버튼
// =============================================

const clickSetBtn = (event) => {
  openModalFun(event);
  const _modalTitle = document.querySelector('.modal-content h1');
  const _modalBody = document.querySelector('.modal-content .modal-body');
  _modalTitle.innerHTML = '설정';
  _modalBody.innerHTML = `
    <div class="top">
      <div class="grid">
        <button onclick="clickMoveAndjoinBtn(event)">
          <i class="ph ph-swap"></i>
          <span>이동/합석</span>
        </button>
        <button onclick="clickGroupBtn(event)">
          <i class="ph ph-users-three"></i>
          <span>그룹</span>
        </button>
        <button onclick="window.location.href='/store/product'">
          <i class="ph ph-storefront"></i>
          <span>매장 관리</span>
        </button>
      </div>
    </div>
    <div class="bottom"></div>
  `;
};

// =============================================
//  그룹 지정
// =============================================

const clickGroupBtn = (event) => {
  const asideHtml = `
    <div class="left selete_box_group">
      <button data-value="1" data-text="그룹 1" class="btn-dropdown" onclick="clickDropDownBtn(event)">
        <div>1</div>
        <span>그룹 1</span>
        <i class="ph ph-caret-up"></i>
      </button>
      <ul class="dropdown-list">
        ${groupColors.map(({ num, color }) => `
          <li data-value="${num}" data-text="그룹 ${num}" data-color="${color}" onclick="clickCurGroupNum(event)">
            <div style="background:${color}">${num}</div>
            <span>그룹 ${num}</span>
            <button onclick="clickGroupDeleteBtn(event)"><i class="ph ph-trash"></i></button>
          </li>
        `).join('')}
      </ul>
    </div>
    <div class="right custom_btns">
      <button onclick="clickSetGroupCancelBtn(event)">취소</button>
      <button onclick="clickSetGroupSaveBtn(event)" class="active">저장</button>
    </div>
  `;
  document.querySelector('.modal')?.click();
  const _aside = document.querySelector('main section aside');
  _aside.innerHTML = asideHtml;
  _aside.classList.add('active');
  const _article = document.querySelector('main section article');
  _article.classList.add('group', 'disabled');
  _article.classList.remove('move');
  cachingData = JSON.parse(JSON.stringify(tableData));
};

// 그룹 셀렉트 드롭박스
const clickDropDownBtn = (event) => {
  event.currentTarget.nextElementSibling.classList.toggle('active');
};

let groupNum = 1;
const clickAddGroupList = (event) => {
  groupNum += 1;
  const html = `
    <li data-value="${groupNum}" data-text="그룹 ${groupNum}" onclick="clickCurGroupNum(event)">
      <div>${groupNum}</div>
      <span>그룹 ${groupNum}</span>
      <button onclick="clickGroupDeleteBtn(event)"><i class="ph ph-trash"></i></button>
    </li>
  `;
  event.currentTarget.insertAdjacentHTML('beforebegin', html);
};

const clickGroupDeleteBtn = (event) => {
  event.stopPropagation();
  const value = event.currentTarget.closest('li').dataset.value;

  cachingData.forEach((cat) => {
    cat.tableList.forEach((table) => {
      if (Number(table.groupId) === Number(value)) {
        table.groupColor = undefined;
        table.groupId = undefined;
      }
    });
  });

  document.querySelectorAll('.item_grop_num').forEach((el) => {
    if (Number(el.dataset.id) === Number(value)) {
      el.closest('.table-card').style.border = '';
      el.remove();
    }
  });
};

const clickCurGroupNum = (event) => {
  const _li = event.currentTarget;
  const groupNum = _li.dataset.value;
  const groupColor = _li.dataset.color;
  const btn = document.querySelector('.selete_box_group .btn-dropdown');
  btn.querySelector('div').innerHTML = groupNum;
  btn.querySelector('div').style.background = groupColor;
  btn.querySelector('span').innerHTML = '그룹 ' + groupNum;
  btn.dataset.value = groupNum;
  btn.dataset.text = '그룹 ' + groupNum;
  _li.closest('.dropdown-list').classList.remove('active');
};

const clickTransparentGroupTable = (event) => {
  event.stopPropagation();
  const card = event.currentTarget.closest('.table-card');
  const curGroup = document.querySelector('.selete_box_group .btn-dropdown');
  const value = curGroup.dataset.value;
  const bgColor = window.getComputedStyle(curGroup.querySelector('div')).backgroundColor;

  const curCatIdx = getCurCategoryIndex();
  const itemId = card.dataset.id;
  const targetData = cachingData[curCatIdx].tableList
    .find(t => String(t.tableId) === String(itemId));

  if (targetData.isGroup === 1 && String(targetData.groupId) === String(value)) {
    targetData.groupColor = undefined;
    targetData.groupId = undefined;
    targetData.isGroup = 0;
  } else {
    targetData.groupColor = bgColor;
    targetData.groupId = Number(value);
    targetData.isGroup = 1;
  }

  renderViewCanvas(cachingData[curCatIdx].tableList);
};

const clickSetGroupCancelBtn = () => {
  changeStyleOnSet();
  renderViewCanvas(getCurTableList(tableData));
  cachingData = null;
};

const clickSetGroupSaveBtn = () => {
  changeStyleOnSet();
  const groupData = [];
  tableData = JSON.parse(JSON.stringify(cachingData));
  tableData.forEach((cat) => {
    cat.tableList.forEach((table) => {
      groupData.push({
        table_id: table.tableId,
        group_id: table.groupId ?? null,
        group_color: table.groupColor ?? null,
      });
    });
  });
  fetch('/pos/set_group', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(groupData),
  }).catch(err => console.error(err));
  cachingData = null;
};

// =============================================
//  이동/합석
// =============================================

const cachingSetTableData = [];
const tableMoveList = [];

const clickMoveAndjoinBtn = (event) => {
  const asideHtml = `
    <div class="left"></div>
    <div class="right custom_btns">
      <button onclick="clickCombineMoveCancelBtn(event)">취소</button>
      <button onclick="clickCombineMoveSaveBtn(event)" class="active">저장</button>
    </div>
  `;
  document.querySelector('.modal')?.click();
  const _aside = document.querySelector('main section aside');
  _aside.classList.add('active');
  _aside.innerHTML = asideHtml;
  const _article = document.querySelector('main section article');
  _article.classList.add('move', 'disabled');
  _article.classList.remove('group');
  cachingData = JSON.parse(JSON.stringify(tableData));
};

const clickTransparentMoveTable = (event) => {
  event.stopPropagation();
  const card = event.currentTarget.closest('.table-card');
  const curCatIdx = getCurCategoryIndex();
  const itemId = card.dataset.id;
  const targetData = cachingData[curCatIdx].tableList
    .find(t => String(t.tableId) === String(itemId));

  const targetStatusId = targetData.statusId;
  const curLen = cachingSetTableData.length;

  if (targetStatusId !== 0 && curLen === 0) {
    cachingSetTableData.push(targetData);
    targetData.select = true;
    renderViewCanvas(cachingData[curCatIdx].tableList);
  } else if (targetStatusId !== 0 && curLen !== 0) {
    if (String(targetData.tableId) === String(cachingSetTableData[0].tableId)) return;
    const modal = openDefaultModal();
    modal.container.classList.add('success');
    modal.middle.innerHTML = `
      <i class="ph ph-warning-circle"></i>
      <div>
        <span>${cachingSetTableData[0].table}에서 ${targetData.table}(으)로 합석처리 합니다.</span>
        <p>합석 후에는 되돌릴 수 없습니다.</p>
      </div>
    `;
    modal.bottom.innerHTML = modalBottomHtml([
      { class: 'close brand', text: '취소', fun: '' },
      { class: 'close brand_fill', text: '합석', fun: '' },
    ]);
    modal.bottom.querySelector('.brand_fill').addEventListener('click', () => {
      tableMoveList.push({
        start_table_id: cachingSetTableData[0].tableId,
        end_table_id: targetData.tableId,
      });
      delete cachingSetTableData[0].select;
      targetData.orderList = mergeOrderLists(cachingSetTableData[0], targetData).orderList;
      cachingSetTableData[0] = createEmptyTable(cachingSetTableData[0]);
      renderViewCanvas(cachingData[curCatIdx].tableList);
      cachingSetTableData.length = 0;
    });
  } else if (targetStatusId === 0 && curLen !== 0) {
    tableMoveList.push({
      start_table_id: cachingSetTableData[0].tableId,
      end_table_id: targetData.tableId,
    });
    delete cachingSetTableData[0].select;
    for (const key in targetData) {
      if (key !== 'table' && key !== 'tableId' && key !== 'gridX' && key !== 'gridY' && key !== 'gridW' && key !== 'gridH') {
        targetData[key] = JSON.parse(JSON.stringify(cachingSetTableData[0][key]));
      }
    }
    cachingSetTableData[0] = createEmptyTable(cachingSetTableData[0]);
    renderViewCanvas(cachingData[curCatIdx].tableList);
    cachingSetTableData.length = 0;
  }
};

function mergeOrderLists(existingData, newData) {
  const existingOrders = existingData.orderList;
  const newOrders = newData.orderList;
  newOrders.forEach((newOrder) => {
    const existing = existingOrders.find(o => o.menuId === newOrder.menuId);
    if (existing) {
      existing.count += newOrder.count;
      newOrder.optionList.forEach((opt) => {
        const eo = existing.optionList.find(o => o.optionId === opt.optionId);
        if (eo) eo.count += opt.count;
        else existing.optionList.push(opt);
      });
    } else {
      existingOrders.push(newOrder);
    }
  });
  return existingData;
}

const clickCombineMoveCancelBtn = () => {
  changeStyleOnSet();
  tableMoveList.length = 0;
  renderViewCanvas(getCurTableList(tableData));
  cachingData = null;
};

const clickCombineMoveSaveBtn = async () => {
  changeStyleOnSet();
  const fetchBody = setMoveTableList(tableMoveList).map(d => ({
    start_table_id: [d.start_table_id[d.start_table_id.length - 1]],
    end_table_id: d.end_table_id,
  }));
  const result = await fetchDataAsync('/pos/set_table', 'PUT', fetchBody);
  cachingData = null;
  tableMoveList.length = 0;
};

const setMoveTableList = (inputList) => {
  let resultList = [];
  for (let i = 0; i < inputList.length; i++) {
    const current = inputList[i];
    let curStartList = [current.start_table_id];
    for (let j = 0; j < resultList.length; j++) {
      const prev = resultList[j];
      if (current.start_table_id === prev.end_table_id || prev.end_table_id === current.end_table_id) {
        curStartList = [...curStartList, ...prev.start_table_id];
        delete resultList[j].end_table_id;
      }
    }
    const obj = { start_table_id: curStartList, end_table_id: current.end_table_id };
    if (obj.start_table_id.includes(obj.end_table_id)) {
      obj.start_table_id = obj.start_table_id.filter(v => v !== obj.end_table_id);
    }
    resultList.push(obj);
  }
  return resultList.filter(item => item.hasOwnProperty('end_table_id'));
};

const createEmptyTable = (tableData) => {
  tableData.groupColor = '';
  tableData.groupId = '';
  tableData.orderList = [];
  tableData.statusId = 0;
  return tableData;
};

const changeStyleOnSet = () => {
  const _article = document.querySelector('main section article');
  const _aside = document.querySelector('main section > aside');
  _article.classList.remove('group', 'move', 'disabled');
  _aside.classList.remove('active');
};

// =============================================
//  ResizeObserver — 캔버스 크기 변경 시 카드 위치/크기 재계산
// =============================================
let _roTimer;
const _ro = new ResizeObserver(() => {
  clearTimeout(_roTimer);
  _roTimer = setTimeout(() => {
    updateCellSize();
    document.querySelectorAll('#table-canvas .table-card').forEach(applyViewCardRect);
  }, 60);
});

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('table-canvas');
  if (canvas) _ro.observe(canvas);
});
