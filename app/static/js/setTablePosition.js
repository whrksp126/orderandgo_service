// =============================================
//  Set Table Position — Edit Mode
// =============================================

const COLS   = 20;
const ROWS   = 12;
const GAP    = 16;
const MIN_W  = 2;
const MIN_H  = 2;
const AUTO_GW = Math.floor(20 / 5);  // 4  (한 줄 5개)
const AUTO_GH = Math.floor(12 / 4);  // 3  (4줄)

let CELL_W = 60;
let CELL_H = 60;

let tableData;
let curCategoryIndex = 0;
let curPage  = 1;
let isDirty  = false;
let selectedCard = null;

// ----- 유틸 -----
const haptic    = () => { if (navigator.vibrate) navigator.vibrate(30); };
const clampVal  = (v, min, max) => Math.max(min, Math.min(max, v));
const pxToGrid  = (px, cellSize) => Math.round(px / cellSize);

const gridToLeft   = (gx) => gx * CELL_W;
const gridToTop    = (gy) => gy * CELL_H;
const gridToWidth  = (gw) => gw * CELL_W - GAP;
const gridToHeight = (gh) => gh * CELL_H - GAP;
const leftToGrid   = (px) => pxToGrid(px, CELL_W);
const topToGrid    = (py) => pxToGrid(py, CELL_H);

// ----- 셀 크기 동적 계산 -----
const updateCellSize = () => {
  const canvas = document.getElementById('table-canvas');
  if (!canvas) return;
  // GAP을 더해서 나누면 card_width = gw*CELL_W - GAP 공식으로
  // 모든 카드가 동일한 크기를 가지면서 우측/하단까지 꽉 채워짐
  CELL_W = (canvas.clientWidth  + GAP) / COLS;
  CELL_H = (canvas.clientHeight + GAP) / ROWS;
  canvas.style.backgroundSize = `${CELL_W}px ${CELL_H}px`;
};

// ----- 페이지 수 계산 -----
const getPageCount = () => {
  const tables = (tableData?.[curCategoryIndex] || {}).tables || [];
  const maxPage = tables.reduce((m, t) =>
    (t.grid_x !== null && t.grid_x !== undefined) ? Math.max(m, t.page || 1) : m, 1);
  return Math.max(maxPage, curPage);
};

// ----- 페이지 내비 렌더 (좌우 원형 화살표) -----
const renderPageNav = () => {
  const nav = document.getElementById('page-nav');
  if (!nav) return;

  const prevBtn = curPage > 1
    ? `<button class="page-arrow-btn prev" onclick="changePageTo(${curPage - 1})"><i class="ph-bold ph-caret-left"></i></button>`
    : `<span class="page-arrow-placeholder"></span>`;

  const nextBtn = `<button class="page-arrow-btn next" onclick="changePageTo(${curPage + 1})"><i class="ph-bold ph-caret-right"></i></button>`;

  nav.innerHTML = prevBtn + nextBtn;
};

const changePageTo = (page) => {
  const count = getPageCount();
  if (page < 1 || page > count + 1) return;
  clearSelectedCard();
  curPage = page;
  renderCanvas();
};

// ----- 겹침 감지 -----
const checkOverlap = (excludeId, gx, gy, gw, gh) => {
  for (const card of document.querySelectorAll('#table-canvas .table-card')) {
    if (String(card.dataset.id) === String(excludeId)) continue;
    const cx = Number(card.dataset.gx), cy = Number(card.dataset.gy);
    const cw = Number(card.dataset.gw), ch = Number(card.dataset.gh);
    if (gx < cx + cw && gx + gw > cx && gy < cy + ch && gy + gh > cy) return true;
  }
  return false;
};

const checkOverlapExcluding = (excludeIds, gx, gy, gw, gh) => {
  for (const card of document.querySelectorAll('#table-canvas .table-card')) {
    if (excludeIds.includes(String(card.dataset.id))) continue;
    const cx = Number(card.dataset.gx), cy = Number(card.dataset.gy);
    const cw = Number(card.dataset.gw), ch = Number(card.dataset.gh);
    if (gx < cx + cw && gx + gw > cx && gy < cy + ch && gy + gh > cy) return true;
  }
  return false;
};

// ----- 페이지별 빈 슬롯 탐색 (tableData 기반) -----
const findFirstEmptySlotOnPage = (gw, gh, pageNum) => {
  const tables = (tableData?.[curCategoryIndex] || {}).tables || [];
  const placed = tables.filter(t =>
    t.page === pageNum && t.grid_x !== null && t.grid_x !== undefined);

  for (let gy = 0; gy <= ROWS - gh; gy++) {
    for (let gx = 0; gx <= COLS - gw; gx++) {
      const overlaps = placed.some(t =>
        gx < t.grid_x + t.grid_w && gx + gw > t.grid_x &&
        gy < t.grid_y + t.grid_h && gy + gh > t.grid_y);
      if (!overlaps) return { gx, gy, page: pageNum };
    }
  }
  return null;
};

