/**
 * PrinterManager
 * Web Serial API + ESC/POS 기반 USB 열전사 프린터 제어 모듈
 * 지원: POS Bank 및 ESC/POS 호환 USB 직렬 프린터
 *
 * 한글 ESC/POS 바이트는 Flask 백엔드(/pos/generate_order_slip)에서 생성.
 * Python cp949 인코딩으로 한글을 완벽히 처리하고, 프론트는 받아서 Serial로 전송.
 */
const PrinterManager = {
    port: null,
    writer: null,
    _opening: false,

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
        if (this.isConnected()) return true;
        if (this._opening) throw new Error('이미 연결 시도 중입니다. 잠시 후 다시 시도해주세요.');
        this.port = await navigator.serial.requestPort();
        await this._openPort();
        return true;
    },

    /**
     * 자동 재연결: 이전에 허가된 포트로 자동 연결 (페이지 로드 시 호출)
     */
    async autoConnect() {
        if (!this.isSupported()) return false;
        if (this.isConnected()) return true;
        if (this._opening) return false;
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
        if (this._opening) throw new Error('이미 포트 열기 진행 중입니다.');
        this._opening = true;
        try {
            const baudRate = parseInt(localStorage.getItem('printer_baud') || '19200');
            await this.port.open({ baudRate });
            this.writer = this.port.writable.getWriter();
        } finally {
            this._opening = false;
        }
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

    // ─── 주문 슬립 출력 ──────────────────────────────────────────────────────────
    /**
     * 백엔드에서 cp949 인코딩된 ESC/POS 바이트를 받아 프린터로 전송
     * @param {Object} orderData
     * @param {string} orderData.tableName  - 테이블 이름
     * @param {Array}  orderData.items      - setBasketData() 결과: [{ data: { name, price, options }, length }]
     * @param {number} [orderData.total]    - 합계 금액
     */
    async printOrderSlip(orderData) {
        console.log('[PrinterManager] printOrderSlip 호출:', JSON.stringify(orderData));
        const res = await fetch('/pos/generate_order_slip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData),
        });
        if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        console.log(`[PrinterManager] ESC/POS 바이트 수신: ${bytes.length}bytes → 전송 시작`);
        await this._send(bytes);
        console.log('[PrinterManager] 전송 완료');
    },

    // ─── 테스트 출력 ─────────────────────────────────────────────────────────────
    async testPrint() {
        await this.printOrderSlip({
            tableName: '테스트 테이블',
            items: [
                { data: { name: '아메리카노', price: 4500, options: [] }, length: 2 },
                { data: { name: '카페라떼', price: 5500, options: [{ name: '샷 추가', price: 500, count: 1 }] }, length: 1 },
                { data: { name: '치즈케이크', price: 6500, options: [] }, length: 1 },
            ],
        });
    },
};
