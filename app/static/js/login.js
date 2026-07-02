// ── 인라인 폼 에러 메시지 ──
const showFormMsg = (msgId, msg, type = 'error') => {
  const _msg = document.getElementById(msgId);
  if (!_msg) return;
  const _form = _msg.closest('form');

  const icon = type === 'error'
    ? '<i class="ph ph-warning-circle"></i>'
    : '<i class="ph ph-check-circle"></i>';

  _msg.className = `form_msg ${type} show`;
  _msg.innerHTML = `${icon}<span>${msg}</span>`;

  if (type === 'error' && _form) {
    _form.classList.remove('shake', 'input_error');
    void _form.offsetWidth;
    _form.classList.add('shake', 'input_error');
    const inputs = _form.querySelectorAll('input:not([type="submit"]), select');
    const clearError = () => {
      _form.classList.remove('input_error');
      inputs.forEach(el => el.removeEventListener('input', clearError));
    };
    inputs.forEach(el => el.addEventListener('input', clearError));
  }
};

const hideFormMsg = (msgId) => {
  const _msg = document.getElementById(msgId);
  if (_msg) _msg.className = 'form_msg';
};

// ── 토스트 알림 ──
const showToast = (msg, type = 'success', duration = 3000) => {
  const wrap = document.getElementById('toast_wrap');
  if (!wrap) return;
  const icon = type === 'success'
    ? '<i class="ph ph-check-circle"></i>'
    : '<i class="ph ph-warning-circle"></i>';
  const item = document.createElement('div');
  item.className = `toast_item ${type}`;
  item.innerHTML = `${icon}<span>${msg}</span>`;
  wrap.appendChild(item);
  setTimeout(() => {
    item.classList.add('fade_out');
    item.addEventListener('animationend', () => item.remove());
  }, duration);
};

// ── 전화번호 자동 포커스 이동 ──
const changeInputTel = (event) => {
  const target = event.currentTarget;
  const form = target.closest('form');
  const idx = Number(target.dataset.index);
  const len = target.value.length;
  if ((idx === 0 && len >= 3) || (idx === 1 && len >= 4)) {
    const next = form
      ? form.querySelector(`input[type="tel"][data-index="${idx + 1}"]`)
      : document.querySelector(`input[type="tel"][data-index="${idx + 1}"]`);
    if (next) next.focus();
  }
  if (form && form.id === 'form_admin') checkAdminValid();
  if (document.body.classList.contains('register')) checkRegisterValid();
};

// ── 비밀번호 보기 토글 ──
const clickToggleShowPassword = (event) => {
  event.preventDefault();
  const btn = event.currentTarget;
  const _passwordBox = btn.closest('.password_box');
  const isActive = _passwordBox.classList.contains('active');
  const _input = _passwordBox.querySelector('input');
  _input.setAttribute('type', isActive ? 'password' : 'text');
  _passwordBox.classList.toggle('active');
};

// ── 탭 전환 ──
const showTab = (tab) => {
  const formStore = document.getElementById('form_store');
  const formAdmin = document.getElementById('form_admin');
  const tabStore = document.getElementById('tab_store');
  const tabAdmin = document.getElementById('tab_admin');
  if (!formStore || !formAdmin) return;

  if (tab === 'store') {
    formStore.classList.remove('hidden');
    formAdmin.classList.add('hidden');
    tabStore.classList.add('active');
    tabAdmin.classList.remove('active');
  } else {
    formStore.classList.add('hidden');
    formAdmin.classList.remove('hidden');
    tabStore.classList.remove('active');
    tabAdmin.classList.add('active');
  }
};

// ── 매장 로그인 유효성 검사 ──
const checkStoreValid = () => {
  const form = document.getElementById('form_store');
  if (!form) return;
  const submit = form.querySelector('input[type="submit"]');
  const storeId = form.querySelector('#store_id')?.value.trim() ?? '';
  const password = form.querySelector('#store_password')?.value ?? '';
  if (submit) submit.disabled = !(storeId.length > 0 && password.length > 0);
};

