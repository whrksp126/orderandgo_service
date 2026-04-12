/**
 * PrinterManager
 * Web Serial API 기반 ESC/POS 프린터 제어 모듈
 * 한글 출력은 서버 /store/encode_euckr API를 통해 EUC-KR 인코딩
 */

const PrinterManager = (() => {
  // ESC/POS 명령어 상수
  const ESC = 0x1B;
  const GS  = 0x1D;
  const LF  = 0x0A;

  const CMD_INIT     = new Uint8Array([ESC, 0x40]);          // 프린터 초기화
  const CMD_SET_KOR  = new Uint8Array([ESC, 0x74, 0x0D]);    // 코드페이지 KS5601(EUC-KR)
  const CMD_CUT      = new Uint8Array([GS, 0x56, 0x41, 0x00]); // 전체 절단
  const CMD_LF       = new Uint8Array([LF]);
  const CMD_FEED3    = new Uint8Array([LF, LF, LF]);          // 용지 3줄 피드

  /** Web Serial API 지원 여부 확인 */
  function isSupported() {
    return 'serial' in navigator;
  }

  /**
   * 사용자가 시리얼 포트를 선택하도록 picker를 열고 포트 정보를 반환
   * 반드시 클릭 이벤트 핸들러에서 직접 호출해야 함 (사용자 제스처 필요)
   * @returns {Promise<{usbVendorId: number|null, usbProductId: number|null}>}
   */
  async function selectPort() {
    if (!isSupported()) {
      throw new Error('이 브라우저는 Web Serial API를 지원하지 않습니다.\nChrome 또는 Edge를 사용해주세요.');
    }
    let port;
    try {
      port = await navigator.serial.requestPort();
    } catch (e) {
      if (e.name === 'NotFoundError') return null; // 사용자가 취소
      throw new Error('포트 선택 실패: ' + e.message);
    }
    const info = port.getInfo();
    return {
      usbVendorId: info.usbVendorId !== undefined ? info.usbVendorId : null,
      usbProductId: info.usbProductId !== undefined ? info.usbProductId : null
    };
  }

  /**
   * 한글이 포함된 문자열을 EUC-KR 바이트 배열로 변환 (서버 API 활용)
   * @param {string} text
   * @returns {Promise<Uint8Array>}
   */
  async function encodeToEucKR(text) {
    const response = await fetch('/store/encode_euckr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!response.ok) throw new Error('인코딩 실패');
    const data = await response.json();
    return new Uint8Array(data.bytes);
  }

  /**
   * ASCII 문자열을 Uint8Array로 변환 (서버 호출 없이 즉시)
   * @param {string} text
   * @returns {Uint8Array}
   */
  function encodeASCII(text) {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      bytes[i] = text.charCodeAt(i) & 0xFF;
    }
    return bytes;
  }

  /**
   * 여러 Uint8Array를 하나로 합치기
   * @param {...Uint8Array} arrays
   * @returns {Uint8Array}
   */
  function concatBytes(...arrays) {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  /**
   * 포트에 바이트 배열 전송
   * @param {SerialPort} port
   * @param {Uint8Array} bytes
   */
  async function sendBytes(port, bytes) {
    const writer = port.writable.getWriter();
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
  }

  /**
   * 진단 테스트 출력
   * 매장 정보, 서버 환경, 네트워크 상태, 프린터 포트 정보 등을 인쇄
   *
   * @param {number} baudRate
   * @param {number|null} usbVendorId
   * @param {number|null} usbProductId
   */
  async function testPrint(baudRate, usbVendorId, usbProductId) {
    if (!isSupported()) {
      throw new Error('이 브라우저는 Web Serial API를 지원하지 않습니다.\nChrome 또는 Edge를 사용해주세요.');
    }

    // ── 1. 포트 선택 (사용자 제스처 컨텍스트에서 먼저 호출) ────────
    let port = null;
    if (usbVendorId !== null && usbVendorId !== undefined) {
      try {
        const ports = await navigator.serial.getPorts();
        for (const p of ports) {
          const info = p.getInfo();
          if (info.usbVendorId === usbVendorId && info.usbProductId === usbProductId) {
            port = p; break;
          }
        }
      } catch (_) {}
    }
    if (!port) {
      try {
        port = await navigator.serial.requestPort();
      } catch (e) {
        if (e.name === 'NotFoundError') return;
        throw new Error('포트 선택 실패: ' + e.message);
      }
    }

    // ── 2. 진단 정보 수집 (포트 열기 전 — port.open()은 사용자 제스처 불필요) ──

    // 날짜/시간
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ` +
                    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    // 매장/서버 정보 + 응답속도 측정
    let store = { store_name: '', store_id: '', address: '', tel: '', representative: '' };
    let latencyMs = '-';
    try {
      const t0 = performance.now();
      const r = await fetch('/store/get_diagnostic_info');
      latencyMs = Math.round(performance.now() - t0) + 'ms';
      if (r.ok) store = await r.json();
    } catch (_) { latencyMs = '요청실패'; }

    // 서버 환경
    const hostname = window.location.hostname;
    let env = 'PRODUCTION';
    if (/^(localhost|127\.|192\.|10\.)/.test(hostname)) env = 'LOCAL';
    else if (hostname.startsWith('dev-')) env = 'DEV';
    else if (hostname.startsWith('stg-')) env = 'STAGING';

    // 네트워크 정보 (NetworkInformation API — Chrome 지원)
    const online = navigator.onLine ? '온라인' : '오프라인';
    const conn = navigator.connection || {};
    const connType    = conn.type          || '알 수 없음';
    const effType     = conn.effectiveType || '알 수 없음';
    const downlink    = conn.downlink  != null ? conn.downlink  + ' Mbps' : '알 수 없음';
    const rtt         = conn.rtt       != null ? conn.rtt       + ' ms'   : '알 수 없음';

    // 브라우저/OS 정보
    const ua = navigator.userAgent;
    const chromeVer = (ua.match(/Chrome\/(\d+)/) || [])[1];
    const browser = chromeVer ? 'Chrome ' + chromeVer : ua.split(' ').pop();
    const osRaw = (ua.match(/\(([^)]+)\)/) || ['', ''])[1];
    const os = osRaw.split(';')[0] || '알 수 없음';

    // 프린터 포트 정보
    const pInfo = port.getInfo();
    const toHex = v => v != null ? '0x' + v.toString(16).toUpperCase().padStart(4, '0') : '-';
    const vendorHex  = toHex(pInfo.usbVendorId);
    const productHex = toHex(pInfo.usbProductId);

    // ── 3. 영수증 내용 구성 + 일괄 EUC-KR 인코딩 (서버 콜 1회) ────
    const lines = [
      '================================',
      '   [오더앤고] 프린터 진단 출력',
      '================================',
      '출력: ' + dateStr,
      '',
      '[매장 정보]',
      '매장명: '   + (store.store_name   || '미등록'),
      '매장ID: '   + (store.store_id     || '-'),
      '대표자: '   + (store.representative || '미등록'),
      '주소: '     + (store.address      || '미등록'),
      '연락처: '   + (store.tel          || '미등록'),
      '',
      '[서비스 / 서버]',
      '서버: '     + hostname,
      '환경: '     + env,
      '응답속도: ' + latencyMs,
      '',
      '[네트워크]',
      '상태: '     + online,
      '연결유형: ' + connType,
      '속도등급: ' + effType,
      '다운링크: ' + downlink,
      '지연RTT: '  + rtt,
      '',
      '[프린터 포트]',
      'USB Vendor:  ' + vendorHex,
      'USB Product: ' + productHex,
      '전송속도: '    + (baudRate || 9600) + ' bps',
      'Data/Parity: 8N1  Flow: DTR/DSR',
      '',
      '[브라우저 / OS]',
      browser,
      os,
      '================================',
    ];

    // 전체 내용 한 번에 EUC-KR 인코딩 (\n이 0x0A로 인코딩 = 프린터 LF)
    const receiptBytes = await encodeToEucKR(lines.join('\n'));

    // ── 4. 포트 열고 전송 ────────────────────────────────────────────
    try {
      await port.open({ baudRate: baudRate || 9600, dataBits: 8, stopBits: 1, parity: 'none' });
      console.log('[Printer] 포트 열림. info:', pInfo, '/ baudRate:', baudRate);

      await port.setSignals({ dataTerminalReady: true });
      await new Promise(resolve => setTimeout(resolve, 100));

      const payload = concatBytes(
        CMD_INIT, CMD_SET_KOR,
        receiptBytes,
        CMD_LF,
        CMD_FEED3,
        CMD_CUT
      );

      console.log('[Printer] 전송 바이트 수:', payload.length);
      await sendBytes(port, payload);

      // baud rate 기준 전송 완료 예상 시간 + 여유 50% 대기
      // 9600 baud = 960 bytes/sec (8N1: 10 bits/byte)
      const waitMs = Math.max(Math.ceil(payload.length / (baudRate / 10) * 1000 * 1.5), 500);
      console.log('[Printer] 전송 완료 대기:', waitMs + 'ms');
      await new Promise(resolve => setTimeout(resolve, waitMs));
    } finally {
      try {
        await port.setSignals({ dataTerminalReady: false });
        await port.close();
      } catch (_) {}
      console.log('[Printer] 포트 닫힘');
    }
  }

  /**
   * 영수증 라인 배열을 시리얼 프린터로 출력
   * testPrint()와 동일한 흐름이지만 진단 정보 수집 없이 lines 배열을 직접 출력
   *
   * @param {string[]} lines - 출력할 텍스트 줄 배열
   * @param {number} baudRate
   * @param {number|null} usbVendorId
   * @param {number|null} usbProductId
   */
  async function printReceipt(lines, baudRate, usbVendorId, usbProductId) {
    if (!isSupported()) {
      throw new Error('이 브라우저는 Web Serial API를 지원하지 않습니다.\nChrome 또는 Edge를 사용해주세요.');
    }

    // ── 1. 포트 선택 (사용자 제스처 컨텍스트에서 먼저 호출) ────────
    let port = null;
    if (usbVendorId !== null && usbVendorId !== undefined) {
      try {
        const ports = await navigator.serial.getPorts();
        for (const p of ports) {
          const info = p.getInfo();
          if (info.usbVendorId === usbVendorId && info.usbProductId === usbProductId) {
            port = p; break;
          }
        }
      } catch (_) {}
    }
    if (!port) {
      try {
        port = await navigator.serial.requestPort();
      } catch (e) {
        if (e.name === 'NotFoundError') return;
        throw new Error('포트 선택 실패: ' + e.message);
      }
    }

    // ── 2. EUC-KR 인코딩 (서버 콜 1회) ──────────────────────────────
    const receiptBytes = await encodeToEucKR(lines.join('\n'));

    // ── 3. 포트 열고 전송 ────────────────────────────────────────────
    try {
      await port.open({ baudRate: baudRate || 9600, dataBits: 8, stopBits: 1, parity: 'none' });
      console.log('[Printer] 포트 열림. baudRate:', baudRate);

      await port.setSignals({ dataTerminalReady: true });
      await new Promise(resolve => setTimeout(resolve, 100));

      const payload = concatBytes(
        CMD_INIT, CMD_SET_KOR,
        receiptBytes,
        CMD_LF,
        CMD_FEED3,
        CMD_CUT
      );

      console.log('[Printer] 영수증 전송 바이트 수:', payload.length);
      await sendBytes(port, payload);

      const waitMs = Math.max(Math.ceil(payload.length / ((baudRate || 9600) / 10) * 1000 * 1.5), 500);
      console.log('[Printer] 전송 완료 대기:', waitMs + 'ms');
      await new Promise(resolve => setTimeout(resolve, waitMs));
    } finally {
      try {
        await port.setSignals({ dataTerminalReady: false });
        await port.close();
      } catch (_) {}
      console.log('[Printer] 포트 닫힘');
    }
  }

  return {
    isSupported,
    selectPort,
    testPrint,
    printReceipt,
    encodeToEucKR,
    encodeASCII,
    concatBytes,
    sendBytes,
    CMD_INIT,
    CMD_SET_KOR,
    CMD_CUT,
    CMD_LF,
    CMD_FEED3
  };
})();
