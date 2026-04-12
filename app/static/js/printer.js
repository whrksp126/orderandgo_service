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
   * 테스트 출력
   * 1. requestPort() 호출 (사용자 제스처 필요)
   * 2. 포트 오픈
   * 3. 인쇄 내용 전송 + 자동 절단
   * 4. 포트 닫기
   *
   * @param {number} baudRate - 프린터 보드레이트
   */
  async function testPrint(baudRate) {
    if (!isSupported()) {
      throw new Error('이 브라우저는 Web Serial API를 지원하지 않습니다.\nChrome 또는 Edge를 사용해주세요.');
    }

    // 사용자 제스처(클릭) 컨텍스트에서 바로 호출
    let port;
    try {
      port = await navigator.serial.requestPort();
    } catch (e) {
      if (e.name === 'NotFoundError') return; // 사용자가 취소
      throw new Error('포트 선택 실패: ' + e.message);
    }

    try {
      await port.open({ baudRate: baudRate || 19200 });

      // 한글 라인을 서버에서 EUC-KR로 인코딩
      const koreanLine = await encodeToEucKR('안녕 세상');

      const payload = concatBytes(
        CMD_INIT,
        CMD_SET_KOR,
        encodeASCII('Hello World'),
        CMD_LF,
        koreanLine,
        CMD_LF,
        encodeASCII('----------'),
        CMD_LF,
        CMD_FEED3,
        CMD_CUT
      );

      await sendBytes(port, payload);
    } finally {
      // 쓰기가 완료된 후 포트 닫기
      if (port.readable) {
        // 읽기 스트림이 열려있으면 닫기
        try { await port.readable.cancel(); } catch (_) {}
      }
      try { await port.close(); } catch (_) {}
    }
  }

  return {
    isSupported,
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