// 현재 페이지부터 순차적으로, 가득 차면 다음 페이지
const findEmptySlotAnyPage = (gw, gh) => {
  const maxPage = getPageCount();
  for (let p = curPage; p <= maxPage + 1; p++) {
    const slot = findFirstEmptySlotOnPage(gw, gh, p);
    if (slot) return slot;
  }
  return null;
};

// ----- tableData 동기화 -----
const syncTableData = (id, patch) => {
  const table = tableData?.[curCategoryIndex]?.tables?.find(t => t.id === id);
  if (table) Object.assign(table, patch);
};

// ----- 선택 해제 -----
const clearSelectedCard = () => {
  if (selectedCard) { selectedCard.classList.remove('selected'); selectedCard = null; }
};

// ----- 카드 클릭 (swap 모드, 두 번째 클릭 flash 효과) -----
const handleCardClick = (card) => {
  if (selectedCard === null) {
    selectedCard = card;
    card.classList.add('selected');
  } else if (selectedCard === card) {
    clearSelectedCard();
  } else {
    const cardA = selectedCard;
    const cardB = card;
    cardB.classList.add('selected');
    selectedCard = null;
    cardA.classList.remove('selected');
    setTimeout(() => {
      swapCards(cardA, cardB);
    }, 150);
  }
};

// ----- 두 카드 위치 교환 -----
const swapCards = (cardA, cardB) => {
  const excludeIds = [String(cardA.dataset.id), String(cardB.dataset.id)];
  const axOld = Number(cardA.dataset.gx), ayOld = Number(cardA.dataset.gy);
  const bxOld = Number(cardB.dataset.gx), byOld = Number(cardB.dataset.gy);
  const awOld = Number(cardA.dataset.gw), ahOld = Number(cardA.dataset.gh);
  const bwOld = Number(cardB.dataset.gw), bhOld = Number(cardB.dataset.gh);

  if (checkOverlapExcluding(excludeIds, bxOld, byOld, awOld, ahOld) ||
      checkOverlapExcluding(excludeIds, axOld, ayOld, bwOld, bhOld)) {
    showToast('교환 시 다른 테이블과 겹칩니다.', 'warning');
    [cardA, cardB].forEach(c => {
      c.classList.remove('selected');
      c.classList.add('overlap');
      setTimeout(() => c.classList.remove('overlap'), 400);
    });
    return;
  }

  cardA.dataset.gx = bxOld; cardA.dataset.gy = byOld;
  cardB.dataset.gx = axOld; cardB.dataset.gy = ayOld;
  applyCardRect(cardA);
  applyCardRect(cardB);
  cardB.classList.remove('selected');

  syncTableData(Number(cardA.dataset.id), { grid_x: bxOld, grid_y: byOld });
  syncTableData(Number(cardB.dataset.id), { grid_x: axOld, grid_y: ayOld });

  isDirty = true;
  updateSaveBtn();
  haptic();
};

// ----- 카드를 미배치로 이동 -----
const moveToUnplaced = (card) => {
  const tableId = Number(card.dataset.id);
  const name = card.querySelector('h2').textContent;
  syncTableData(tableId, { grid_x: null, grid_y: null, grid_w: null, grid_h: null });
  card.remove();

  const li = createUnplacedItem({ id: tableId, name });
  document.querySelector('.unplaced-list').appendChild(li);

  isDirty = true;
  updateSaveBtn();
};

// ----- 미배치 아이템 DOM 생성 (이름 + 편집/삭제 버튼) -----
const createUnplacedItem = (table) => {
  const li = document.createElement('li');
  li.className = 'unplaced-item';
  li.dataset.id = String(table.id);
  li.innerHTML = `
    <span class="unplaced-name">${table.name}</span>
    <div class="unplaced-actions">
      <button class="delete-btn" title="삭제"><i class="ph ph-trash"></i></button>
    </div>
  `;
  li.querySelector('.unplaced-name').addEventListener('pointerdown', e => e.stopPropagation());
  li.querySelector('.unplaced-name').addEventListener('click', e => {
    e.stopPropagation();
    startInlineUnplacedEdit(li, table.id);
  });
  li.querySelector('.delete-btn').addEventListener('pointerdown', e => e.stopPropagation());
  li.querySelector('.delete-btn').addEventListener('click', e => {
    e.stopPropagation();
    callDeleteTable(e, table.id);
  });
  attachUnplacedDrag(li, table);
  return li;
};

// ----- 미배치 테이블 자동 배치 (AUTO_GW × AUTO_GH, 다음 페이지까지) -----
const autoPlaceTable = (item, tableInfo) => {
  const slot = findEmptySlotAnyPage(AUTO_GW, AUTO_GH);
  if (!slot) return showToast('배치할 수 있는 공간이 없습니다.', 'warning');

  syncTableData(tableInfo.id, { grid_x: slot.gx, grid_y: slot.gy, grid_w: AUTO_GW, grid_h: AUTO_GH, page: slot.page });
  item.remove();

  if (slot.page === curPage) {
    const canvas = document.getElementById('table-canvas');
    const card = createEditCard({ ...tableInfo, grid_x: slot.gx, grid_y: slot.gy, grid_w: AUTO_GW, grid_h: AUTO_GH, page: slot.page });
    card.classList.add('placing');
    canvas.appendChild(card);
    setTimeout(() => card.classList.remove('placing'), 400);
  } else {
    // 다른 페이지에 배치됨 → 해당 페이지로 이동
    curPage = slot.page;
    renderCanvas();
    return;
  }

  renderPageNav();
  isDirty = true;
  updateSaveBtn();
};

