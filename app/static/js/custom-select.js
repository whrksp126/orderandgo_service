class CustomSelect {
  constructor(container, { items = [], value = null, placeholder = '선택', onChange = null } = {}) {
    this._container = container;
    this._items = items;
    this._value = value;
    this._placeholder = placeholder;
    this._onChange = onChange;
    this._highlightedIndex = -1;
    this._isOpen = false;

    this._render();
    this._bindEvents();

    if (!CustomSelect._instances) CustomSelect._instances = [];
    CustomSelect._instances.push(this);
  }

  _render() {
    const selected = this._items.find(i => String(i.value) === String(this._value));
    const labelText = selected ? selected.label : this._placeholder;

    this._container.innerHTML = `
      <div class="custom-select" tabindex="0" role="combobox" aria-expanded="false" aria-haspopup="listbox">
        <div class="custom-select__trigger">
          <span class="custom-select__value">${labelText}</span>
          <i class="ph ph-caret-down custom-select__caret"></i>
        </div>
        <ul class="custom-select__list" role="listbox">
          ${this._items.map((item, idx) => `
            <li class="custom-select__item${String(item.value) === String(this._value) ? ' selected' : ''}"
                role="option"
                data-value="${item.value}"
                data-index="${idx}">
              ${item.label}
            </li>
          `).join('')}
        </ul>
      </div>
    `;

    this._el = this._container.querySelector('.custom-select');
    this._trigger = this._el.querySelector('.custom-select__trigger');
    this._list = this._el.querySelector('.custom-select__list');
    this._valueEl = this._el.querySelector('.custom-select__value');
  }

  _bindEvents() {
    this._el.addEventListener('click', (e) => {
      if (e.target.closest('.custom-select__list')) return;
      this.toggle();
    });

    this._list.addEventListener('click', (e) => {
      const item = e.target.closest('.custom-select__item');
      if (!item) return;
      this._selectByIndex(Number(item.dataset.index));
      this.close();
    });

    this._list.addEventListener('mousemove', (e) => {
      const item = e.target.closest('.custom-select__item');
      if (!item) return;
      this._setHighlight(Number(item.dataset.index));
    });

    this._el.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!this._isOpen) { this.open(); break; }
          this._moveHighlight(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!this._isOpen) { this.open(); break; }
          this._moveHighlight(-1);
          break;
        case 'Enter':
          e.preventDefault();
          if (this._isOpen && this._highlightedIndex >= 0) {
            this._selectByIndex(this._highlightedIndex);
            this.close();
          } else {
            this.open();
          }
          break;
        case 'Escape':
          this.close();
          break;
        case 'Home':
          e.preventDefault();
          if (this._isOpen) this._setHighlight(0);
          break;
        case 'End':
          e.preventDefault();
          if (this._isOpen) this._setHighlight(this._items.length - 1);
          break;
        case 'Tab':
          this.close();
          break;
      }
    });
  }

  _setHighlight(index) {
    const items = this._list.querySelectorAll('.custom-select__item');
    items.forEach(i => i.classList.remove('highlighted'));
    this._highlightedIndex = index;
    if (index >= 0 && index < items.length) {
      items[index].classList.add('highlighted');
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  _moveHighlight(delta) {
    const next = Math.max(0, Math.min(this._items.length - 1, this._highlightedIndex + delta));
    this._setHighlight(next);
  }

  _selectByIndex(index) {
    const item = this._items[index];
    if (!item) return;
    const prev = this._value;
    this._value = item.value;
    this._valueEl.textContent = item.label;

    const allItems = this._list.querySelectorAll('.custom-select__item');
    allItems.forEach(el => el.classList.remove('selected'));
    allItems[index]?.classList.add('selected');

    if (this._onChange && String(prev) !== String(item.value)) {
      this._onChange(item.value, item);
    }
  }

  open() {
    CustomSelect._closeAll(this);
    this._isOpen = true;
    this._el.classList.add('open');
    this._el.setAttribute('aria-expanded', 'true');

    const selectedIndex = this._items.findIndex(i => String(i.value) === String(this._value));
    this._setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
  }

  close() {
    this._isOpen = false;
    this._el.classList.remove('open');
    this._el.setAttribute('aria-expanded', 'false');
    this._highlightedIndex = -1;
    this._list.querySelectorAll('.custom-select__item').forEach(i => i.classList.remove('highlighted'));
  }

  toggle() {
    this._isOpen ? this.close() : this.open();
  }

  getValue() {
    return this._value;
  }

  setValue(v, silent = false) {
    const index = this._items.findIndex(i => String(i.value) === String(v));
    if (index < 0) return;
    const prev = this._value;
    this._value = this._items[index].value;
    this._valueEl.textContent = this._items[index].label;

    const allItems = this._list.querySelectorAll('.custom-select__item');
    allItems.forEach(el => el.classList.remove('selected'));
    allItems[index]?.classList.add('selected');

    if (!silent && this._onChange && String(prev) !== String(this._value)) {
      this._onChange(this._value, this._items[index]);
    }
  }

  setItems(items, selectedValue = null) {
    this._items = items;
    this._value = selectedValue;
    this._render();
    this._bindEvents();
  }

  static _closeAll(except = null) {
    (CustomSelect._instances || []).forEach(inst => {
      if (inst !== except) inst.close();
    });
  }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select')) {
    CustomSelect._closeAll();
  }
});
