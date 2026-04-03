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
let selectedCard = null;

// ----- 자동 저장 -----
let saveTimer;
const autoSave = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 500);
};
const doSave = async () => {
  const category = tableData?.[curCategoryIndex];
  if (!category) return;
  const tables = (category.tables || []).map(t => ({
    id: t.id,
    grid_x: t.grid_x ?? null,  grid_y: t.grid_y ?? null,
    grid_w: t.grid_w ?? null,  grid_h: t.grid_h ?? null,
  }));
  await fetchDataAsync('/store/update_table_layout', 'PATCH', { tables });
};

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
  CELL_W = (canvas.clientWidth  + GAP) / COLS;
  CELL_H = (canvas.clientHeight + GAP) / ROWS;
  canvas.style.backgroundSize = `${CELL_W}px ${CELL_H}px`;
};

// ----- 겹침 감지 -----
const checkOverlap = (excludeId, gx, gy, gw, gh) => {
  for (const card of document.querySelectorAll('#table-canvas .table-card')) {
    if (excludeId !== null && String(card.dataset.id) === String(excludeId)) continue;
    const cx = Number(card.dataset.gx), cy = Number(card.dataset.gy);
    const cw = Number(card.dataset.gw), ch = Number(card.dataset.gh);
    if (gx < cx + cw && gx + gw > cx && gy < cy + ch && gy + gh > cy) return true;
  }
  return false;
};