// ----- 초기 자동 격자 배치 (5×4, page 1) -----
const autoLayoutAllTables = () => {
  const category = tableData?.[curCategoryIndex];
  if (!category) return;
  const COL_COUNT = 5, ROW_COUNT = 4;
  const gw = AUTO_GW, gh = AUTO_GH;
  let idx = 0;

  category.tables.forEach((table) => {
    if (idx >= COL_COUNT * ROW_COUNT) return;
    const col = idx % COL_COUNT, row = Math.floor(idx / COL_COUNT);
    table.grid_x = col * gw;
    table.grid_y = row * gh;
    table.grid_w = gw;
    table.grid_h = gh;
    table.page   = 1;
    idx++;
  });
};

// ----- 카드 위치/크기 DOM 적용 -----
const applyCardRect = (card) => {
  const gx = Number(card.dataset.gx), gy = Number(card.dataset.gy);
  const gw = Number(card.dataset.gw), gh = Number(card.dataset.gh);
  card.style.left   = `${gridToLeft(gx)}px`;
  card.style.top    = `${gridToTop(gy)}px`;
  card.style.width  = `${gridToWidth(gw)}px`;
  card.style.height = `${gridToHeight(gh)}px`;
};

// ----- 카드 DOM 생성 -----
const createEditCard = (table) => {
  const gw = table.grid_w || MIN_W;
  const gh = table.grid_h || MIN_H;
  const gx = table.grid_x ?? 0;
  const gy = table.grid_y ?? 0;

  const card = document.createElement('div');
  card.className = 'table-card edit-card';
  card.dataset.id   = table.id;
  card.dataset.gx   = gx;
  card.dataset.gy   = gy;
  card.dataset.gw   = gw;
  card.dataset.gh   = gh;
  card.dataset.page = table.page || curPage;
  card.innerHTML = `
    <h2>${table.name}</h2>
    <div class="card-actions">
      <button class="delete-btn" title="미배치로 이동"><i class="ph ph-minus-circle"></i></button>
    </div>
    <div class="card-swap-overlay"><i class="ph ph-arrows-left-right"></i></div>
    <div class="resize-handle"></div>
  `;
  applyCardRect(card);

  card.querySelector('h2').addEventListener('pointerdown', e => e.stopPropagation());
  card.querySelector('h2').addEventListener('click', e => {
    e.stopPropagation();
    startInlineCardEdit(card, Number(card.dataset.id));
  });
  card.querySelector('.delete-btn').addEventListener('pointerdown', e => e.stopPropagation());
  card.querySelector('.delete-btn').addEventListener('click', e => {
    e.stopPropagation();
    moveToUnplaced(card);
  });

  attachDrag(card);
  attachResize(card.querySelector('.resize-handle'), card);
  return card;
};

// ----- 드래그 (클릭 vs 드래그 구분) -----
const attachDrag = (card) => {
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.resize-handle') || e.target.closest('.card-actions')) return;
    const activeInput = document.querySelector('.unplaced-name-input, .card-name-input');
    if (activeInput) { activeInput.blur(); return; }
    e.preventDefault();
    card.setPointerCapture(e.pointerId);

    const canvasRect = document.getElementById('table-canvas').getBoundingClientRect();
    const cardRect   = card.getBoundingClientRect();
    const startPx    = e.clientX;
    const startPy    = e.clientY;
    const startLeft  = cardRect.left - canvasRect.left;
    const startTop   = cardRect.top  - canvasRect.top;
    let prevSnapX    = Number(card.dataset.gx);
    let prevSnapY    = Number(card.dataset.gy);
    let dragStarted  = false;

    const onMove = (e) => {
      const dx = e.clientX - startPx, dy = e.clientY - startPy;
      if (!dragStarted && Math.hypot(dx, dy) > 5) {
        dragStarted = true;
        clearSelectedCard();
        card.classList.add('dragging');
        isDirty = true;
        updateSaveBtn();
      }
      if (!dragStarted) return;

      const gw = Number(card.dataset.gw), gh = Number(card.dataset.gh);
      const newLeft = clampVal(startLeft + dx, 0, (COLS - gw) * CELL_W);
      const newTop  = clampVal(startTop  + dy, 0, (ROWS - gh) * CELL_H);
      card.style.left = `${newLeft}px`;
      card.style.top  = `${newTop}px`;

      const sx = leftToGrid(newLeft), sy = topToGrid(newTop);
      if (sx !== prevSnapX || sy !== prevSnapY) { haptic(); prevSnapX = sx; prevSnapY = sy; }

      const panel = document.querySelector('.unplaced-panel');
      const pr = panel.getBoundingClientRect();
      panel.classList.toggle('drop-highlight',
        e.clientX >= pr.left && e.clientX <= pr.right && e.clientY >= pr.top && e.clientY <= pr.bottom);
    };

    const onUp = (e) => {
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerup', onUp);
      document.querySelector('.unplaced-panel').classList.remove('drop-highlight');

      if (!dragStarted) { handleCardClick(card); return; }
      card.classList.remove('dragging');

      const panel = document.querySelector('.unplaced-panel');
      const pr = panel.getBoundingClientRect();
      if (e.clientX >= pr.left && e.clientX <= pr.right && e.clientY >= pr.top && e.clientY <= pr.bottom) {
        moveToUnplaced(card); return;
      }

      const gw = Number(card.dataset.gw), gh = Number(card.dataset.gh);
      let gx = clampVal(leftToGrid(parseFloat(card.style.left)), 0, COLS - gw);
      let gy = clampVal(topToGrid (parseFloat(card.style.top)),  0, ROWS - gh);

      if (checkOverlap(card.dataset.id, gx, gy, gw, gh)) {
        gx = Number(card.dataset.gx);
        gy = Number(card.dataset.gy);
        card.classList.add('overlap');
        setTimeout(() => card.classList.remove('overlap'), 400);
      }
      card.dataset.gx = gx;
      card.dataset.gy = gy;
      applyCardRect(card);
      syncTableData(Number(card.dataset.id), { grid_x: gx, grid_y: gy });
    };

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', onUp);
  });
};

