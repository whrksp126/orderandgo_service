/**
 * PrinterManager
 * Web Serial API + ESC/POS 기반 USB 열전사 프린터 제어 모듈
 * 지원: POS Bank 및 ESC/POS 호환 USB 직렬 프린터
 *
 * ※ 한글 출력은 Canvas 비트맵 방식 사용 (UTF-8 인코딩 문제 우회)
 *    브라우저가 Canvas에 한글 텍스트를 렌더링 → 1-bit 래스터 → GS v 0 전송
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
        INIT: [0x1B, 0x40],       // ESC @ — 프린터 초기화
        FEED: [0x0A],             // LF — 줄 이송
        CUT:  [0x1D, 0x56, 0x01], // GS V 1 — 부분 자동 커팅
    },

    // ─── Canvas → ESC/POS 래스터 비트맵 출력 ────────────────────────────────────

    /**
     * Canvas를 1-bit 래스터로 변환 후 GS v 0 (래스터 비트 이미지) 명령으로 전송
     * 한글을 포함한 모든 문자를 인코딩 문제 없이 출력 가능
     */
    async _printCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        const imageData = ctx.getImageData(0, 0, W, H);

        const bytesPerRow = Math.ceil(W / 8);
        const raster = [];

        for (let y = 0; y < H; y++) {
            for (let bx = 0; bx < bytesPerRow; bx++) {
                let byte = 0;
                for (let bit = 0; bit < 8; bit++) {
                    const x = bx * 8 + bit;
                    if (x < W) {
                        const i = (y * W + x) * 4;
                        // 루마 계산 (어두운 픽셀 = 인쇄)
                        const luma = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
                        if (luma < 128) byte |= (0x80 >> bit);
                    }
                }
                raster.push(byte);
            }
        }

        const xL = bytesPerRow & 0xFF;
        const xH = (bytesPerRow >> 8) & 0xFF;
        const yL = H & 0xFF;
        const yH = (H >> 8) & 0xFF;

        console.log(`[PrinterManager] 래스터 전송: ${W}×${H}px, ${raster.length}bytes`);

        // INIT → GS v 0 (래스터 비트 이미지) → 여백 3줄 → 커팅
        await this._send([...this.CMD.INIT]);
        // GS v 0: 0x1D 0x76 0x30 mode(0=일반) xL xH yL yH data...
        await this._send([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...raster]);
        await this._send([...this.CMD.FEED, ...this.CMD.FEED, ...this.CMD.FEED, ...this.CMD.CUT]);
    },

    /**
     * 주문 내역 Canvas 생성
     * 브라우저가 한글 텍스트를 직접 렌더링하므로 인코딩 문제 없음
     * 토스 프론트 단말기 주문 내역과 동일한 레이아웃
     */
    _createOrderSlipCanvas(orderData) {
        const { tableName, items, orderedAt } = orderData;
        const now = orderedAt || new Date().toLocaleTimeString('ko-KR');
        const total = orderData.total ?? items.reduce((sum, { data, length }) => sum + (data.price || 0) * length, 0);

        // 80mm 열전사 프린터 기준: 203dpi, 인쇄폭 약 72mm = 576px
        const W = 576;
        const FONT_SIZE = 26;
        const LINE_H = 40;
        const PAD_X = 16;
        const DIVIDER = '─'.repeat(28);

        // 출력할 줄 목록 생성
        const lines = [];
        const add = (text, bold = false, align = 'left') => lines.push({ text, bold, align });

        add('주  문  서', true, 'center');
        add(DIVIDER);
        add(`테이블: ${tableName}`);
        add(`시  간: ${now}`);
        add(DIVIDER);

        for (const { data, length } of items) {
            const itemTotal = ((data.price || 0) * length).toLocaleString();
            add(`${data.name}`, true);
            if (length >= 2) {
                add(`  수량 x${length}        ${itemTotal}원`);
            } else {
                add(`  ${itemTotal}원`);
            }
            for (const opt of (data.options || [])) {
                const optCount = opt.count || 1;
                const optTotal = ((opt.price || 0) * optCount).toLocaleString();
                const qStr = optCount >= 2 ? ` x${optCount}` : '';
                add(`  + ${opt.name}${qStr}  ${optTotal}원`);
            }
        }

        add(DIVIDER);
        add(`합  계:  ${total.toLocaleString()}원`, true);
        add(DIVIDER);

        // Canvas 생성 및 렌더링
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = lines.length * LINE_H + 48;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000000';

        let y = 24;
        for (const { text, bold, align } of lines) {
            const fs = bold ? FONT_SIZE + 2 : FONT_SIZE;
            ctx.font = `${bold ? 'bold' : 'normal'} ${fs}px 'Malgun Gothic', 'Apple SD Gothic Neo', 'NanumGothic', sans-serif`;
            ctx.textAlign = align === 'center' ? 'center' : 'left';
            const x = align === 'center' ? W / 2 : PAD_X;
            ctx.fillText(text, x, y);
            y += LINE_H;
        }

        return canvas;
    },

    // ─── 주문 슬립 출력 ──────────────────────────────────────────────────────────
    /**
     * 토스 프론트 단말기 주문 내역 레이아웃과 동일한 포맷으로 출력
     * @param {Object} orderData
     * @param {string} orderData.tableName  - 테이블 이름
     * @param {Array}  orderData.items      - setBasketData() 결과: [{ data: { name, price, options: [{name, price, count}] }, length }]
     * @param {number} [orderData.total]    - 합계 금액 (없으면 items에서 자동 계산)
     * @param {string} [orderData.orderedAt] - 주문 시각 (없으면 현재 시각)
     */
    async printOrderSlip(orderData) {
        console.log('[PrinterManager] printOrderSlip 호출:', JSON.stringify(orderData));
        const canvas = this._createOrderSlipCanvas(orderData);
        await this._printCanvas(canvas);
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
            orderedAt: new Date().toLocaleTimeString('ko-KR'),
        });
    },
};