// ── 관리자 로그인 유효성 검사 ──
const checkAdminValid = () => {
  const form = document.getElementById('form_admin');
  if (!form) return;
  const submit = form.querySelector('input[type="submit"]');
  const tels = [...form.querySelectorAll('input[type="tel"]')].map(el => el.value.trim()).join('');
  const password = form.querySelector('#admin_password')?.value ?? '';
  if (submit) submit.disabled = !(tels.length >= 11 && password.length > 0);
};

// ── 모드 1: 매장 로그인 ──
const onSubmitStoreLogin = (event) => {
  event.preventDefault();
  const form = event.target;
  const storeId = form.querySelector('#store_id').value.trim();
  const password = form.querySelector('#store_password').value;
  const fd = new FormData();
  fd.append('store_id', storeId);
  fd.append('password', password);
  fetch('/login', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(data => {
      if (data.code === 200) {
        window.location.href = '/dashboard';
      } else {
        showFormMsg('form_store_msg', data.message);
      }
    })
    .catch(() => showFormMsg('form_store_msg', '오류가 발생했습니다.'));
};

// ── 모드 2: 관리자 로그인 ──
const onSubmitAdminLogin = (event) => {
  event.preventDefault();
  const form = event.target;
  const tels = [...form.querySelectorAll('input[type="tel"]')].map(el => el.value).join('');
  const password = form.querySelector('#admin_password').value;
  const fd = new FormData();
  fd.append('admin_tel', tels);
  fd.append('password', password);
  fetch('/login', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(data => {
      if (data.code === 200) {
        window.location.href = '/login'; // GET 재요청 → 매장 선택 화면
      } else {
        showFormMsg('form_admin_msg', data.message);
      }
    })
    .catch(() => showFormMsg('form_admin_msg', '오류가 발생했습니다.'));
};

// ── 모드 3: 관리자 세션 → 매장 선택 ──
const onSubmitStoreSelect = (event) => {
  event.preventDefault();
  const form = event.target;
  const storeId = form.querySelector('#store_select').value;
  const fd = new FormData();
  fd.append('store_id', storeId);
  fetch('/login', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(data => {
      if (data.code === 200) {
        window.location.href = '/dashboard';
      } else {
        showFormMsg('form_msg', data.message);
      }
    })
    .catch(() => showFormMsg('form_msg', '오류가 발생했습니다.'));
};

// ── 인증번호 요청 (register.html) ──
const clickRequestVerifyCode = (event) => {
  const form = event.currentTarget.closest('form');
  const telInputs = form
    ? [...form.querySelectorAll('input[type="tel"]')]
    : [...document.querySelectorAll('input[type="tel"]')];
  const tel = telInputs.map(el => el.value.trim()).join('');
  if (tel.length < 11) {
    showToast('전화번호를 먼저 입력해주세요', 'error');
    return;
  }
  // Firebase 전화 인증 (실제 SMS 발송)
  if (window.ogFirebasePhone) {
    const btn = event.currentTarget;
    if (btn) btn.disabled = true;
    window.ogFirebasePhone.sendCode(tel)
      .then(() => showToast('인증번호가 발송되었습니다', 'success'))
      .catch(err => {
        console.error('[Firebase sendCode]', err);
        var detail = (err && err.code ? err.code : '') + ' ' + (err && err.message ? err.message : err);
        alert('인증번호 발송 오류\n' + detail);
        showToast('발송 실패: ' + detail, 'error');
      })
      .finally(() => { if (btn) btn.disabled = false; });
    return;
  }
  // 폴백: 서버 SMS
  const fd = new FormData();
  fd.append('tel', tel);
  fetch('/send_verify_code', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(data => {
      if (data.code === 200) {
        showToast('인증번호가 발송되었습니다', 'success');
        if (data.verify_code) alert('인증번호: ' + data.verify_code);
      } else {
        showToast(data.message || '발송에 실패했습니다', 'error');
      }
    })
    .catch(() => showToast('발송 중 오류가 발생했습니다', 'error'));
};

// ── 관리자 회원가입 (register.html) ──
const onSubmitRegister = (event) => {
  event.preventDefault();
  const form = event.target;
  const tels = [...form.querySelectorAll('input[type="tel"]')].map(el => el.value).join('');
  const password = form.querySelector('#password').value;
  const codeNumber = form.querySelector('#code_number').value;

  const postRegister = (idToken) => {
    const fd = new FormData();
    fd.append('tel', tels);
    fd.append('password', password);
    fd.append('code_number', codeNumber);
    if (idToken) fd.append('firebase_id_token', idToken);
    fetch('/register_admin', { method: 'POST', body: fd })
      .then(r => r.json())
      .then(data => {
        if (data.code === 200) {
          showToast('관리자 로그인 후 스토어를 생성해 주세요', 'success');
          setTimeout(() => { window.location.href = '/login'; }, 2000);
        } else {
          showFormMsg('form_msg', data.message);
        }
      })
      .catch(() => showToast('오류가 발생했습니다.', 'error'));
  };

  // Firebase 인증코드 확인 후 가입
  if (window.ogFirebasePhone) {
    window.ogFirebasePhone.confirmCode(codeNumber)
      .then(idToken => postRegister(idToken))
      .catch(() => showFormMsg('form_msg', '인증번호가 올바르지 않습니다.'));
    return;
  }
  postRegister(null);
};

// ── 회원가입 유효성 검사 (register.html) ──
const checkRegisterValid = () => {
  const form = document.querySelector('form');
  if (!form) return;
  const submit = form.querySelector('input[type="submit"]');
  if (!submit) return;
  const tels = [...form.querySelectorAll('input[type="tel"]')].map(el => el.value.trim()).join('');
  const code = form.querySelector('#code_number')?.value.trim() ?? '';
  const password = form.querySelector('#password')?.value.trim() ?? '';
  submit.disabled = !(tels.length >= 11 && code.length > 0 && password.length > 0);
};

// ── 매장 생성 (store_create.html) ──
const onSubmitCreateStore = (event) => {
  event.preventDefault();
  const form = event.target;
  const name = form.querySelector('#name').value;
  const password = form.querySelector('.password_box input').value;
  const store_id = form.querySelector('#store_id').value;
  const store_image = form.querySelector('#input_logo_img').files[0];
  const fd = new FormData();
  fd.append('store_id', store_id);
  fd.append('name', name);
  fd.append('password', password);
  fd.append('store_image', store_image);
  fetch('/register_store', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(data => {
      if (data.code === 200) {
        showToast('매장을 생성하였습니다. 스토어 로그인을 진행해 주세요', 'success');
        setTimeout(() => { window.location.href = '/login'; }, 2500);
      } else {
        showToast(data.message, 'error');
      }
    })
    .catch(() => showToast('오류가 발생했습니다.', 'error'));
};

// ── 초기화 ──
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.classList.contains('register')) {
    const form = document.querySelector('form');
    if (!form) return;
    form.querySelectorAll('input[type="tel"]').forEach(el => el.addEventListener('input', checkRegisterValid));
    form.querySelector('#code_number')?.addEventListener('input', checkRegisterValid);
    form.querySelector('#password')?.addEventListener('input', checkRegisterValid);
    checkRegisterValid();
    return;
  }

  const formStore = document.getElementById('form_store');
  if (formStore) {
    formStore.querySelector('#store_id')?.addEventListener('input', checkStoreValid);
    formStore.querySelector('#store_password')?.addEventListener('input', checkStoreValid);
    checkStoreValid();
  }

  const formAdmin = document.getElementById('form_admin');
  if (formAdmin) {
    formAdmin.querySelector('#admin_password')?.addEventListener('input', checkAdminValid);
    formAdmin.querySelectorAll('input[type="tel"]').forEach(el => el.addEventListener('input', checkAdminValid));
    checkAdminValid();
  }
});