// ----- 리사이즈 -----
const attachResize = (handle, card) => {
  let startPx, startPy, startGW, startGH, prevSnapW, prevSnapH;

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);

    startPx = e.clientX; startPy = e.clientY;
    startGW = Number(card.dataset.gw); startGH = Number(card.dataset.gh);
    prevSnapW = startGW; prevSnapH = startGH;
    isDirty = true;
    updateSaveBtn();

    const onMove = (e) => {
      const gx = Number(card.dataset.gx), gy = Number(card.dataset.gy);
      const newGW = clampVal(startGW + Math.round((e.clientX - startPx) / CELL_W), MIN_W, COLS - gx);
      const newGH = clampVal(startGH + Math.round((e.clientY - startPy) / CELL_H), MIN_H, ROWS - gy);
      card.style.width  = `${gridToWidth(newGW)}px`;
      card.style.height = `${gridToHeight(newGH)}px`;
      if (newGW !== prevSnapW || newGH !== prevSnapH) { haptic(); prevSnapW = newGW; prevSnapH = newGH; }
    };

    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);

      const gx = Number(card.dataset.gx), gy = Number(card.dataset.gy);
      const gw = clampVal(Math.round((parseFloat(card.style.width)  + GAP) / CELL_W), MIN_W, COLS - gx);
      const gh = clampVal(Math.round((parseFloat(card.style.height) + GAP) / CELL_H), MIN_H, ROWS - gy);

      if (checkOverlap(card.dataset.id, gx, gy, gw, gh)) {
        card.classList.add('overlap');
        setTimeout(() => card.classList.remove('overlap'), 400);
        card.style.width  = `${gridToWidth(Number(card.dataset.gw))}px`;
        card.style.height = `${gridToHeight(Number(card.dataset.gh))}px`;
        return;
      }
      card.dataset.gw = gw;
      card.dataset.gh = gh;
      applyCardRect(card);
      syncTableData(Number(card.dataset.id), { grid_w: gw, grid_h: gh });
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });
};

// ----- 미배치 패널 드래그 (클릭 → 자동 배치) -----
const attachUnplacedDrag = (item, tableInfo) => {
  item.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.unplaced-actions')) return;
    const activeInput = document.querySelector('.unplaced-name-input, .card-name-input');
    if (activeInput) { activeInput.blur(); return; }
    e.preventDefault();
    item.setPointerCapture(e.pointerId);

    const startPx = e.clientX, startPy = e.clientY;
    let dragStarted = false;
    let ghost = null;
    const canvas = document.getElementById('table-canvas');

    const onMove = (e) => {
      const dx = e.clientX - startPx, dy = e.clientY - startPy;
      if (!dragStarted && Math.hypot(dx, dy) > 5) {
        dragStarted = true;
        ghost = document.createElement('div');
        ghost.className = 'table-card ghost';
        ghost.style.cssText = `left:-9999px;top:-9999px;width:${gridToWidth(AUTO_GW)}px;height:${gridToHeight(AUTO_GH)}px;pointer-events:none;`;
        ghost.innerHTML = `<h2>${tableInfo.name}</h2>`;
        canvas.appendChild(ghost);
      }
      if (!dragStarted) return;

      const r  = canvas.getBoundingClientRect();
      const gx = clampVal(leftToGrid(e.clientX - r.left - gridToWidth(AUTO_GW) / 2),  0, COLS - AUTO_GW);
      const gy = clampVal(topToGrid (e.clientY - r.top  - gridToHeight(AUTO_GH) / 2), 0, ROWS - AUTO_GH);
      ghost.dataset.gx = gx;
      ghost.dataset.gy = gy;
      ghost.style.left = `${gridToLeft(gx)}px`;
      ghost.style.top  = `${gridToTop(gy)}px`;
    };

    const onUp = (e) => {
      item.removeEventListener('pointermove', onMove);
      item.removeEventListener('pointerup', onUp);

      const dropGx = ghost ? Number(ghost.dataset.gx) : 0;
      const dropGy = ghost ? Number(ghost.dataset.gy) : 0;
      if (ghost) { canvas.removeChild(ghost); ghost = null; }

      if (!dragStarted) {
        autoPlaceTable(item, tableInfo);
        return;
      }

      const r = canvas.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;

      if (checkOverlap(tableInfo.id, dropGx, dropGy, AUTO_GW, AUTO_GH)) {
        return showToast('해당 위치에 다른 테이블이 있습니다.', 'warning');
      }

      syncTableData(tableInfo.id, { grid_x: dropGx, grid_y: dropGy, grid_w: AUTO_GW, grid_h: AUTO_GH, page: curPage });
      canvas.appendChild(createEditCard({ ...tableInfo, grid_x: dropGx, grid_y: dropGy, grid_w: AUTO_GW, grid_h: AUTO_GH, page: curPage }));
      item.remove();
      renderPageNav();
      isDirty = true;
      updateSaveBtn();
    };

    item.addEventListener('pointermove', onMove);
    item.addEventListener('pointerup', onUp);
  });
};

