// push-worker.js — Cloudflare Worker (مجاني)
// بيبعت Push notification لمسؤولي الخدمة أول ما خادم جديد يطلب تسجيل.
//
// الإعدادات (Workers → Settings → Variables and Secrets):
//   SERVICE_ACCOUNT  (Secret)  محتوى ملف الـ JSON بتاع Firebase service account كامل
//   ALLOWED_ORIGIN   (Text)    origin موقعك بس، مثال: https://username.github.io  (من غير مسار ولا / في الآخر)
//   APP_URL          (Text)    رابط التطبيق اللي هيفتح لما تدوس على الإشعار
//
// الأمان:
//  - الـ Worker بيتحقق من Firebase ID token بتاع الخادم الجديد (توقيع + aud + iss + exp) قبل أي حاجة.
//  - نص الإشعار بيتبني من بيانات Firestore الحقيقية، مش من أي حاجة الموقع بيبعتها.
//  - بيبعت بس لو المستخدم ده role=deacon و status=pending، ومرة واحدة لكل طلب (pushNotifiedAt).

const enc = new TextEncoder();

const b64uToBytes = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};
const bytesToB64u = (buf) => {
  let s = '';
  new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const strToB64u = (str) => bytesToB64u(enc.encode(str));
const b64uToJson = (s) => JSON.parse(new TextDecoder().decode(b64uToBytes(s)));

const json = (obj, status, headers) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });

// ---------- Google OAuth (service account → access token) ----------
let cachedToken = null;
async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const header = strToB64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = strToB64u(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey(
    'pkcs8', b64uToBytes(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${header}.${claim}`));

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${bytesToB64u(sig)}`,
    }),
  });
  if (!r.ok) throw new Error(`oauth failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  cachedToken = { value: j.access_token, exp: now + (j.expires_in || 3600) };
  return cachedToken.value;
}

// ---------- Firebase ID token verification ----------
async function verifyIdToken(idToken, projectId) {
  const parts = (idToken || '').split('.');
  if (parts.length !== 3) throw new Error('bad token');
  const header = b64uToJson(parts[0]);
  const payload = b64uToJson(parts[1]);
  if (header.alg !== 'RS256') throw new Error('bad alg');

  const jwksRes = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
    { cf: { cacheTtl: 3600, cacheEverything: true } });
  const jwk = (await jwksRes.json()).keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('unknown key');

  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64uToBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));

  const now = Math.floor(Date.now() / 1000);
  if (!ok || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`
      || payload.exp < now || !payload.sub) throw new Error('invalid token');
  return payload;
}

// ---------- Firestore REST helpers ----------
const fsBase = (pid) => `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents`;
function fv(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fv);
  if ('mapValue' in v) return fvFields(v.mapValue.fields);
  return null;
}
const fvFields = (f = {}) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, fv(v)]));

// مين يستلم الإشعار: الأدمن دايمًا + مسؤول سنة/مرحلة الفصل بتاع الخادم الجديد
function shouldNotify(user, grade) {
  if (user.role === 'admin') return true;
  if (!user.isLead && !user.isPhaseLead) return false;
  const phase = Array.isArray(user.phaseGrades)
    ? user.phaseGrades
    : String(user.phaseGrades || '').split(/[;,]/).map((x) => x.trim());
  return user.grade === grade || phase.includes(grade);
}

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed || '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/new-deacon') return json({ error: 'not found' }, 404, cors);
    if (allowed && request.headers.get('Origin') !== allowed) return json({ error: 'forbidden' }, 403, cors);

    try {
      const sa = JSON.parse(env.SERVICE_ACCOUNT);
      const pid = sa.project_id;

      const bearer = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const { sub: uid } = await verifyIdToken(bearer, pid);

      const at = await getAccessToken(sa);
      const authH = { Authorization: `Bearer ${at}` };
      const jsonH = { ...authH, 'Content-Type': 'application/json' };

      // 1) بيانات الخادم الجديد من Firestore
      const dr = await fetch(`${fsBase(pid)}/users/${uid}`, { headers: authH });
      if (!dr.ok) return json({ error: 'no user doc' }, 404, cors);
      const nu = fvFields((await dr.json()).fields);
      if (nu.role !== 'deacon' || nu.status !== 'pending') return json({ skipped: 'not pending' }, 200, cors);
      if (nu.pushNotifiedAt) return json({ skipped: 'already notified' }, 200, cors);

      // علّم الطلب إنه اتبعتله إشعار (منع التكرار/السبام)
      await fetch(`${fsBase(pid)}/users/${uid}?updateMask.fieldPaths=pushNotifiedAt`, {
        method: 'PATCH',
        headers: jsonH,
        body: JSON.stringify({ fields: { pushNotifiedAt: { timestampValue: new Date().toISOString() } } }),
      });

      // 2) المستلمين (المعتمدين بس)
      const qr = await fetch(`${fsBase(pid)}:runQuery`, {
        method: 'POST',
        headers: jsonH,
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'users' }],
            where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'approved' } } },
          },
        }),
      });
      const rows = await qr.json();
      const tokens = [...new Set(
        (Array.isArray(rows) ? rows : [])
          .filter((r) => r.document)
          .map((r) => fvFields(r.document.fields))
          .filter((u) => shouldNotify(u, nu.grade))
          .flatMap((u) => (Array.isArray(u.fcmTokens) ? u.fcmTokens : []))
      )];

      // 3) ابعت الـ Push (data-only، والـ Service Worker هو اللي بيعرض الإشعار)
      const title = '🙋 طلب تسجيل خادم جديد';
      const body = `${nu.name || 'خادم جديد'}${nu.grade ? ' — ' + nu.grade : ''}`;
      const results = await Promise.allSettled(tokens.map((t) =>
        fetch(`https://fcm.googleapis.com/v1/projects/${pid}/messages:send`, {
          method: 'POST',
          headers: jsonH,
          body: JSON.stringify({
            message: {
              token: t,
              data: { title, body, url: env.APP_URL || '', tag: `new-deacon-${uid}` },
              webpush: { headers: { Urgency: 'high', TTL: '86400' } },
            },
          }),
        }).then((r) => r.status)));

      const sent = results.filter((r) => r.status === 'fulfilled' && r.value === 200).length;
      return json({ ok: true, sent, total: tokens.length }, 200, cors);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 401, cors);
    }
  },
};
