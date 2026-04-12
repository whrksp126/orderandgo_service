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
   * 포트에 바이트 배열 전송 후 스트림 닫기 (버퍼 완전 플러시 보장)
   * writer.close()는 write 큐가 모두 전송될 때까지 대기 후 writable 스트림을 닫음
   * @param {SerialPort} port
   * @param {Uint8Array} bytes
   */
  async function sendBytes(port, bytes) {
    const writer = port.writable.getWriter();
    await writer.write(bytes);
    await writer.close(); // 전송 완료까지 대기 + writable 스트림 닫기
  }

  /**
   * 테스트 출력
   * 1. 저장된 usbVendorId/usbProductId가 있으면 getPorts()로 자동 매칭 시도
   * 2. 매칭 실패 시 requestPort()로 사용자 선택 (사용자 제스처 필요)
   * 3. 포트 오픈 → 인쇄 내용 전송 + 자동 절단 → 포트 닫기
   *
   * @param {number} baudRate - 프린터 보드레이트
   * @param {number|null} usbVendorId - 저장된 USB Vendor ID (없으면 null)
   * @param {number|null} usbProductId - 저장된 USB Product ID (없으면 null)
   */
  async function testPrint(baudRate, usbVendorId, usbProductId) {
    if (!isSupported()) {
      throw new Error('이 브라우저는 Web Serial API를 지원하지 않습니다.\nChrome 또는 Edge를 사용해주세요.');
    }

    let port = null;

    // 저장된 포트 정보가 있으면 기존 권한 포트에서 자동 매칭 시도
    if (usbVendorId !== null && usbVendorId !== undefined) {
      try {
        const ports = await navigator.serial.getPorts();
        for (const p of ports) {
          const info = p.getInfo();
          if (info.usbVendorId === usbVendorId && info.usbProductId === usbProductId) {
            port = p;
            break;
          }
        }
      } catch (_) {}
    }

    // 자동 매칭 실패 시 사용자 제스처(클릭) 컨텍스트에서 requestPort() 호출
    if (!port) {
      try {
        port = await navigator.serial.requestPort();
      } catch (e) {
        if (e.name === 'NotFoundError') return; // 사용자가 취소
        throw new Error('포트 선택 실패: ' + e.message);
      }
    }

    try {
      // dataBits/stopBits/parity 명시 (RS-232 계열 프린터 필수)
      await port.open({ baudRate: baudRate || 19200, dataBits: 8, stopBits: 1, parity: 'none' });
      console.log('[Printer] 포트 열림. info:', port.getInfo(), '/ baudRate:', baudRate);

      // 테스트 출력은 ASCII만 사용 (서버 네트워크 콜 제거)
      const payload = concatBytes(
        CMD_INIT,
        encodeASCII('===== Test Print =====\n'),
        encodeASCII('Hello Printer\n'),
        encodeASCII('======================\n'),
        CMD_FEED3,
        CMD_CUT
      );

      console.log('[Printer] 전송 바이트 수:', payload.length);
      await sendBytes(port, payload);
      console.log('[Printer] 전송 완료');
    } finally {
      try { await port.close(); } catch (_) {}
      console.log('[Printer] 포트 닫힘');
    }
  }

  return {
    isSupported,
    selectPort,
    testPrint,
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