// ----- 캔버스 렌더 -----
const renderCanvas = () => {
  clearSelectedCard();
  const canvas = document.getElementById('table-canvas');
  const unplacedList = document.querySelector('.unplaced-list');
  canvas.innerHTML = '';
  unplacedList.innerHTML = '';
  if (!tableData || tableData.length === 0) return;

  const category = tableData[curCategoryIndex];
  if (!category) return;

  const allTables = category.tables || [];

  // 전체 미배치면 자동 격자 배치
  const allUnplaced = allTables.length > 0 &&
    allTables.every(t => t.grid_x === null || t.grid_x === undefined);
  if (allUnplaced) {
    autoLayoutAllTables();
    isDirty = true;
    updateSaveBtn();
  }

  allTables.forEach((table) => {
    const placed = table.grid_x !== null && table.grid_x !== undefined;
    if (placed && table.page === curPage) {
      canvas.appendChild(createEditCard(table));
    } else if (!placed) {
      unplacedList.appendChild(createUnplacedItem(table));
    }
    // 다른 페이지 배치 테이블은 DOM에 표시 안 함
  });

  renderPageNav();
};

// ----- 카테고리 탭 렌더 -----
const renderNav = () => {
  const _nav = document.querySelector('.set_table_position main section nav ul');
  if (!tableData || tableData.length === 0) { _nav.innerHTML = ''; return; }
  _nav.innerHTML = [...tableData]
    .sort((a, b) => a.position - b.position)
    .map((cat, i) => `
      <li data-id="${cat.id}" data-state="${i === curCategoryIndex ? 'active' : ''}">
        <button onclick="changeTableCategory(event,${i})">${cat.name}</button>
      </li>
    `).join('');
};

// ----- 저장 버튼 상태 -----
const updateSaveBtn = () => {
  document.querySelector('.save-layout-btn')?.classList.toggle('dirty', isDirty);
};

// ----- 저장 (tableData 기준 전체 페이지) -----
const clickSaveLayoutBtn = async () => {
  const category = tableData?.[curCategoryIndex];
  if (!category) return;

  const tables = (category.tables || []).map(t => ({
    id: t.id,
    grid_x: t.grid_x ?? null,
    grid_y: t.grid_y ?? null,
    grid_w: t.grid_w ?? null,
    grid_h: t.grid_h ?? null,
    page: t.page || 1,
  }));

  const result = await fetchDataAsync('/store/update_table_layout', 'PATCH', { tables });
  if (result.code !== 200) return showToast(result.msg, 'error');
  isDirty = false;
  updateSaveBtn();
  showToast('저장되었습니다.', 'success');
};

window.addEventListener('beforeunload', (e) => { if (isDirty) e.preventDefault(); });

// =============================================
//  API
// =============================================

const callTableList = () => {
  fetchData('/store/get_table', 'GET', {}, (data) => {
    tableData = data;
    curPage = 1;
    renderNav();
    updateCellSize();
    renderCanvas();
  });
};

const changeTableCategory = (event, index) => {
  clearSelectedCard();
  curCategoryIndex = index;
  curPage = 1;
  renderNav();
  renderCanvas();
};

let resizeTimer;
const ro = new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    updateCellSize();
    document.querySelectorAll('#table-canvas .table-card').forEach(applyCardRect);
  }, 60);
});

// =============================================
//  테이블 추가
// =============================================

const focusInputAtEnd = (input) => {
  if (!input) return;
  input.focus();
  const len = input.value.length;
  input.setSelectionRange(len, len);
};

