/* ============================================================
   store_terminal_mgmt.js
   단말기 관리 페이지 전용 스크립트
   ============================================================ */

let currentStoreId = '';

/* ── 초기화 ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadTerminalInfo();
});

/* ── 단말기 정보 불러오기 ─────────────────────────────── */
const loadTerminalInfo = () => {
  fetchData('/store/get_terminal_info', 'GET', {}, (data) => {
    currentStoreId = data.store_id || '';

    // 매장 아이디
    const storeIdEl = document.getElementById('store_id_display');
    if (data.store_id) {
      storeIdEl.textContent = data.store_id;
      storeIdEl.classList.remove('empty');
    } else {
      storeIdEl.textContent = '등록된 아이디 없음';
      storeIdEl.classList.add('empty');
    }

    // 토스 가맹점 정보
    document.getElementById('toss_merchant_id_input').value = data.toss_merchant_id || '';
    document.getElementById('toss_business_number_input').value = data.toss_business_number || '';

    // 단말기 시리얼
    const serialInput = document.getElementById('terminal_serial_input');
    serialInput.value = data.terminal_serial || '';

    // 연결 상태
    updateConnectionStatus(data.is_connected, data.last_connected_at);
  });
};

/* ── 연결 상태 뱃지 업데이트 ──────────────────────────── */
const updateConnectionStatus = (isConnected, lastConnectedAt) => {
  const badge = document.getElementById('connection_status_badge');
  const text = document.getElementById('connection_status_text');
  const lastWrap = document.getElementById('last_connected_wrap');
  const lastTime = document.getElementById('last_connected_time');

  badge.classList.remove('connected', 'disconnected');

  if (isConnected) {
    badge.classList.add('connected');
    text.textContent = '연결됨';
  } else {
    badge.classList.add('disconnected');
    text.textContent = '미연결';
  }

  if (lastConnectedAt) {
    lastWrap.style.display = 'block';
    lastTime.textContent = `마지막 연결: ${formatDateTime(lastConnectedAt)}`;
  } else {
    lastWrap.style.display = 'none';
  }
};

/* ── 매장 아이디 복사 ─────────────────────────────────── */
const copyStoreId = () => {
  if (!currentStoreId) {
    showToast('복사할 매장 아이디가 없습니다.', 'error');
    return;
  }
  navigator.clipboard.writeText(currentStoreId)
    .then(() => showToast('매장 아이디가 복사되었습니다.', 'success'))
    .catch(() => {
      // fallback
      const el = document.createElement('textarea');
      el.value = currentStoreId;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      showToast('매장 아이디가 복사되었습니다.', 'success');
    });
};

/* ── 시리얼 초기화 ─────────────────────────────────────── */
const clickResetSerial = () => {
  document.getElementById('terminal_serial_input').value = '';
  showToast('시리얼 번호가 초기화되었습니다. 저장 버튼을 눌러 적용하세요.', 'warning');
};

/* ── 저장 ─────────────────────────────────────────────── */
const clickSaveTerminalInfo = async () => {
  const serial = document.getElementById('terminal_serial_input').value.trim();
  const merchantId = document.getElementById('toss_merchant_id_input').value.trim();
  const businessNumber = document.getElementById('toss_business_number_input').value.trim();

  try {
    const result = await fetchDataAsync('/store/update_terminal_info', 'PATCH', {
      terminal_serial: serial,
      toss_merchant_id: merchantId,
      toss_business_number: businessNumber,
    });

    if (result && result.code === 200) {
      showToast('저장되었습니다.', 'success');
      loadTerminalInfo();
    } else {
      showToast(result?.msg || '저장에 실패했습니다.', 'error');
    }
  } catch (e) {
    showToast('저장 중 오류가 발생했습니다.', 'error');
  }
};

/* ── 날짜 포맷 헬퍼 ───────────────────────────────────── */
const formatDateTime = (isoString) => {
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
