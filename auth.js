/* OVO — utilidades de autenticación (sin dependencias externas, probables por separado) */
'use strict';
const crypto = require('crypto');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return salt.toString('hex') + ':' + h.toString('hex');
}
function checkPassword(pw, stored) {
  if (typeof pw !== 'string' || typeof stored !== 'string') return false;
  const [s, h] = stored.split(':');
  if (!s || !h) return false;
  const calc = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64);
  const exp = Buffer.from(h, 'hex');
  return calc.length === exp.length && crypto.timingSafeEqual(calc, exp);
}
const DUMMY = hashPassword('dummy-para-igualar-tiempos');

function b64u(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function makeSigner(secret) {
  const mac = data => b64u(crypto.createHmac('sha256', secret).update(data).digest());
  return {
    sign(payload) { const d = b64u(Buffer.from(JSON.stringify(payload))); return d + '.' + mac(d); },
    verify(token) {
      if (!token || typeof token !== 'string') return null;
      const i = token.lastIndexOf('.'); if (i < 0) return null;
      const d = token.slice(0, i), a = Buffer.from(token.slice(i + 1)), b = Buffer.from(mac(d));
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
      try { return JSON.parse(Buffer.from(d, 'base64').toString()); } catch (e) { return null; }
    }
  };
}
/* huella de la contraseña: si cambia, las sesiones anteriores dejan de valer */
const passStamp = stored => crypto.createHash('sha256').update(String(stored)).digest('hex').slice(0, 16);

/* límite de intentos fallidos por IP + usuario */
function makeLimiter(max, windowMs) {
  const m = new Map();
  return {
    blocked(key) { const e = m.get(key); if (!e) return false; if (Date.now() - e.t > windowMs) { m.delete(key); return false; } return e.n >= max; },
    fail(key) { const e = m.get(key); if (!e || Date.now() - e.t > windowMs) m.set(key, {n: 1, t: Date.now()}); else e.n++; },
    clear(key) { m.delete(key); }
  };
}
module.exports = {hashPassword, checkPassword, DUMMY, makeSigner, passStamp, makeLimiter};
