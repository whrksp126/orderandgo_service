/**
 * Receipt Engine
 * 범용 영수증 및 주문 슬립 생성 시스템 (receiptline 라이브러리 적용)
 */

const ReceiptEngine = {
    // 영수증 설정 (Characters Per Line: 42, Language: ko)
    cpl: 42,
    config: '{ cpl: 42, lang: "ko" }',

    // receiptline용 명세서 텍스트 생성
    generateReceiptText(storeInfo, orderData, paymentInfo) {
        const now = new Date();
        const dateTimeStr = now.toLocaleString('ko-KR');
        const totalPrice = paymentInfo.price;
        const vat = Math.round(totalPrice / 11);
        const supplyPrice = totalPrice - vat;

        let text = storeInfo.receipt_header ? storeInfo.receipt_header + '\n' : `
^영 수 증
^${storeInfo.name || 'Order & Go'}
`;
        text += `---
사업자번호: | ${storeInfo.business_number || '000-00-00000'}
대 표 자: | ${storeInfo.representative_name || '-'}
주    소: | ${(storeInfo.address || '-').replace(' | ', ' ')}
전화번호: | ${storeInfo.tel || '-'}
---
거 래 일 시: | ${dateTimeStr}
테 이 블 명: | ${orderData.tableName || '-'}
---
{B:메뉴명} | {B:수량} | {B:금액}
`;

        orderData.items.forEach(item => {
            text += `${item.name} | ${item.count} | ${(item.price * item.count).toLocaleString()}\n`;
            if (item.options) {
                item.options.forEach(opt => {
                    text += ` - ${opt.name} | ${opt.count || 1} | ${(opt.price * (opt.count || 1)).toLocaleString()}\n`;
                });
            }
        });

        text += `---
주문금액: | ${(totalPrice + (paymentInfo.discount || 0) - (paymentInfo.extra_charge || 0)).toLocaleString()}
`;
        if (paymentInfo.discount > 0) text += `할인금액: | -${paymentInfo.discount.toLocaleString()}\n`;
        if (paymentInfo.extra_charge > 0) text += `추가금액: | +${paymentInfo.extra_charge.toLocaleString()}\n`;

        text += `---
공급가액: | ${supplyPrice.toLocaleString()}
부가가치세: | ${vat.toLocaleString()}
{B:합계금액} | {B:${totalPrice.toLocaleString()}}
---
결제수단: | ${paymentInfo.method === 1 ? '현금' : '카드'}
`;
        if (paymentInfo.method === 2) {
            text += `카드번호: | ****-****-****-****\n`;
            text += `승인번호: | ${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}\n`;
        }


        if (storeInfo.receipt_footer) {
            text += storeInfo.receipt_footer + '\n';
        } else {
            text += `---
^^이용해 주셔서 감사합니다.
^^Order & Go POS System
`;
        }
        return text;
    },

    // 2단 레이아웃 영수증 전용 보기 모달 오픈
    openReceiptModal(storeInfo, orderData, paymentInfo) {
        const receiptText = this.generateReceiptText(storeInfo, orderData, paymentInfo);

        // receiptline transform (SVG 생성)
        let receiptSvg = '';
        if (typeof receiptline !== 'undefined') {
            receiptSvg = receiptline.transform(receiptText, { cpl: this.cpl, lang: "ko" });
        } else {
            receiptSvg = '<div style="padding:20px;">ReceiptLine Library Not Loaded</div>';
        }

        // 모달 생성
        const modalId = 'receipt-view-modal';
        let modalEl = document.getElementById(modalId);
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = modalId;
            modalEl.className = 'option-modal-overlay active';
            document.body.appendChild(modalEl);
        }

        const totalPrice = paymentInfo.price;
        const vat = Math.round(totalPrice / 11);
        const supplyPrice = totalPrice - vat;

        // 영수증 아이템 텍스트 목록 생성
        const itemsListHtml = orderData.items.map(item => `
            <div class="summary-item">
                <span class="name">${item.name} x ${item.count}</span>
                <span class="val">${(item.price * item.count).toLocaleString()}원</span>
            </div>
        `).join('');

        modalEl.innerHTML = `
      <div class="receipt-modal-content premium-modal">
         <div class="receipt-modal-header">
           <h1>영수증 상세보기</h1>
           <i class="ph-bold ph-x" onclick="document.getElementById('${modalId}').remove()"></i>
        </div>
        <div class="receipt-modal-body split-layout">
          <!-- 왼쪽: 영수증 프리뷰 -->
          <div class="receipt-preview-section">
            <div id="receipt-svg-container-modal" class="receipt-paper-effect">
              ${receiptSvg}
            </div>
          </div>
          
          <!-- 오른쪽: 요약 정보 -->
          <div class="receipt-summary-section">
            <div class="summary-box">
                <div class="summary-header">
                  <h3>결제 내역 상세</h3>
                </div>
                <div class="summary-list">
                  <div class="summary-item"><span>매장명</span><span>${storeInfo.name}</span></div>
                  <div class="summary-item"><span>거래일시</span><span>${new Date().toLocaleString()}</span></div>
                  <div class="summary-item"><span>테이블</span><span>${orderData.tableName}</span></div>
                  <div class="summary-divider"></div>
                  <div class="items-scroll-area">
                    ${itemsListHtml}
                  </div>
                  <div class="summary-divider"></div>
                  <div class="summary-item"><span>공급가액</span><span>${supplyPrice.toLocaleString()}원</span></div>
                  <div class="summary-item"><span>부가가치세</span><span>${vat.toLocaleString()}원</span></div>
                  <div class="summary-item total"><span>합계금액</span><span>${totalPrice.toLocaleString()}원</span></div>
                  <div class="summary-item"><span>결제수단</span><span>${paymentInfo.method === 1 ? '현금' : '카드'}</span></div>
                </div>
            </div>
            
            <div class="receipt-modal-actions">
              <button class="receipt-btn save-img" onclick="ReceiptEngine.saveAsImage('receipt-svg-container-modal', 'Receipt')">이미지로 저장</button>
              <button class="receipt-btn print-paper" onclick="ReceiptEngine.printToPaper('receipt-svg-container-modal')">종이로 인쇄</button>
              <button class="receipt-btn close-btn" onclick="document.getElementById('${modalId}').remove()">닫기</button>
            </div>
          </div>
        </div>
      </div>
    `;
    },

    // 실제 종이 인쇄 (물리 프린터) 지원
    printToPaper(elementId) {
        const printContents = document.getElementById(elementId).innerHTML;

        // 인쇄용 임시 창 구성
        const printWindow = window.open('', '_blank', 'width=800,height=800');
        printWindow.document.write('<html><head><title>Receipt Print</title>');

        // 기존 스타일 복사 (SVG 렌더링을 위해 필요)
        const styles = document.querySelectorAll('link[rel="stylesheet"], style');
        styles.forEach(style => {
            printWindow.document.write(style.outerHTML);
        });

        printWindow.document.write(`
            <style>
                body { background: white; padding: 0; margin: 0; display: flex; justify-content: center; }
                #receipt-svg-container-modal { box-shadow: none; border: none; padding: 0; width: 100%; display: block; }
                svg { width: 100%; height: auto; }
                @page { margin: 0; }
            </style>
        `);
        printWindow.document.write('</head><body>');
        printWindow.document.write('<div id="receipt-svg-container-modal">');
        printWindow.document.write(printContents);
        printWindow.document.write('</div>');
        printWindow.document.write('</body></html>');
        printWindow.document.close();

        // 스타일 로드 대기 후 인쇄
        printWindow.onload = function () {
            printWindow.print();
            printWindow.close();
        };

        // onload가 작동하지 않을 경우 대비 (최대 500ms 대기)
        setTimeout(() => {
            if (!printWindow.closed) {
                printWindow.print();
                printWindow.close();
            }
        }, 500);
    },

    // 취소 영수증 텍스트 생성
    generateCancelReceiptText(storeInfo, orderData, cancelInfo) {
        const cancelledAt = cancelInfo.cancelledAt
            ? this._fmtDateStr(cancelInfo.cancelledAt)
            : this._fmtDateStr(new Date());
        const totalPrice = cancelInfo.price;
        const vat = Math.round(totalPrice / 11);
        const supplyPrice = totalPrice - vat;

        let text = storeInfo.receipt_header ? storeInfo.receipt_header + '\n' : `
^취 소 영 수 증
^${storeInfo.name || 'Order & Go'}
`;
        text += `---
사업자번호: | ${storeInfo.business_number || '000-00-00000'}
대 표 자: | ${storeInfo.representative_name || '-'}
주    소: | ${(storeInfo.address || '-').replace(' | ', ' ')}
전화번호: | ${storeInfo.tel || '-'}
---
취 소 일 시: | ${cancelledAt}
테 이 블 명: | ${orderData.tableName || '-'}
---
{B:메뉴명} | {B:수량} | {B:금액}
`;

        orderData.items.forEach(item => {
            text += `${item.name} | ${item.count} | ${(item.price * item.count).toLocaleString()}\n`;
            if (item.options) {
                item.options.forEach(opt => {
                    text += ` - ${opt.name} | ${opt.count || 1} | ${(opt.price * (opt.count || 1)).toLocaleString()}\n`;
                });
            }
        });

        text += `---
공급가액: | ${supplyPrice.toLocaleString()}
부가가치세: | ${vat.toLocaleString()}
{B:취소금액} | {B:${totalPrice.toLocaleString()}}
---
결제수단: | ${cancelInfo.method === 1 ? '현금' : '카드'} (취소)
`;

        if (storeInfo.receipt_footer) {
            text += storeInfo.receipt_footer + '\n';
        } else {
            text += `---
^^이용해 주셔서 감사합니다.
^^Order & Go POS System
`;
        }
        return text;
    },

    // 취소 영수증 모달 오픈
    openCancelReceiptModal(storeInfo, orderData, cancelInfo) {
        const receiptText = this.generateCancelReceiptText(storeInfo, orderData, cancelInfo);

        let receiptSvg = '';
        if (typeof receiptline !== 'undefined') {
            receiptSvg = receiptline.transform(receiptText, { cpl: this.cpl, lang: "ko" });
        } else {
            receiptSvg = '<div style="padding:20px;">ReceiptLine Library Not Loaded</div>';
        }

        const modalId = 'receipt-view-modal';
        let modalEl = document.getElementById(modalId);
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = modalId;
            modalEl.className = 'option-modal-overlay active';
            document.body.appendChild(modalEl);
        }

        const totalPrice = cancelInfo.price;
        const vat = Math.round(totalPrice / 11);
        const supplyPrice = totalPrice - vat;
        const cancelledAt = cancelInfo.cancelledAt
            ? this._fmtDateStr(cancelInfo.cancelledAt)
            : this._fmtDateStr(new Date());

        const itemsListHtml = orderData.items.map(item => `
            <div class="summary-item">
                <span class="name">${item.name} x ${item.count}</span>
                <span class="val">${(item.price * item.count).toLocaleString()}원</span>
            </div>
        `).join('');

        modalEl.innerHTML = `
      <div class="receipt-modal-content premium-modal">
         <div class="receipt-modal-header">
           <h1>취소 영수증 상세보기</h1>
           <i class="ph-bold ph-x" onclick="document.getElementById('${modalId}').remove()"></i>
        </div>
        <div class="receipt-modal-body split-layout">
          <div class="receipt-preview-section">
            <div id="receipt-svg-container-modal" class="receipt-paper-effect">
              ${receiptSvg}
            </div>
          </div>
          <div class="receipt-summary-section">
            <div class="summary-box">
                <div class="summary-header">
                  <h3>취소 내역 상세</h3>
                </div>
                <div class="summary-list">
                  <div class="summary-item"><span>매장명</span><span>${storeInfo.name}</span></div>
                  <div class="summary-item" style="color:#e74c3c;"><span>취소일시</span><span>${cancelledAt}</span></div>
                  <div class="summary-item"><span>테이블</span><span>${orderData.tableName}</span></div>
                  <div class="summary-divider"></div>
                  <div class="items-scroll-area">
                    ${itemsListHtml}
                  </div>
                  <div class="summary-divider"></div>
                  <div class="summary-item"><span>공급가액</span><span>${supplyPrice.toLocaleString()}원</span></div>
                  <div class="summary-item"><span>부가가치세</span><span>${vat.toLocaleString()}원</span></div>
                  <div class="summary-item total" style="color:#e74c3c;"><span>취소금액</span><span>${totalPrice.toLocaleString()}원</span></div>
                  <div class="summary-item"><span>결제수단</span><span>${cancelInfo.method === 1 ? '현금' : '카드'} (취소)</span></div>
                </div>
            </div>
            <div class="receipt-modal-actions">
              <button class="receipt-btn save-img" onclick="ReceiptEngine.saveAsImage('receipt-svg-container-modal', 'CancelReceipt')">이미지로 저장</button>
              <button class="receipt-btn print-paper" onclick="ReceiptEngine.printToPaper('receipt-svg-container-modal')">종이로 인쇄</button>
              <button class="receipt-btn close-btn" onclick="document.getElementById('${modalId}').remove()">닫기</button>
            </div>
          </div>
        </div>
      </div>
    `;
    },

    // 기존 함수 유지 (호환성용)
    generateCustomerReceipt(storeInfo, orderData, paymentInfo) {
        const text = this.generateReceiptText(storeInfo, orderData, paymentInfo);
        if (typeof receiptline !== 'undefined') {
            return `<div id="receipt-to-capture" class="receipt-line-html">${receiptline.transform(text, { cpl: this.cpl, lang: "ko" })}</div>`;
        }
        return `<pre>${text}</pre>`;
    },

    // 주방/바/프론트 전용 주문 슬립 템플릿
    generateOrderSlip(type, storeInfo, orderData) {
        const typeNames = { kitchen: '주방 주문서', bar: '바 주문서', front: '요청 확인서' };
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ko-KR');

        let text = `
^{B: ${typeNames[type]} }
^테이블: ${orderData.tableName}
---
주문시간: | ${timeStr}
---
{B: 메뉴/요청항목} | {B: 수량}
`;
        orderData.items.forEach(item => {
            text += `{B: ${item.name}} | {B: ${item.count}} \n`;
            if (item.options) {
                item.options.forEach(opt => {
                    text += ` - ${opt.name} | ${opt.count || 1} \n`;
                });
            }
        });

        text += `---
^^ ${timeStr} 출력됨
`;

        if (typeof receiptline !== 'undefined') {
            return `<div id="slip-to-capture" class="receipt-container slip ${type}">${receiptline.transform(text, { cpl: this.cpl, lang: "ko" })}</div>`;
        }
        return `<pre>${text}</pre>`;
    },

    // ─── 시리얼 프린터(ESC/POS) 영수증 라인 생성 ───────────────────────────────

    /** ISO 날짜 문자열 → 'YYYY-MM-DD HH:MM:SS' 형식 */
    _fmtDateStr(iso) {
        try {
            const d = new Date(iso);
            if (isNaN(d)) return String(iso);
            const pad = n => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
                   `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        } catch(e) { return String(iso); }
    },

    /**
     * 카드번호 포맷: 앞 4자리 + ****-**** + 뒤 4자리
     * 이미 '-'나 '*'가 포함된 형식이면 그대로 반환
     */
    _formatCardNumber(num) {
        if (!num) return null;
        const s = String(num).trim();
        if (s.includes('*')) return s;  // 이미 마스킹된 형식이면 그대로
        const digits = s.replace(/\D/g, '');
        if (digits.length >= 8) {
            return digits.slice(0, 4) + '-****-****-' + digits.slice(-4);
        }
        return s;
    },

    /**
     * 프린터 시각적 폭 계산: ASCII=1, 한글/다바이트=2
     */
    _vw(str) {
        let w = 0;
        for (const ch of String(str)) {
            w += ch.charCodeAt(0) > 0x7F ? 2 : 1;
        }
        return w;
    },
    _rpad(str, width) {
        str = String(str);
        const vw = this._vw(str);
        return vw >= width ? str : str + ' '.repeat(width - vw);
    },
    _rjust(str, width) {
        str = String(str);
        const vw = this._vw(str);
        return vw >= width ? str : ' '.repeat(width - vw) + str;
    },
    _twoCol(left, right, width) {
        left = String(left);
        right = String(right);
        const gap = width - this._vw(left) - this._vw(right);
        return gap > 0 ? left + ' '.repeat(gap) + right : left + ' ' + right;
    },
    _center(str, width) {
        str = String(str);
        const vw = this._vw(str);
        if (vw >= width) return str;
        const pad = Math.floor((width - vw) / 2);
        return ' '.repeat(pad) + str;
    },

    /**
     * 개별 결제 영수증 라인 배열 생성 (32자 폭)
     * @param {object} storeInfo  - { name, business_number, representative_name, address, tel }
     * @param {object} orderData  - { tableName, items: [{name, price, count, options}] }
     * @param {object} paymentInfo - {
     *   receiptId,       // 영수증 번호 (payment.id)
     *   price,           // 결제 금액
     *   method,          // 1=현금, 2=카드
     *   discount,        // 할인금액 (optional)
     *   extra_charge,    // 추가금액 (optional)
     *   datetimeStr,     // 거래일시 문자열 "YYYY-MM-DD HH:MM:SS"
     *   approvalNo,      // 카드 승인번호 (optional)
     *   cardNumber,      // 카드번호 마스킹 (optional)
     * }
     */
    generateSerialReceiptLines(storeInfo, orderData, paymentInfo) {
        const W = 42;
        const SEP = '='.repeat(W);
        const SEP2 = '-'.repeat(W);
        const lines = [];

        const fmt = (n) => Number(n || 0).toLocaleString();
        const price = paymentInfo.price || 0;
        const discount = paymentInfo.discount || 0;
        const extra = paymentInfo.extra_charge || 0;
        const orderTotal = price + discount - extra;
        const vat = Math.round(price / 11);
        const supply = price - vat;

        // 헤더
        lines.push(SEP);
        lines.push(this._center(storeInfo.name || 'Order & Go', W));
        lines.push(this._center('영  수  증', W));
        lines.push(SEP);

        // 매장 정보 (법적 필수)
        lines.push('사업자번호: ' + (storeInfo.business_number || '000-00-00000'));
        lines.push('대 표 자:   ' + (storeInfo.representative_name || '-'));
        lines.push('주    소:   ' + (storeInfo.address || '-').replace(' | ', ' '));
        lines.push('전화번호:   ' + (storeInfo.tel || '-'));
        lines.push(SEP);

        // 거래 정보
        lines.push('영수증번호: PMT-' + (paymentInfo.receiptId || '-'));
        lines.push('거래일시:   ' + (paymentInfo.datetimeStr || '-'));
        lines.push('테이블:     ' + (orderData.tableName || '-'));
        lines.push(SEP);

        // 품목 (법적 필수)
        lines.push(this._twoCol('품목', '수량   금액', W));
        lines.push(SEP2);
        (orderData.items || []).forEach(item => {
            const itemTotal = (item.price || 0) * (item.count || 1);
            lines.push(this._twoCol(
                item.name.slice(0, 16),
                'x' + item.count + '  ' + this._rjust(fmt(itemTotal), 7),
                W
            ));
            (item.options || []).forEach(opt => {
                const optTotal = (opt.price || 0) * (opt.count || 1);
                lines.push(this._twoCol(
                    ' -' + opt.name.slice(0, 14),
                    'x' + (opt.count || 1) + '  ' + this._rjust(fmt(optTotal), 7),
                    W
                ));
            });
        });
        lines.push(SEP2);

        // 금액 소계
        lines.push(this._twoCol('주문금액:', fmt(orderTotal) + '원', W));
        if (discount > 0) lines.push(this._twoCol('할인금액:', '-' + fmt(discount) + '원', W));
        if (extra > 0)    lines.push(this._twoCol('추가금액:', '+' + fmt(extra) + '원', W));
        lines.push(SEP);

        // 세금 (법적 필수)
        lines.push(this._twoCol('공 급 가 액:', fmt(supply) + '원', W));
        lines.push(this._twoCol('부가가치세(10%):', fmt(vat) + '원', W));
        lines.push(SEP);

        // 합계 (법적 필수)
        lines.push(this._twoCol('합 계 금 액:', fmt(price) + '원', W));
        lines.push(SEP);

        // 결제 수단 (법적 필수)
        const methodName = paymentInfo.method === 1 ? '현금' : '카드';
        lines.push(this._twoCol('결 제 수 단:', methodName, W));
        if (paymentInfo.method !== 1) {
            if (paymentInfo.approvalNo)  lines.push(this._twoCol('승 인 번 호:', paymentInfo.approvalNo, W));
            if (paymentInfo.cardNumber)  lines.push(this._twoCol('카 드 번 호:', paymentInfo.cardNumber, W));
        }
        lines.push(SEP);

        // 푸터
        if (storeInfo.receipt_footer) {
            lines.push(storeInfo.receipt_footer);
        } else {
            lines.push(this._center('이용해 주셔서 감사합니다.', W));
            lines.push(this._center('Order & Go POS', W));
        }
        lines.push(SEP);

        return lines;
    },

    /**
     * 통합 영수증 라인 배열 생성 — 전체 주문 + 모든 결제 내역 포함
     * @param {object} storeInfo
     * @param {object} orderData  - { tableName, items }
     * @param {object[]} allPayments - payment 배열 (status 1=완료, 2=취소)
     * @param {object} meta - {
     *   tplId,          // TablePaymentList ID (영수증번호)
     *   datetimeStr,    // 거래일시
     *   discount,
     *   extra_charge,
     *   totalPaid,
     *   totalCancelled,
     * }
     */
    generateIntegratedSerialReceiptLines(storeInfo, orderData, allPayments, meta) {
        const W = 42;
        const SEP = '='.repeat(W);
        const SEP2 = '-'.repeat(W);
        const lines = [];

        const fmt = (n) => Number(n || 0).toLocaleString();
        const discount = meta.discount || 0;
        const extra = meta.extra_charge || 0;
        const totalPaid = meta.totalPaid || 0;
        const vatBase = totalPaid > 0 ? totalPaid : (meta.totalCancelled || 0);
        const vat = Math.round(vatBase / 11);
        const supply = vatBase - vat;

        // 주문 소계 (메뉴 합계 + 할인 역산)
        const itemsTotal = (orderData.items || []).reduce((s, i) => s + (i.price || 0) * (i.count || 1), 0);

        // 헤더
        lines.push(SEP);
        lines.push(this._center('통  합  영  수  증', W));
        lines.push(SEP);

        // 매장 정보 (법적 필수)
        lines.push('사업자번호: ' + (storeInfo.business_number || '000-00-00000'));
        lines.push('대 표 자:   ' + (storeInfo.representative_name || '-'));
        lines.push('주    소:   ' + (storeInfo.address || '-').replace(' | ', ' '));
        lines.push('전화번호:   ' + (storeInfo.tel || '-'));
        lines.push(SEP);

        // 거래 정보
        lines.push('영수증번호: ORD-' + (meta.tplId || '-'));
        lines.push('거래일시:   ' + (meta.datetimeStr || '-'));
        lines.push('테이블:     ' + (orderData.tableName || '-'));
        lines.push(SEP);

        // 품목 (법적 필수)
        lines.push(this._twoCol('품목', '수량   금액', W));
        lines.push(SEP2);
        (orderData.items || []).forEach(item => {
            const itemTotal = (item.price || 0) * (item.count || 1);
            lines.push(this._twoCol(
                item.name.slice(0, 16),
                'x' + item.count + '  ' + this._rjust(fmt(itemTotal), 7),
                W
            ));
            (item.options || []).forEach(opt => {
                const optTotal = (opt.price || 0) * (opt.count || 1);
                lines.push(this._twoCol(
                    ' -' + opt.name.slice(0, 14),
                    'x' + (opt.count || 1) + '  ' + this._rjust(fmt(optTotal), 7),
                    W
                ));
            });
        });
        lines.push(SEP2);
        lines.push(this._twoCol('주문금액:', fmt(itemsTotal) + '원', W));
        if (discount > 0) lines.push(this._twoCol('할인금액:', '-' + fmt(discount) + '원', W));
        if (extra > 0)    lines.push(this._twoCol('추가금액:', '+' + fmt(extra) + '원', W));
        lines.push(SEP);

        // 결제 내역
        lines.push('[ 결 제 내 역 ]');
        lines.push(SEP2);
        (allPayments || []).forEach((p, idx) => {
            const isCancelled = p.status === 2;
            const methodName = (p.method || '').includes('현금') ? '현금' : '카드';
            const label = (idx + 1) + '. ' + methodName + (isCancelled ? '(취소)' : '');
            lines.push(this._twoCol(label, fmt(p.amount) + '원', W));
            // 영수증번호 / 카드 승인번호 / 카드번호
            if (p.id) lines.push('   영수증번호: PMT-' + p.id);
            const pi = p.payment_info || {};
            if (pi.toss_approval_no) lines.push('   승인번호: ' + pi.toss_approval_no);
            const cardNum = pi.toss_details?.card?.maskedCardNumber;
            if (cardNum) lines.push('   카드번호: ' + this._formatCardNumber(cardNum));
        });
        lines.push(SEP2);

        // 세금 (법적 필수) - 실 결제 합계 기준
        lines.push(this._twoCol('공 급 가 액:', fmt(supply) + '원', W));
        lines.push(this._twoCol('부가가치세(10%):', fmt(vat) + '원', W));
        lines.push(SEP);

        // 합계
        lines.push(this._twoCol('합 계 결제금액:', fmt(totalPaid) + '원', W));
        if (meta.totalCancelled > 0) {
            lines.push(this._twoCol('취 소 금 액:', '-' + fmt(meta.totalCancelled) + '원', W));
        }
        lines.push(SEP);

        // 푸터
        if (storeInfo.receipt_footer) {
            lines.push(storeInfo.receipt_footer);
        } else {
            lines.push(this._center('이용해 주셔서 감사합니다.', W));
        }
        lines.push(SEP);

        return lines;
    },

    /**
     * 취소 영수증 라인 배열 생성
     * @param {object} storeInfo
     * @param {object} orderData  - { tableName, items }
     * @param {object} cancelInfo - {
     *   receiptId,      // payment.id
     *   price,          // 취소 금액
     *   method,         // 1=현금, 2=카드
     *   cancelledAt,    // 취소 일시 문자열
     *   approvalNo,     // 원 승인번호 (optional)
     *   datetimeStr,    // 원 거래일시
     * }
     */
    generateSerialCancelReceiptLines(storeInfo, orderData, cancelInfo) {
        const W = 42;
        const SEP = '='.repeat(W);
        const SEP2 = '-'.repeat(W);
        const lines = [];

        const fmt = (n) => Number(n || 0).toLocaleString();
        const price = cancelInfo.price || 0;
        const vat = Math.round(price / 11);
        const supply = price - vat;
        const cancelledAt = cancelInfo.cancelledAt
            ? this._fmtDateStr(cancelInfo.cancelledAt)
            : this._fmtDateStr(new Date());

        // 헤더
        lines.push(SEP);
        lines.push(this._center(storeInfo.name || 'Order & Go', W));
        lines.push(this._center('취  소  영  수  증', W));
        lines.push(SEP);

        // 매장 정보 (법적 필수)
        lines.push('사업자번호: ' + (storeInfo.business_number || '000-00-00000'));
        lines.push('대 표 자:   ' + (storeInfo.representative_name || '-'));
        lines.push('주    소:   ' + (storeInfo.address || '-').replace(' | ', ' '));
        lines.push('전화번호:   ' + (storeInfo.tel || '-'));
        lines.push(SEP);

        // 거래 정보
        lines.push('영수증번호: PMT-' + (cancelInfo.receiptId || '-'));
        lines.push('원거래일시: ' + (cancelInfo.datetimeStr || '-'));
        lines.push('취소일시:   ' + cancelledAt);
        lines.push('테이블:     ' + (orderData.tableName || '-'));
        lines.push(SEP);

        // 취소 품목
        lines.push(this._twoCol('품목', '수량   금액', W));
        lines.push(SEP2);
        (orderData.items || []).forEach(item => {
            const itemTotal = (item.price || 0) * (item.count || 1);
            lines.push(this._twoCol(
                item.name.slice(0, 16),
                'x' + item.count + '  ' + this._rjust(fmt(itemTotal), 7),
                W
            ));
            (item.options || []).forEach(opt => {
                const optTotal = (opt.price || 0) * (opt.count || 1);
                lines.push(this._twoCol(
                    ' -' + opt.name.slice(0, 14),
                    'x' + (opt.count || 1) + '  ' + this._rjust(fmt(optTotal), 7),
                    W
                ));
            });
        });
        lines.push(SEP2);

        // 세금 (법적 필수)
        lines.push(this._twoCol('공 급 가 액:', fmt(supply) + '원', W));
        lines.push(this._twoCol('부가가치세(10%):', fmt(vat) + '원', W));
        lines.push(SEP);

        // 취소 합계
        lines.push(this._twoCol('취 소 금 액:', fmt(price) + '원', W));
        lines.push(SEP);

        // 결제 수단
        const methodName = cancelInfo.method === 1 ? '현금' : '카드';
        lines.push(this._twoCol('결 제 수 단:', methodName + ' (취소)', W));
        if (cancelInfo.approvalNo) lines.push(this._twoCol('원 승인번호:', cancelInfo.approvalNo, W));
        if (cancelInfo.cardNumber) lines.push(this._twoCol('카 드 번 호:', cancelInfo.cardNumber, W));
        lines.push(SEP);

        // 푸터
        if (storeInfo.receipt_footer) {
            lines.push(storeInfo.receipt_footer);
        } else {
            lines.push(this._center('이용해 주셔서 감사합니다.', W));
            lines.push(this._center('Order & Go POS', W));
        }
        lines.push(SEP);

        return lines;
    },

    // HTML을 이미지로 변환하여 다운로드/전송하는 기능
    async saveAsImage(elementId, fileName) {
        if (typeof htmlToImage === 'undefined') {
            alert('이미지 라이브러리(html-to-image)가 로드되지 않았습니다.');
            return;
        }

        const node = document.getElementById(elementId);
        if (!node) {
            alert('대상 요소를 찾을 수 없습니다: ' + elementId);
            return;
        }

        // 보안 오류 유발 외부 스타일시트 일시 비활성화
        const disabledSheets = [];
        Array.from(document.styleSheets).forEach(sheet => {
            try {
                const rules = sheet.cssRules;
            } catch (e) {
                if (!sheet.disabled) {
                    sheet.disabled = true;
                    disabledSheets.push(sheet);
                }
            }
        });

        try {
            const options = {
                backgroundColor: '#ffffff',
                style: { padding: '20px', margin: '0' },
                cacheBust: true,
                pixelRatio: 2,
                // [핵심] 외부 리소스 로딩 필터: 보안 오류(CORS) 방지
                filter: (domNode) => {
                    // 외부 CDN 스타일시트(LINK 태그)는 캡처 시 무시
                    if (domNode.tagName === 'LINK' && domNode.rel === 'stylesheet') {
                        const href = domNode.href || '';
                        const isExternal = href.includes('http') && !href.includes(window.location.host);
                        if (isExternal) return false;
                    }
                    return true;
                }
            };

            const dataUrl = await htmlToImage.toPng(node, options);

            // 스타일 원복
            disabledSheets.forEach(sheet => sheet.disabled = false);

            if (!dataUrl || dataUrl.length < 500) {
                throw new Error('이미지 데이터가 생성되지 않았습니다.');
            }

            // 다운로드 처리 (최대한 직접적인 기법 사용)
            const link = document.createElement('a');
            const timestamp = new Date().getTime();
            const fullName = `${fileName}_${timestamp}.png`;

            link.setAttribute('href', dataUrl);
            link.setAttribute('download', fullName);
            link.style.display = 'none';
            document.body.appendChild(link);

            link.click();

            setTimeout(() => {
                document.body.removeChild(link);
            }, 500);

            return dataUrl;
        } catch (error) {
            disabledSheets.forEach(sheet => sheet.disabled = false);
            console.error('Image Capture Error:', error);
            alert('이미지 저장 중 오류가 발생했습니다: ' + error.message);
        }
    }
};