const clickAddTableBtn = () => {
  const category = tableData?.[curCategoryIndex];
  const categoryName = category?.name || '테이블';
  const modal = openDefaultModal();
  modal.top.innerHTML = modalTopHtml('테이블 추가');
  modal.middle.innerHTML = `
    <div style="display:flex;border-bottom:2px solid #eee;margin-bottom:18px;">
      <button type="button" id="tab-auto" onclick="switchAddTableTab('auto')"
        style="flex:1;padding:10px 0;font-size:13px;font-weight:700;border:none;background:none;cursor:pointer;color:#1FAA9C;border-bottom:2px solid #1FAA9C;margin-bottom:-2px;">
        자동 배치
      </button>
      <button type="button" id="tab-manual" onclick="switchAddTableTab('manual')"
        style="flex:1;padding:10px 0;font-size:13px;font-weight:700;border:none;background:none;cursor:pointer;color:#aaa;border-bottom:2px solid transparent;margin-bottom:-2px;">
        수동 추가
      </button>
    </div>

    <!-- 자동 배치 패널 -->
    <div id="panel-auto">
      <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;">고정 테이블명</label>
      <input type="text" id="table-name-prefix" placeholder="예: 홀" value="${categoryName}"
        style="width:100%;box-sizing:border-box;height:38px;padding:0 10px;border:1px solid #dadada;border-radius:8px;font-size:14px;outline:none;"/>
      <label style="display:flex;align-items:center;gap:8px;margin-top:14px;cursor:pointer;font-size:13px;font-weight:500;color:#555;">
        <input type="checkbox" id="table-auto-number" onchange="toggleStartNum(this.checked)"
          style="width:16px;height:16px;accent-color:#1FAA9C;cursor:pointer;"/>
        배치된 테이블 기준 자동 숫자 증가
      </label>
      <div style="display:flex;gap:12px;margin-top:14px;">
        <div id="wrap-start-num" style="flex:1;">
          <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;">시작 번호</label>
          <input type="number" id="table-start-num" value="1" min="1"
            style="width:100%;box-sizing:border-box;height:38px;padding:0 10px;text-align:center;border:1px solid #dadada;border-radius:8px;font-size:14px;font-weight:600;outline:none;"/>
        </div>
        <div style="flex:1;">
          <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;">추가할 개수</label>
          <div style="display:flex;align-items:center;gap:6px;">
            <button type="button" class="brand" onclick="adjustTableCount(-1)"
              style="width:38px;height:38px;border-radius:8px;font-size:18px;cursor:pointer;flex-shrink:0;">-</button>
            <input type="number" id="table-count" value="5" min="1" max="20"
              style="flex:1;height:38px;text-align:center;border:1px solid #dadada;border-radius:8px;font-size:15px;font-weight:600;outline:none;"/>
            <button type="button" class="brand" onclick="adjustTableCount(1)"
              style="width:38px;height:38px;border-radius:8px;font-size:18px;cursor:pointer;flex-shrink:0;">+</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 수동 추가 패널 -->
    <div id="panel-manual" style="display:none;">
      <label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;">테이블 이름</label>
      <input type="text" id="table-manual-name" placeholder="테이블 이름 입력" value="${categoryName}"
        style="width:100%;box-sizing:border-box;height:38px;padding:0 10px;border:1px solid #dadada;border-radius:8px;font-size:14px;outline:none;"/>
      <p style="margin-top:10px;font-size:12px;color:#aaa;">입력한 이름 그대로 1개 테이블이 미배치 목록에 추가됩니다.</p>
    </div>
  `;
  modal.bottom.innerHTML = `
    <div id="bottom-auto" class="buttons">
      <button class="close brand">취소</button>
      <button class="brand_fill" onclick="callCreateTable(event, true)">자동 배치</button>
    </div>
    <div id="bottom-manual" class="buttons" style="display:none;">
      <button class="close brand">취소</button>
      <button class="brand_fill" onclick="callCreateTableManual(event)">추가</button>
    </div>
  `;
  focusInputAtEnd(document.getElementById('table-name-prefix'));
};

const toggleStartNum = (checked) => {
  document.getElementById('wrap-start-num').style.display = checked ? 'none' : '';
};

const switchAddTableTab = (tab) => {
  const isAuto = tab === 'auto';
  document.getElementById('tab-auto').style.color    = isAuto ? '#1FAA9C' : '#aaa';
  document.getElementById('tab-auto').style.borderBottomColor = isAuto ? '#1FAA9C' : 'transparent';
  document.getElementById('tab-manual').style.color  = isAuto ? '#aaa' : '#1FAA9C';
  document.getElementById('tab-manual').style.borderBottomColor = isAuto ? 'transparent' : '#1FAA9C';
  document.getElementById('panel-auto').style.display   = isAuto ? '' : 'none';
  document.getElementById('panel-manual').style.display = isAuto ? 'none' : '';
  document.getElementById('bottom-auto').style.display   = isAuto ? 'flex' : 'none';
  document.getElementById('bottom-manual').style.display = isAuto ? 'none' : 'flex';
  focusInputAtEnd(document.getElementById(isAuto ? 'table-name-prefix' : 'table-manual-name'));
};

const adjustTableCount = (delta) => {
  const input = document.getElementById('table-count');
  if (!input) return;
  input.value = Math.min(20, Math.max(1, (parseInt(input.value) || 1) + delta));
};

