(function() {

// =============================================
//  셸 HTML (table_list.html의 <main> 내부)
// =============================================
var TABLE_LIST_SHELL = `
  <section>
    <nav>
      <ul></ul>
      <button class="btn_set" onclick="clickSetBtn(event)">
        <i class="ph ph-gear-six"></i>
      </button>
    </nav>
    <article>
      <div class="table-canvas-wrap">
        <div class="canvas-scroll-wrap">
          <div id="table-canvas"></div>
        </div>
      </div>
    </article>
    <aside></aside>
  </section>
  <aside style="display:none">
    <h1>POS - aside</h1>
  </aside>
`;

// =============================================
//  Canvas constants (view mode) — set_table과 동일한 그리드
// =============================================
var COLS  = 20;
var ROWS  = 12;
var GAP   = 16;
var MIN_W = 2;
var MIN_H = 2;

var CELL_W = 60;
var CELL_H = 60;

var updateCellSize = function() {
  var canvas = document.getElementById('table-canvas');
  if (!canvas) return;
  CELL_W = (canvas.clientWidth  + GAP) / COLS;
  CELL_H = (canvas.clientHeight + GAP) / ROWS;
};

var tableData;
var cachingData = null;

// =============================================
//  Data load
// =============================================

var loadTableData = function() {
  fetch('/pos/get_table_page', { method: 'GET' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      tableData = setInitFetchData(data);
      createHtml(tableData);
    })
    .catch(function(err) { console.error('Error:', err); });
};

// 주문 리스트 초기 병합
var setInitFetchData = function(categories) {
  var data = JSON.parse(JSON.stringify(categories));
  data.forEach(function(cat) {
    cat.tableList.forEach(function(table) {
      table.orderList = mergeOrders(table.orderList);
    });
  });
  return data;
};

function mergeOrders(orders) {
  var mergedOrders = [];
  var orderMap = {};
  orders.forEach(function(order) {
    var menuId = order.menuId;
    if (!orderMap[menuId]) {
      orderMap[menuId] = Object.assign({}, order);
      mergedOrders.push(orderMap[menuId]);
    } else {
      orderMap[menuId].count += order.count;
      orderMap[menuId].optionList.push.apply(orderMap[menuId].optionList, order.optionList);
    }
  });
  return mergedOrders;
}

// =============================================
//  HTML 생성 — 카테고리 탭 + 첫 번째 캔버스
// =============================================

var createHtml = function(data) {
  var _navUl = document.querySelector('main section nav ul');
  var canvas = document.getElementById('table-canvas');

  if (!data || data.length === 0) {
    _navUl.innerHTML = '';
    canvas.innerHTML = '<div class="canvas-empty-state"><i class="ph ph-table"></i><p>등록된 테이블이 없습니다.</p></div>';
    return;
  }

  var navHtml = '';
  data.forEach(function(cat, index) {
    navHtml += '<li data-id="' + cat.categoryId + '" data-state="' + (index === 0 ? 'active' : '') + '"><button onclick="changeTableCategory(event,' + index + ')">' + cat.category + '</button></li>';
  });
  _navUl.innerHTML = navHtml;

  renderViewCanvas(data[0].tableList);
};

// =============================================
//  Canvas 렌더링 (view mode)
// =============================================

var renderViewCanvas = function(tables) {
  updateCellSize();
  var canvas = document.getElementById('table-canvas');
  canvas.innerHTML = '';

  var placed = tables.filter(function(t) {
    return t.gridX !== null && t.gridX !== undefined;
  });

  if (placed.length === 0) {
    canvas.innerHTML = '<div class="canvas-empty-state"><i class="ph ph-table"></i><p>배치된 테이블이 없습니다.</p></div>';
    return;
  }

  placed.forEach(function(table) {
    canvas.appendChild(createViewCard(table));
  });
};

var applyViewCardRect = function(card) {
  var gx = Number(card.dataset.gx), gy = Number(card.dataset.gy);
  var gw = Number(card.dataset.gw), gh = Number(card.dataset.gh);
  card.style.left   = (gx * CELL_W) + 'px';
  card.style.top    = (gy * CELL_H) + 'px';
  card.style.width  = (gw * CELL_W - GAP) + 'px';
  card.style.height = (gh * CELL_H - GAP) + 'px';
};

var createViewCard = function(table) {
  var gw = table.gridW || MIN_W;
  var gh = table.gridH || MIN_H;
  var gx = table.gridX;
  var gy = table.gridY;

  var card = document.createElement('div');
  card.className = 'table-card view-card' + (table.isGroup ? ' has-group' : '') + (table.select ? ' select' : '');
  card.dataset.id = table.tableId;
  card.dataset.gx = gx;
  card.dataset.gy = gy;
  card.dataset.gw = gw;
  card.dataset.gh = gh;
  card.dataset.status = table.statusId;

  var stateLabel = table.statusId === 1 ? '조리 중'
    : table.statusId === 2 ? '조리완료' : '';

  if (table.groupId && table.groupId !== 0) {
    card.style.border = '2px solid ' + table.groupColor;
  }

  var bodyContent = table.orderList.length > 0
    ? '<ul>' + table.orderList.slice(0, 3).map(function(o, i) {
        return '<li data-id="' + o.menuId + '"><span>' + o.menu + '</span><span>' + o.count + '</span></li>' +
          (i === 2 && table.orderList.length > 3 ? '<li class="order_more">외 ' + (table.orderList.length - 3) + '</li>' : '');
      }).join('') + '</ul>'
    : '<div class="view-empty-icon"><i class="ph ph-plus"></i></div>';

  card.innerHTML =
    (table.isGroup ? '<div class="item_grop_num" data-id="' + table.groupId + '" style="background:' + table.groupColor + '">' + table.groupId + '</div>' : '') +
    '<div class="transparent_group_box" onclick="clickTransparentGroupTable(event)"><i class="ph-fill ph-check-fat"></i></div>' +
    '<div class="transparent_move_box" onclick="clickTransparentMoveTable(event)"><i class="ph ph-arrows-out-cardinal"></i></div>' +
    '<div class="card-title"><h2>' + table.table + ' <i class="ph-fill ph-bell-ringing"></i></h2><div class="table_state">' + stateLabel + '</div></div>' +
    '<div class="card-body">' + bodyContent + '</div>';

  applyViewCardRect(card);
  card.addEventListener('click', function() { clickTable(table.tableId); });

  return card;
};

// =============================================
//  카테고리 전환
// =============================================

window.changeTableCategory = function(event, index) {
  document.querySelector('main section nav ul li[data-state="active"]').dataset.state = '';
  event.target.closest('li').dataset.state = 'active';

  var tables = cachingData
    ? cachingData[index].tableList
    : tableData[index].tableList;

  renderViewCanvas(tables);
};

// =============================================
//  테이블 클릭 → 메뉴리스트 이동 (SPA)
// =============================================

function clickTable(table_id) {
  navigateTo('/pos/menuList/' + table_id);
}

// =============================================
//  현재 카테고리의 tableList 가져오기 (헬퍼)
// =============================================

var getCurCategoryIndex = function() {
  var activeLi = document.querySelector('main section nav ul li[data-state="active"]');
  if (!activeLi) return 0;
  var curId = Number(activeLi.dataset.id);
  return tableData.findIndex(function(cat) { return cat.categoryId === curId; });
};

var getCurTableList = function(data) {
  var idx = getCurCategoryIndex();
  return data[idx] ? data[idx].tableList : [];
};

// =============================================
//  설정 버튼
// =============================================

window.clickSetBtn = function(event) {
  openModalFun(event);
  var _modalTitle = document.querySelector('.modal-content h1');
  var _modalBody = document.querySelector('.modal-content .modal-body');
  _modalTitle.innerHTML = '설정';
  _modalBody.innerHTML = '<div class="top"><div class="grid">' +
    '<button onclick="clickMoveAndjoinBtn(event)"><i class="ph ph-swap"></i><span>이동/합석</span></button>' +
    '<button onclick="clickGroupBtn(event)"><i class="ph ph-users-three"></i><span>그룹</span></button>' +
    '<button onclick="window.location.href=\'/store/product\'"><i class="ph ph-storefront"></i><span>매장 관리</span></button>' +
    '</div></div><div class="bottom"></div>';
};

// =============================================
//  그룹 지정
// =============================================

window.clickGroupBtn = function(event) {
  var asideHtml = '<div class="left selete_box_group">' +
    '<button data-value="1" data-text="그룹 1" class="btn-dropdown" onclick="clickGroupDropDownBtn(event)">' +
    '<div>1</div><span>그룹 1</span><i class="ph ph-caret-up"></i></button>' +
    '<ul class="dropdown-list">' +
    groupColors.map(function(g) {
      return '<li data-value="' + g.num + '" data-text="그룹 ' + g.num + '" data-color="' + g.color + '" onclick="clickCurGroupNum(event)">' +
        '<div style="background:' + g.color + '">' + g.num + '</div><span>그룹 ' + g.num + '</span>' +
        '<button onclick="clickGroupDeleteBtn(event)"><i class="ph ph-trash"></i></button></li>';
    }).join('') +
    '</ul></div>' +
    '<div class="right custom_btns">' +
    '<button onclick="clickSetGroupCancelBtn(event)">취소</button>' +
    '<button onclick="clickSetGroupSaveBtn(event)" class="active">저장</button></div>';
  document.querySelector('.modal')?.click();
  var _aside = document.querySelector('main section aside');
  _aside.innerHTML = asideHtml;
  _aside.classList.add('active');
  var _article = document.querySelector('main section article');
  _article.classList.add('group', 'disabled');
  _article.classList.remove('move');
  cachingData = JSON.parse(JSON.stringify(tableData));
};

// 그룹 셀렉트 드롭박스
window.clickGroupDropDownBtn = function(event) {
  event.currentTarget.nextElementSibling.classList.toggle('active');
};

var groupNum = 1;
window.clickAddGroupList = function(event) {
  groupNum += 1;
  var html = '<li data-value="' + groupNum + '" data-text="그룹 ' + groupNum + '" onclick="clickCurGroupNum(event)">' +
    '<div>' + groupNum + '</div><span>그룹 ' + groupNum + '</span>' +
    '<button onclick="clickGroupDeleteBtn(event)"><i class="ph ph-trash"></i></button></li>';
  event.currentTarget.insertAdjacentHTML('beforebegin', html);
};

window.clickGroupDeleteBtn = function(event) {
  event.stopPropagation();
  var value = event.currentTarget.closest('li').dataset.value;

  cachingData.forEach(function(cat) {
    cat.tableList.forEach(function(table) {
      if (Number(table.groupId) === Number(value)) {
        table.groupColor = undefined;
        table.groupId = undefined;
      }
    });
  });

  document.querySelectorAll('.item_grop_num').forEach(function(el) {
    if (Number(el.dataset.id) === Number(value)) {
      el.closest('.table-card').style.border = '';
      el.remove();
    }
  });
};

window.clickCurGroupNum = function(event) {
  var _li = event.currentTarget;
  var gNum = _li.dataset.value;
  var gColor = _li.dataset.color;
  var btn = document.querySelector('.selete_box_group .btn-dropdown');
  btn.querySelector('div').innerHTML = gNum;
  btn.querySelector('div').style.background = gColor;
  btn.querySelector('span').innerHTML = '그룹 ' + gNum;
  btn.dataset.value = gNum;
  btn.dataset.text = '그룹 ' + gNum;
  _li.closest('.dropdown-list').classList.remove('active');
};

window.clickTransparentGroupTable = function(event) {
  event.stopPropagation();
  var card = event.currentTarget.closest('.table-card');
  var curGroup = document.querySelector('.selete_box_group .btn-dropdown');
  var value = curGroup.dataset.value;
  var bgColor = window.getComputedStyle(curGroup.querySelector('div')).backgroundColor;

  var curCatIdx = getCurCategoryIndex();
  var itemId = card.dataset.id;
  var targetData = cachingData[curCatIdx].tableList
    .find(function(t) { return String(t.tableId) === String(itemId); });

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

window.clickSetGroupCancelBtn = function() {
  changeStyleOnSet();
  renderViewCanvas(getCurTableList(tableData));
  cachingData = null;
};

window.clickSetGroupSaveBtn = function() {
  changeStyleOnSet();
  var groupData = [];
  tableData = JSON.parse(JSON.stringify(cachingData));
  tableData.forEach(function(cat) {
    cat.tableList.forEach(function(table) {
      groupData.push({
        table_id: table.tableId,
        group_id: table.groupId != null ? table.groupId : null,
        group_color: table.groupColor != null ? table.groupColor : null,
      });
    });
  });
  fetch('/pos/set_group', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(groupData),
  }).catch(function(err) { console.error(err); });
  cachingData = null;
};

// =============================================
//  이동/합석
// =============================================

var cachingSetTableData = [];
var tableMoveList = [];

window.clickMoveAndjoinBtn = function(event) {
  var asideHtml = '<div class="left"></div>' +
    '<div class="right custom_btns">' +
    '<button onclick="clickCombineMoveCancelBtn(event)">취소</button>' +
    '<button onclick="clickCombineMoveSaveBtn(event)" class="active">저장</button></div>';
  document.querySelector('.modal')?.click();
  var _aside = document.querySelector('main section aside');
  _aside.classList.add('active');
  _aside.innerHTML = asideHtml;
  var _article = document.querySelector('main section article');
  _article.classList.add('move', 'disabled');
  _article.classList.remove('group');
  cachingData = JSON.parse(JSON.stringify(tableData));
};

window.clickTransparentMoveTable = function(event) {
  event.stopPropagation();
  var card = event.currentTarget.closest('.table-card');
  var curCatIdx = getCurCategoryIndex();
  var itemId = card.dataset.id;
  var targetData = cachingData[curCatIdx].tableList
    .find(function(t) { return String(t.tableId) === String(itemId); });

  var targetStatusId = targetData.statusId;
  var curLen = cachingSetTableData.length;

  if (targetStatusId !== 0 && curLen === 0) {
    cachingSetTableData.push(targetData);
    targetData.select = true;
    renderViewCanvas(cachingData[curCatIdx].tableList);
  } else if (targetStatusId !== 0 && curLen !== 0) {
    if (String(targetData.tableId) === String(cachingSetTableData[0].tableId)) return;
    var modal = openDefaultModal();
    modal.container.classList.add('success');
    modal.middle.innerHTML =
      '<i class="ph ph-warning-circle"></i><div><span>' + cachingSetTableData[0].table + '에서 ' + targetData.table + '(으)로 합석처리 합니다.</span>' +
      '<p>합석 후에는 되돌릴 수 없습니다.</p></div>';
    modal.bottom.innerHTML = modalBottomHtml([
      { class: 'close brand', text: '취소', fun: '' },
      { class: 'close brand_fill', text: '합석', fun: '' },
    ]);
    modal.bottom.querySelector('.brand_fill').addEventListener('click', function() {
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
    for (var key in targetData) {
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
  var existingOrders = existingData.orderList;
  var newOrders = newData.orderList;
  newOrders.forEach(function(newOrder) {
    var existing = existingOrders.find(function(o) { return o.menuId === newOrder.menuId; });
    if (existing) {
      existing.count += newOrder.count;
      newOrder.optionList.forEach(function(opt) {
        var eo = existing.optionList.find(function(o) { return o.optionId === opt.optionId; });
        if (eo) eo.count += opt.count;
        else existing.optionList.push(opt);
      });
    } else {
      existingOrders.push(newOrder);
    }
  });
  return existingData;
}

window.clickCombineMoveCancelBtn = function() {
  changeStyleOnSet();
  tableMoveList.length = 0;
  renderViewCanvas(getCurTableList(tableData));
  cachingData = null;
};

window.clickCombineMoveSaveBtn = async function() {
  changeStyleOnSet();
  var fetchBody = setMoveTableList(tableMoveList).map(function(d) {
    return {
      start_table_id: [d.start_table_id[d.start_table_id.length - 1]],
      end_table_id: d.end_table_id,
    };
  });
  var result = await fetchDataAsync('/pos/set_table', 'PUT', fetchBody);
  cachingData = null;
  tableMoveList.length = 0;
};

var setMoveTableList = function(inputList) {
  var resultList = [];
  for (var i = 0; i < inputList.length; i++) {
    var current = inputList[i];
    var curStartList = [current.start_table_id];
    for (var j = 0; j < resultList.length; j++) {
      var prev = resultList[j];
      if (current.start_table_id === prev.end_table_id || prev.end_table_id === current.end_table_id) {
        curStartList = curStartList.concat(prev.start_table_id);
        delete resultList[j].end_table_id;
      }
    }
    var obj = { start_table_id: curStartList, end_table_id: current.end_table_id };
    if (obj.start_table_id.includes(obj.end_table_id)) {
      obj.start_table_id = obj.start_table_id.filter(function(v) { return v !== obj.end_table_id; });
    }
    resultList.push(obj);
  }
  return resultList.filter(function(item) { return item.hasOwnProperty('end_table_id'); });
};

var createEmptyTable = function(td) {
  td.groupColor = '';
  td.groupId = '';
  td.orderList = [];
  td.statusId = 0;
  return td;
};

var changeStyleOnSet = function() {
  var _article = document.querySelector('main section article');
  var _aside = document.querySelector('main section > aside');
  _article.classList.remove('group', 'move', 'disabled');
  _aside.classList.remove('active');
};

// =============================================
//  ResizeObserver
// =============================================
var _ro = null;
var _roTimer;

function _setupResizeObserver() {
  if (_ro) _ro.disconnect();
  _ro = new ResizeObserver(function() {
    clearTimeout(_roTimer);
    _roTimer = setTimeout(function() {
      updateCellSize();
      document.querySelectorAll('#table-canvas .table-card').forEach(applyViewCardRect);
    }, 60);
  });
  var canvas = document.getElementById('table-canvas');
  if (canvas) _ro.observe(canvas);
}

// =============================================
//  init / cleanup (SPA 라우터에서 호출)
// =============================================

window.initTableListView = function() {
  document.getElementById('pos-content').innerHTML = TABLE_LIST_SHELL;
  loadTableData();

  // KDS 소켓 이벤트 등록
  if (typeof socket !== 'undefined') {
    socket.on('kds_order_completed', function() { loadTableData(); });
    socket.on('kds_orders_cancelled', function() { loadTableData(); });
  }

  _setupResizeObserver();

  // onOrderUpdate 콜백 (tableList 뷰용)
  window.onOrderUpdate = function(data) {
    loadTableData();
  };
};

window.cleanupTableListView = function() {
  if (typeof socket !== 'undefined') {
    socket.off('kds_order_completed');
    socket.off('kds_orders_cancelled');
  }
  if (_ro) {
    _ro.disconnect();
    _ro = null;
  }
  cachingData = null;
};

})();
