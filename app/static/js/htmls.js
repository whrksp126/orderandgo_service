// 메뉴판 페이지 우측 장바구니 상단 버튼 HTML
const posMenuListBasketTopBtnsHtml = () => {
  return `
    <button 
      onclick="minusBasketMenu(event)" 
      data-active="false" 
      class="minus">
      <i class="ph ph-minus"></i>
    </button>
    <button 
      onclick="plusBasketMenu(event)" 
      data-active="false" 
      class="plus">
      <i class="ph ph-plus"></i>
    </button>
    <button 
      onclick="deleteBasketMenu(event)" 
      class="delete" 
      data-active="false">
      <i class="ph ph-trash"></i>
    </button>
    <button 
      onclick="clickOrderHistoryBtn(event)" 
      class="order_history" 
      data-check="false" 
      data-active="true">
      주문내역
    </button>
  `
}


// 메뉴판 페이지 우측 주문내역 상단 버튼 HTML
const posMenuListOrderListTopBtnsHtml = () => {
  return `
    <button 
      onclick="minusOrderListMenu(event)" 
      data-active="false" 
      class="minus">
      <i class="ph ph-minus"></i>
    </button>
    <button 
      onclick="plusOrderListMenu(event)" 
      data-active="false" 
      class="plus">
      <i class="ph ph-plus"></i>
    </button>
    <button 
      onclick="deleteOrderListMenu(event)" 
      class="delete" 
      data-active="false">
      <i class="ph ph-trash"></i>
    </button>
    <button 
      onclick="clickBasketBtn(event)" 
      class="new_order" 
      data-active="true">
      장바구니
    </button>
  `
}

// 메뉴 메인 카테고리 설정 모달 HTML
const modalSetMenuMainCategoryHtml = (categorys, type) => {
  return `
    <div>
      <h3>카테고리명</h3>
      <ul>
        ${categorys.map((category) => `
        <li data-id="${category.id}">
          <button class="move"><i class="ph-fill ph-caret-up-down"></i></button>
          <div class="input_box">
            <input type="text" value="${category.name}" />
            <i class="ph ph-pencil"></i>
          </div>
          <button class="delete" onclick="clickDeleteCategoryItem(event, '${type}')"><i class="ph ph-trash"></i></button>
        </li>
        `).join('')}
      </ul>
    </div>
    <button onclick="clickAddCategoryBtn(event)">
      <i class="ph ph-plus"></i>
      <span>카테고리 추가</span>
    </button>
  `;
}

// 메뉴 메인 카테고리 설정 모달 HTML
const modalSetTableCategoryHtml = (categorys) => {
  return `
    <div>
      <h3>구역 설정</h3>
      <ul>
        ${categorys.map((category, index) => `
        <li data-id="${category.id}" data-index="${index}">
          <button class="move"><i class="ph ph-dots-six-vertical"></i></button>
          <div class="input_box">
            <input type="text" value="${category.name}"/>
          </div>
          <button class="delete" onclick="clickDeleteCategoryItem(event)"><i class="ph ph-trash"></i></button>
        </li>
        `).join('')}
      </ul>
    </div>
    <button onclick="clickAddCategoryBtn(event)">
      <i class="ph ph-plus"></i>
      <span>구역 추가</span>
    </button>
  `;
}

// 카테고리 추가 버튼 클릭 시
const modalAddCategroyLiHtml = () => {
  return `
    <li data-id="" data-index="">
      <button class="move"><i class="ph ph-dots-six-vertical"></i></button>
      <div class="input_box">
        <input type="text" value=""/>
      </div>
      <button class="delete" onclick="clickDeleteCategoryItem(event)"><i class="ph ph-trash"></i></button>
    </li>
  `
}