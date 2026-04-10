/**
 * PrinterManager
 * Web Serial API + ESC/POS 기반 USB 열전사 프린터 제어 모듈
 * 지원: POS Bank 및 ESC/POS 호환 USB 직렬 프린터
 */
const PrinterManager = {
    port: null,
    writer: null,

    /** 프린터 연결 여부 */
    isConnected() {
        return !!this.port && !!this.writer;
    },

    /** Web Serial API 지원 여부 */
    isSupported() {
        return 'serial' in navigator;
    },

    /**
     * 최초 연결: Chrome 직렬 포트 선택 다이얼로그 표시
     * 사용자가 포트를 선택하면 자동으로 권한이 저장됨
     */
    async connect() {
        if (!this.isSupported()) {
            throw new Error('Web Serial API 미지원 브라우저입니다. Chrome 또는 Edge를 사용해주세요.');
        }
        this.port = await navigator.serial.requestPort();
        await this._openPort();
        return true;
    },

    /**
     * 자동 재연결: 이전에 허가된 포트로 자동 연결 (페이지 로드 시 호출)
     * 최초 페어링 후에는 사용자 동작 없이 자동 연결됨
     */
    async autoConnect() {
        if (!this.isSupported()) return false;
        try {
            const ports = await navigator.serial.getPorts();
            if (ports.length === 0) return false;
            this.port = ports[0];
            await this._openPort();
            return true;
        } catch (e) {
            console.warn('프린터 자동 재연결 실패:', e);
            this.port = null;
            this.writer = null;
            return false;
        }
    },

    /** 포트 열기 (baudRate는 localStorage에서 로드, 기본 19200) */
    async _openPort() {
        const baudRate = parseInt(localStorage.getItem('printer_baud') || '19200');
        await this.port.open({ baudRate });
        this.writer = this.port.writable.getWriter();
    },

    /** 연결 해제 */
    async disconnect() {
        try {
            if (this.writer) {
                this.writer.releaseLock();
                this.writer = null;
            }
            if (this.port) {
                await this.port.close();
                this.port = null;
            }
        } catch (e) {
            console.warn('프린터 연결 해제 오류:', e);
            this.port = null;
            this.writer = null;
        }
    },

    /** 바이트 배열 전송 */
    async _send(bytes) {
        if (!this.writer) throw new Error('프린터가 연결되지 않았습니다.');
        await this.writer.write(new Uint8Array(bytes));
    },

    // ─── ESC/POS 명령어 ─────────────────────────────────────────────────────────
    CMD: {
        INIT:     [0x1B, 0x40],        // ESC @ — 프린터 초기화
        CENTER:   [0x1B, 0x61, 0x01],  // ESC a 1 — 가운데 정렬
        LEFT:     [0x1B, 0x61, 0x00],  // ESC a 0 — 왼쪽 정렬
        BOLD_ON:  [0x1B, 0x45, 0x01],  // ESC E 1 — 굵게 켜기
        BOLD_OFF: [0x1B, 0x45, 0x00],  // ESC E 0 — 굵게 끄기
        FEED:     [0x0A],              // LF — 줄 이송
        CUT:      [0x1D, 0x56, 0x01],  // GS V 1 — 부분 자동 커팅
    },

    /** 문자열 → UTF-8 바이트 배열 */
    _textBytes(str) {
        return Array.from(new TextEncoder().encode(str));
    },

    /** 문자열 + 개행 바이트 */
    _line(str = '') {
        return this._textBytes(str + '\n');
    },

    /** 구분선 (32자) */
    _divider() {
        return this._line('--------------------------------');
    },

    // ─── 주문 슬립 출력 ──────────────────────────────────────────────────────────
    /**
     * @param {Object} orderData
     * @param {string} orderData.tableName - 테이블 이름
     * @param {Array}  orderData.items     - [{ name, count, options: [{name, count}] }]
     * @param {string} [orderData.orderedAt] - 주문 시각 (없으면 현재 시각)
     */
    async printOrderSlip(orderData) {
        const { tableName, items, orderedAt } = orderData;
        const now = orderedAt || new Date().toLocaleTimeString('ko-KR');

        // 헤더
        await this._send([
            ...this.CMD.INIT,
            ...this.CMD.CENTER,
            ...this.CMD.BOLD_ON,
            ...this._line('=== 주  문  서 ==='),
            ...this.CMD.BOLD_OFF,
            ...this.CMD.LEFT,
            ...this._divider(),
            ...this._line(`테이블: ${tableName}`),
            ...this._line(`시  간: ${now}`),
            ...this._divider(),
        ]);

        // 메뉴 목록
        for (const item of items) {
            const name = String(item.name || '').substring(0, 20);
            const count = item.count || 1;
            await this._send(this._line(`${name}  x${count}`));

            // 옵션
            if (Array.isArray(item.options) && item.options.length > 0) {
                for (const opt of item.options) {
                    const optName = String(opt.name || '').substring(0, 18);
                    await this._send(this._line(`  + ${optName} x${opt.count || 1}`));
                }
            }
        }

        // 마무리: 여백 3줄 + 자동 커팅
        await this._send([
            ...this._divider(),
            ...this.CMD.FEED,
            ...this.CMD.FEED,
            ...this.CMD.FEED,
            ...this.CMD.CUT,
        ]);
    },

    // ─── 테스트 출력 ─────────────────────────────────────────────────────────────
    async testPrint() {
        await this.printOrderSlip({
            tableName: '테스트 테이블',
            items: [
                { name: '아메리카노', count: 2 },
                { name: '카페라떼', count: 1, options: [{ name: '샷 추가', count: 1 }] },
                { name: '치즈케이크', count: 1 },
            ],
            orderedAt: new Date().toLocaleTimeString('ko-KR'),
        });
    },
};
