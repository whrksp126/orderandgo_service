// 접속 기기 구분 + 휴대폰 접속 안내
// POS · 테이블오더 · 주문 접수 · 매장 관리 화면은 태블릿/PC 기준이라, 휴대폰으로 열면 안내를 띄운다.
(function () {
  // 'mobile' | 'tablet' | 'pc'
  function deviceType() {
    var ua = navigator.userAgent || '';
    var uaData = navigator.userAgentData;
    // iPadOS 13+ 는 Mac 으로 표시되므로 터치 지원 여부로 구분
    var isIpad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIpad) return 'tablet';
    if (/iPhone|iPod/.test(ua)) return 'mobile';
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'mobile' : 'tablet';
    if (uaData && uaData.mobile) return 'mobile';
    if (/Mobi|Windows Phone/.test(ua)) return 'mobile';
    if (/Tablet|Silk|Kindle|PlayBook/.test(ua)) return 'tablet';
    return 'pc';
  }
  window.ogDeviceType = deviceType;

  var KEY = 'og_device_notice_closed';
  function show() {
    if (deviceType() !== 'mobile') return;
    try { if (sessionStorage.getItem(KEY)) return; } catch (e) {}
    if (document.getElementById('ogDeviceNotice')) return;

    var bar = document.createElement('div');
    bar.id = 'ogDeviceNotice';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;align-items:center;gap:12px;' +
      'padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #ccc;' +
      'box-shadow:0 -4px 16px rgba(0,0,0,.08);font-size:14px;line-height:1.5;color:#333;word-break:keep-all;';
    var text = document.createElement('p');
    text.style.cssText = 'flex:1 1 0;min-width:0;margin:0;';
    text.textContent = '이 화면은 태블릿·PC에 맞춰져 있어요. 태블릿이나 PC로 접속하거나, 브라우저 메뉴에서 ‘데스크톱 사이트’를 켜 주세요.';
    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = '닫기';
    close.style.cssText = 'flex:0 0 auto;padding:8px 14px;border:1px solid #ccc;border-radius:5px;background:#fff;font-size:14px;font-weight:600;color:#333;cursor:pointer;';
    close.addEventListener('click', function () {
      try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
      bar.remove();
    });
    bar.appendChild(text);
    bar.appendChild(close);
    document.body.appendChild(bar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