const callCreateTableManual = async (event) => {
  const name = document.getElementById('table-manual-name')?.value?.trim();
  if (!name) return showToast('테이블 이름을 입력해주세요.', 'warning');
  const category = tableData?.[curCategoryIndex];
  if (!category) return;
  const result = await fetchDataAsync('/adm/create_table', 'POST', {
    name, seat_count: 4, table_category: category.id, page: curPage, position: (category.tables?.length || 0) + 1,
  });
  if (!result || !result.table_id) return showToast(`"${name}" 추가 실패`, 'error');
  const t = { id: result.table_id, name: result.table_name || name, grid_x: null, grid_y: null, grid_w: null, grid_h: null, page: curPage };
  category.tables.push(t);
  removeModal();
  document.querySelector('.unplaced-list').appendChild(createUnplacedItem(t));
  showToast(`"${name}" 테이블이 추가되었습니다.`, 'success');
  isDirty = true;
  updateSaveBtn();
};

const callCreateTable = async (event, autoPlace = false) => {
  const prefix = document.getElementById('table-name-prefix')?.value?.trim() || '테이블';
  const count  = Math.min(20, Math.max(1, parseInt(document.getElementById('table-count')?.value) || 1));
  const autoNumber = document.getElementById('table-auto-number')?.checked || false;
  const category = tableData?.[curCategoryIndex];
  if (!category) return;

  let startPos;
  if (autoNumber) {
    const placedTables = (category.tables || []).filter(t => t.grid_x !== null && t.grid_x !== undefined);
    const maxNum = placedTables.reduce((max, t) => {
      const m = t.name.match(/(\d+)\s*$/);
      return m ? Math.max(max, parseInt(m[1])) : max;
    }, 0);
    startPos = maxNum + 1;
  } else {
    startPos = parseInt(document.getElementById('table-start-num')?.value) || 1;
  }
  const newTables = [];

  for (let i = 0; i < count; i++) {
    const name = `${prefix} ${startPos + i}`;
    const result = await fetchDataAsync('/adm/create_table', 'POST', {
      name, seat_count: 4, table_category: category.id, page: curPage, position: startPos + i,
    });
    if (!result || !result.table_id) { showToast(`"${name}" 추가 실패`, 'error'); continue; }
    const t = { id: result.table_id, name: result.table_name || name, grid_x: null, grid_y: null, grid_w: null, grid_h: null, page: curPage };
    category.tables.push(t);
    newTables.push(t);
  }

  if (!newTables.length) return;
  removeModal();

  if (autoPlace) {
    const canvas = document.getElementById('table-canvas');
    newTables.forEach((table) => {
      const slot = findEmptySlotAnyPage(AUTO_GW, AUTO_GH);
      if (!slot) return;
      Object.assign(table, { grid_x: slot.gx, grid_y: slot.gy, grid_w: AUTO_GW, grid_h: AUTO_GH, page: slot.page });
      if (slot.page === curPage) {
        const card = createEditCard({ ...table });
        card.classList.add('placing');
        canvas.appendChild(card);
        setTimeout(() => card.classList.remove('placing'), 400);
      }
    });
    renderPageNav();
    showToast(`${newTables.length}개 테이블이 추가 및 배치되었습니다.`, 'success');
  } else {
    const unplacedList = document.querySelector('.unplaced-list');
    newTables.forEach((table) => {
      unplacedList.appendChild(createUnplacedItem(table));
    });
    showToast(`${newTables.length}개 테이블이 추가되었습니다.`, 'success');
  }

  isDirty = true;
  updateSaveBtn();
};

// =============================================
//  테이블 이름 변경 / 삭제
// =============================================

// ----- 캔버스 카드 인라인 이름 편집 -----
const startInlineCardEdit = (card, tableId) => {
  const h2 = card.querySelector('h2');
  if (!h2) return;
  const currentName = h2.textContent;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.className = 'card-name-input';
  h2.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const restore = (name) => {
    if (done) return;
    done = true;
    const newH2 = document.createElement('h2');
    newH2.textContent = name;
    newH2.addEventListener('pointerdown', e => e.stopPropagation());
    newH2.addEventListener('click', e => { e.stopPropagation(); startInlineCardEdit(card, tableId); });
    if (input.parentNode) input.replaceWith(newH2);
  };

  const save = async () => {
    if (done) return;
    const newName = input.value.trim();
    if (!newName || newName === currentName) { restore(currentName); return; }
    const result = await fetchDataAsync('/adm/update_table_name', 'PATCH', { table_id: tableId, name: newName });
    if (result.code !== 200) { showToast(result.msg, 'error'); restore(currentName); return; }
    syncTableData(tableId, { name: newName });
    const nameEl = document.querySelector(`.unplaced-item[data-id="${tableId}"] .unplaced-name`);
    if (nameEl) nameEl.textContent = newName;
    restore(newName);
  };

  input.addEventListener('pointerdown', e => e.stopPropagation());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { done = true; restore(currentName); }
  });
  input.addEventListener('blur', save);
};

