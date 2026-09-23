// @ts-nocheck
import { state } from '@/core/state';
import { markPresent } from '@/features/attendance/attendance';

// ===== QR SCANNER =====
async function getCameraStream() {
  // Try back camera first, then front, then any camera
  const constraints = [
    { video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
    { video: { facingMode: 'user' } },
    { video: true },
  ];
  let lastErr;
  for (const c of constraints) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch(e) { lastErr = e; }
  }
  throw lastErr;
}

function startQRDecode(video) {
  if ('BarcodeDetector' in window) {
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    state.scanInterval = setInterval(async () => {
      if (!state.scanning || video.readyState < 2) return;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      try {
        const codes = await detector.detect(canvas);
        if (codes.length > 0) handleQR(codes[0].rawValue);
      } catch {}
    }, 400);
  } else {
    const loadJsQR = () => new Promise((res, rej) => {
      if (window.jsQR) return res();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    loadJsQR().then(() => {
      const canvas = document.createElement('canvas');
      const ctx    = canvas.getContext('2d');
      state.scanInterval = setInterval(() => {
        if (!state.scanning || video.readyState < 2) return;
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height);
        if (code) handleQR(code.data);
      }, 350);
    }).catch(() => showToast('تعذّر تحميل مكتبة QR', 'error'));
  }
}

window.startScan = async () => {
  if (state.scanning) return;

  // Check if getUserMedia is supported at all
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('المتصفح ده مش بيدعم الكاميرا — جرّب Chrome أو Safari', 'error');
    return;
  }

  try {
    // Request permission explicitly first (helps on iOS)
    if (navigator.permissions) {
      try { await navigator.permissions.query({ name: 'camera' }); } catch {}
    }
    state.stream = await getCameraStream();
    const video = document.getElementById('scanner-video');
    video.srcObject = state.stream;
    video.setAttribute('playsinline', true);
    video.setAttribute('muted', true);

    await new Promise((res) => {
      video.onloadedmetadata = res;
      setTimeout(res, 4000);
    });
    await video.play().catch(e => console.warn('play error:', e));

    document.getElementById('scan-toggle-btn').style.display = 'none';
    document.getElementById('scan-zone').style.display = 'block';
    state.scanning = true;

    startQRDecode(video);

  } catch(e) {
    // Give specific Arabic error messages
    let msg = 'تعذّر فتح الكاميرا';
    if (e && e.name) {
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')
        msg = '🔒 اسمح للتطبيق بالوصول للكاميرا من إعدادات المتصفح';
      else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError')
        msg = '📷 مفيش كاميرا متاحة على الجهاز';
      else if (e.name === 'NotReadableError' || e.name === 'TrackStartError')
        msg = '⚠️ الكاميرا بتُستخدم في تطبيق تاني — قفّله وحاول تاني';
      else if (e.name === 'OverconstrainedError')
        msg = '⚠️ الكاميرا المطلوبة مش متاحة';
      else if (e.name === 'TypeError')
        msg = '🔒 الصفحة محتاجة HTTPS عشان تفتح الكاميرا';
    }
    showToast(msg, 'error');
    console.error('Camera error:', e);
  }
};

window.stopScan = () => {
  state.scanning = false;
  clearInterval(state.scanInterval);
  if (state.stream) { state.stream.getTracks().forEach(t => t.stop()); state.stream = null; }
  document.getElementById('scan-zone').style.display = 'none';
  document.getElementById('scan-toggle-btn').style.display = 'block';
};

let lastScanned = null, lastScannedTime = 0, scanPaused = false;

async function handleQR(value) {
  if (scanPaused) return;
  const now = Date.now();
  if (value === lastScanned && now - lastScannedTime < 1500) return;
  lastScanned = value; lastScannedTime = now;
  const student = state.allStudents.find(s => s.id === value);
  if (!student) { showToast('QR غير معروف', 'error'); return; }
  if (state.todayAttendance[student.id]) { showToast(`${student.name} — مسجّل مسبقاً ✓`, 'info'); return; }
  // Pause scanning for 1.5s after successful registration
  scanPaused = true;
  const ok = await markPresent(student.id);
  if (ok) {
    showToast(`✅ ${student.name} — تم التسجيل`, 'success');
    navigator.vibrate && navigator.vibrate([60,30,60]);
  }
  setTimeout(() => {
    scanPaused = false;
    lastScanned = null;
  }, 1500);
}
