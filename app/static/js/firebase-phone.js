// 공용 Firebase 전화 인증 모듈 — window.FIREBASE_CONFIG 를 읽어 window.ogFirebasePhone 노출
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
auth.languageCode = 'ko';

let confirmationResult = null;
let recaptcha = null;
function toE164(tel) { return '+82' + String(tel).replace(/\D/g, '').replace(/^0/, ''); }

window.ogFirebasePhone = {
  sendCode: async function (tel) {
    if (!recaptcha) {
      recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      await recaptcha.render();
    }
    confirmationResult = await signInWithPhoneNumber(auth, toE164(tel), recaptcha);
    return true;
  },
  confirmCode: async function (code) {
    if (!confirmationResult) throw new Error('인증번호를 먼저 받아주세요');
    const cred = await confirmationResult.confirm(code);
    return await cred.user.getIdToken();
  }
};