// ----- 미배치 아이템 인라인 이름 편집 -----
const startInlineUnplacedEdit = (item, tableId) => {
  const nameEl = item.querySelector('.unplaced-name');
  if (!nameEl) return;
  const currentName = nameEl.textContent;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.className = 'unplaced-name-input';
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const restore = (name) => {
    if (done) return;
    done = true;
    const newSpan = document.createElement('span');
    newSpan.className = 'unplaced-name';
    newSpan.textContent = name;
    newSpan.addEventListener('pointerdown', e => e.stopPropagation());
    newSpan.addEventListener('click', e => { e.stopPropagation(); startInlineUnplacedEdit(item, tableId); });
    if (input.parentNode) input.replaceWith(newSpan);
  };

  const save = async () => {
    if (done) return;
    const newName = input.value.trim();
    if (!newName || newName === currentName) { restore(currentName); return; }
    const result = await fetchDataAsync('/adm/update_table_name', 'PATCH', { table_id: tableId, name: newName });
    if (result.code !== 200) { showToast(result.msg, 'error'); restore(currentName); return; }
    syncTableData(tableId, { name: newName });
    const cardH2 = document.querySelector(`#table-canvas .table-card[data-id="${tableId}"] h2`);
    if (cardH2) cardH2.textContent = newName;
    restore(newName);
  };

  input.addEventListener('pointerdown', e => e.stopPropagation());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { done = true; restore(currentName); }
  });
  input.addEventListener('blur', save);
};

const openDeleteModal = (id) => {
  const modal = openDefaultModal();
  modal.top.innerHTML = modalTopHtml('테이블 삭제');
  modal.middle.innerHTML = `
    <i class="ph ph-warning-circle" style="font-size:40px;color:#e74c3c;"></i>
    <p style="margin-top:8px;">이 테이블을 삭제하시겠습니까?</p>
  `;
  modal.bottom.innerHTML = modalBottomHtml([
    { class: 'close brand', text: '취소', fun: '' },
    { class: 'red', text: '삭제', fun: `onclick="callDeleteTable(event,${id})"` },
  ]);
};

const callDeleteTable = async (event, id) => {
  const result = await fetchDataAsync('/store/set_table', 'DELETE', { id });
  if (result.code !== 200) return showToast(result.msg, 'error');
  document.querySelector(`#table-canvas .table-card[data-id="${id}"]`)?.remove();
  document.querySelector(`.unplaced-item[data-id="${id}"]`)?.remove();
  document.querySelector('.modal')?.click();
  showToast('삭제되었습니다.', 'success');
  const category = tableData?.[curCategoryIndex];
  if (category) category.tables = category.tables.filter(t => t.id !== id);
  isDirty = true;
  updateSaveBtn();
};


// =============================================
//  구역 관리
// =============================================

const clickSetTableCategoryBtn = () => {
  const modal = openDefaultModal();
  modal.container.classList.add('category');
  modal.top.innerHTML = modalTopHtml('구역 설정');
  modal.middle.innerHTML = modalSetTableCategoryHtml(tableData);
  modal.bottom.innerHTML = modalBottomHtml([
    { class: 'close brand', text: '취소', fun: '' },
    { class: 'brand_fill', text: '저장', fun: 'onclick="clickSetTabelCategroySaveBtn(event)"' },
  ]);
  new Sortable(document.querySelector('.modal_middle ul'), { handle: '.move', animation: 150 });
};

const clickSetTabelCategroySaveBtn = async () => {
  const items = [...document.querySelectorAll('.modal_middle li')].map((_li, i) => {
    const name = _li.querySelector('input').value;
    if (name.replace(/\s+/g, '').length < 1) {
      _li.querySelector('input').classList.add('required');
      return null;
    }
    return { id: _li.dataset.id === '' ? null : Number(_li.dataset.id), category_name: name, position: i + 1 };
  });
  if (items.includes(null)) return showToast('구역명이 올바르지 않습니다.', 'warning');
  const result = await fetchDataAsync('/store/set_table_category', 'POST', items);
  if (result.code !== 200) return showToast(result.msg, 'error');
  removeModal();
  showToast(result.msg, 'success');
  curCategoryIndex = 0;
  callTableList();
};

const clickAddCategoryBtn = () => {
  const _ul = document.querySelector('.modal_middle ul');
  _ul.insertAdjacentHTML('beforeend', modalAddCategroyLiHtml());
  _ul.querySelector('li:last-child input').focus();
};

const clickDeleteCategoryItem = async (event) => {
  const _li = findParentTarget(event.target, 'li');
  const id = _li.dataset.id === '' ? null : Number(_li.dataset.id);
  if (id) {
    const result = await fetchDataAsync('/store/get_table_id_yn', 'GET', { id });
    if (result.status) _li.remove();
    else showToast('이용 중인 테이블이 있어 삭제가 불가능합니다.', 'error');
  } else {
    _li.remove();
  }
};

// =============================================
//  Init
// =============================================
callTableList();

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('table-canvas');
  if (canvas) {
    ro.observe(canvas);
    canvas.addEventListener('click', (e) => {
      if (e.target === canvas) clearSelectedCard();
    });
  }
});