// ----- 빈 슬롯 탐색 (tableData 기반) -----
const findFirstEmptySlot = (gw, gh) => {
  const tables = (tableData?.[curCategoryIndex] || {}).tables || [];
  const placed = tables.filter(t => t.grid_x !== null && t.grid_x !== undefined);

  for (let gy = 0; gy <= ROWS - gh; gy++) {
    for (let gx = 0; gx <= COLS - gw; gx++) {
      const overlaps = placed.some(t =>
        gx < t.grid_x + t.grid_w && gx + gw > t.grid_x &&
        gy < t.grid_y + t.grid_h && gy + gh > t.grid_y);
      if (!overlaps) return { gx, gy };
    }
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

// ----- 두 카드 교환 (위치/사이즈 유지, id·이름만 교체) -----
const swapCards = (cardA, cardB) => {
  const idA = Number(cardA.dataset.id), idB = Number(cardB.dataset.id);
  const nameA = cardA.querySelector('h2').textContent;
  const nameB = cardB.querySelector('h2').textContent;

  // DOM: id와 이름만 교체, 위치·사이즈는 그대로
  cardA.dataset.id = idB; cardA.querySelector('h2').textContent = nameB;
  cardB.dataset.id = idA; cardB.querySelector('h2').textContent = nameA;
  cardB.classList.remove('selected');

  // tableData: 각 id가 상대방 카드 위치·사이즈를 갖도록 업데이트
  syncTableData(idB, { grid_x: Number(cardA.dataset.gx), grid_y: Number(cardA.dataset.gy),
                       grid_w: Number(cardA.dataset.gw), grid_h: Number(cardA.dataset.gh) });
  syncTableData(idA, { grid_x: Number(cardB.dataset.gx), grid_y: Number(cardB.dataset.gy),
                       grid_w: Number(cardB.dataset.gw), grid_h: Number(cardB.dataset.gh) });

  autoSave();
  haptic();
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
  card.innerHTML = `
    <h2>${table.name}</h2>
    <div class="card-actions">
      <button class="delete-btn" title="삭제"><i class="ph ph-trash"></i></button>
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
    openDeleteModal(Number(card.dataset.id));
  });

  attachDrag(card);
  attachResize(card.querySelector('.resize-handle'), card);
  return card;
};

// ----- 드래그 (클릭 vs 드래그 구분) -----
const attachDrag = (card) => {
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.resize-handle') || e.target.closest('.card-actions')) return;
    const activeInput = document.querySelector('.card-name-input');
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
      }
      if (!dragStarted) return;

      const gw = Number(card.dataset.gw), gh = Number(card.dataset.gh);
      const newLeft = clampVal(startLeft + dx, 0, (COLS - gw) * CELL_W);
      const newTop  = clampVal(startTop  + dy, 0, (ROWS - gh) * CELL_H);
      card.style.left = `${newLeft}px`;
      card.style.top  = `${newTop}px`;

      const sx = leftToGrid(newLeft), sy = topToGrid(newTop);
      if (sx !== prevSnapX || sy !== prevSnapY) {
        haptic(); prevSnapX = sx; prevSnapY = sy;
        card.dataset.gx = sx; card.dataset.gy = sy;
        renderAddButtons();
      }
    };

    const onUp = (e) => {
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerup', onUp);

      if (!dragStarted) { handleCardClick(card); return; }
      card.classList.remove('dragging');

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
      renderAddButtons();
      autoSave();
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

    const onMove = (e) => {
      const gx = Number(card.dataset.gx), gy = Number(card.dataset.gy);
      const newGW = clampVal(startGW + Math.round((e.clientX - startPx) / CELL_W), MIN_W, COLS - gx);
      const newGH = clampVal(startGH + Math.round((e.clientY - startPy) / CELL_H), MIN_H, ROWS - gy);
      card.style.width  = `${gridToWidth(newGW)}px`;
      card.style.height = `${gridToHeight(newGH)}px`;
      if (newGW !== prevSnapW || newGH !== prevSnapH) {
        haptic();
        prevSnapW = newGW; prevSnapH = newGH;
        card.dataset.gw = newGW; card.dataset.gh = newGH;
        renderAddButtons();
      }
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
        card.dataset.gw = startGW; card.dataset.gh = startGH;
        card.style.width  = `${gridToWidth(startGW)}px`;
        card.style.height = `${gridToHeight(startGH)}px`;
        renderAddButtons();
        return;
      }
      card.dataset.gw = gw;
      card.dataset.gh = gh;
      applyCardRect(card);
      syncTableData(Number(card.dataset.id), { grid_w: gw, grid_h: gh });
      autoSave();
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });
};

// ----- 캔버스 렌더 -----
const renderCanvas = () => {
  clearSelectedCard();
  const canvas = document.getElementById('table-canvas');
  canvas.innerHTML = '';
  if (!tableData || tableData.length === 0) return;
  const category = tableData[curCategoryIndex];
  if (!category) return;
  const allTables = category.tables || [];
  const allUnplaced = allTables.length > 0 &&
    allTables.every(t => t.grid_x === null || t.grid_x === undefined);
  if (allUnplaced) { autoLayoutAllTables(); doSave(); }
  allTables.forEach((table) => {
    if (table.grid_x !== null && table.grid_x !== undefined)
      canvas.appendChild(createEditCard(table));
  });
  renderAddButtons();
};

// ----- 빈 슬롯 + 버튼 렌더 -----
const findFirstSlotForSize = (gw, gh) => {
  for (let gy = 0; gy <= ROWS - gh; gy++) {
    for (let gx = 0; gx <= COLS - gw; gx++) {
      if (!checkOverlap(null, gx, gy, gw, gh)) return { gx, gy };
    }
  }
  return null;
};

const renderAddButtons = () => {
  document.querySelectorAll('#table-canvas .add-slot-btn').forEach(b => b.remove());
  const canvas = document.getElementById('table-canvas');
  // 기본 사이즈(AUTO_GW×AUTO_GH) 먼저, 없으면 최소 사이즈(MIN_W×MIN_H)
  let slot = findFirstSlotForSize(AUTO_GW, AUTO_GH);
  if (slot) { canvas.appendChild(createAddSlotBtn(slot.gx, slot.gy, AUTO_GW, AUTO_GH)); return; }
  slot = findFirstSlotForSize(MIN_W, MIN_H);
  if (slot) { canvas.appendChild(createAddSlotBtn(slot.gx, slot.gy, MIN_W, MIN_H)); }
};

const createAddSlotBtn = (gx, gy, gw, gh) => {
  const btn = document.createElement('div');
  btn.className = 'add-slot-btn';
  btn.style.left   = `${gridToLeft(gx)}px`;
  btn.style.top    = `${gridToTop(gy)}px`;
  btn.style.width  = `${gridToWidth(gw)}px`;
  btn.style.height = `${gridToHeight(gh)}px`;
  btn.innerHTML = `<i class="ph ph-plus"></i>`;
  btn.addEventListener('click', () => clickAddSlot(gx, gy, gw, gh));
  return btn;
};

const clickAddSlot = async (gx, gy, gw, gh) => {
  // 중복 클릭 방지: 즉시 버튼 제거
  document.querySelectorAll('#table-canvas .add-slot-btn').forEach(b => b.remove());
  const category = tableData?.[curCategoryIndex];
  if (!category) return;
  const name = `${category.name} ${(category.tables?.length || 0) + 1}`;
  const result = await fetchDataAsync('/adm/create_table', 'POST', {
    name, seat_count: 4, table_category: category.id,
    position: (category.tables?.length || 0) + 1,
  });
  if (!result || !result.table_id) { renderAddButtons(); return showToast('테이블 추가 실패', 'error'); }
  const t = { id: result.table_id, name: result.table_name || name,
    grid_x: gx, grid_y: gy, grid_w: gw, grid_h: gh };
  category.tables.push(t);
  await doSave();  // 즉시 저장 (debounce 없이)

  const canvas = document.getElementById('table-canvas');
  const card = createEditCard(t);
  card.classList.add('placing');
  canvas.appendChild(card);
  renderAddButtons();  // 남은 빈 슬롯 다시 렌더

  setTimeout(() => {
    card.classList.remove('placing');
    startInlineCardEdit(card, t.id);  // 이름 편집 포커스
  }, 350);
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

// =============================================
//  API
// =============================================

const callTableList = () => {
  fetchData('/store/get_table', 'GET', {}, (data) => {
    tableData = data;
    renderNav();
    updateCellSize();
    renderCanvas();
  });
};

const changeTableCategory = (event, index) => {
  clearSelectedCard();
  curCategoryIndex = index;
  renderNav();
  renderCanvas();
};

let resizeTimer;
const ro = new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    updateCellSize();
    document.querySelectorAll('#table-canvas .table-card').forEach(applyCardRect);
    renderAddButtons();
  }, 60);
});

// =============================================
//  테이블 이름 변경 / 삭제
// =============================================

const focusInputAtEnd = (input) => {
  if (!input) return;
  input.focus();
  const len = input.value.length;
  input.setSelectionRange(len, len);
};

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
  modal.middle.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:12px 0 4px;">
      <i class="ph ph-trash" style="font-size:48px;color:#F43E25;"></i>
      <p style="font-size:16px;font-weight:700;color:#222;text-align:center;">테이블을 삭제하시겠습니까?</p>
      <p style="font-size:13px;color:#999;text-align:center;">삭제된 테이블은 복구할 수 없습니다.</p>
    </div>
  `;
  modal.bottom.innerHTML = modalBottomHtml([
    { class: 'close gray', text: '취소', fun: '' },
    { class: 'red_fill', text: '삭제', fun: `onclick="callDeleteTable(event,${id})"` },
  ]);
};

const callDeleteTable = async (event, id) => {
  const result = await fetchDataAsync('/store/set_table', 'DELETE', { id });
  if (result.code !== 200) return showToast(result.msg, 'error');
  document.querySelector(`#table-canvas .table-card[data-id="${id}"]`)?.remove();
  document.querySelector('.modal')?.click();
  showToast('삭제되었습니다.', 'success');
  const category = tableData?.[curCategoryIndex];
  if (category) category.tables = category.tables.filter(t => t.id !== id);
  renderAddButtons();
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
