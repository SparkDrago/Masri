/* /api/tts — Egyptian Arabic speech (Azure ar-EG neural voices).
   GET ?probe=1          → { ok } : is Azure configured?
   GET ?t=<text>&v=f|m   → audio/mpeg  (cached by Vercel's CDN for a year, so each text is paid for once)
   Works without the database; when Supabase is connected it also rate-limits per IP and per day. */
'use strict';
const C = require('./_lib/core');
const T = require('./_lib/tts');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') throw new C.HttpError(405, 'Method not allowed');
    const q = C.query(req);
    if (q.probe) return C.send(res, 200, { ok: T.configured(), voices: Object.keys(T.VOICES) });
    if (!T.configured()) throw new C.HttpError(503, 'Египетче үн туташкан эмес: Vercel’ге AZURE_SPEECH_KEY жана AZURE_SPEECH_REGION кошуңуз (README’ни караңыз).');
    // Only this site may use the voice (browsers mark cross-site requests).
    if (req.headers['sec-fetch-site'] === 'cross-site') throw new C.HttpError(403, 'Forbidden');
    const text = T.validText(q.t);
    if (!text) throw new C.HttpError(400, 'Текст туура эмес (арабча, 300 белгиге чейин).');
    const voice = q.v === 'm' ? 'm' : 'f';

    try {
      await C.limit('tts:' + C.ip(req), 300, 3600);
      await C.limit('tts:day', Number(process.env.TTS_MAX_PER_DAY) || 3000, 86400);
    } catch (e) { if (e.status === 429) throw e; /* no database: skip the limits */ }

    let audio;
    try { audio = await T.synth(text, voice); } catch (e) {
      if (e.status === 401 || e.status === 403) { console.error('Azure key/region rejected'); throw new C.HttpError(503, 'Azure ачкычы же аймагы кабыл алынган жок.'); }
      if (e.status === 429) throw new C.HttpError(429, 'Үн кызматы азыр бош эмес — бир аздан кийин кайра басыңыз.');
      console.error('Azure TTS failed', e.status || e.name);
      throw new C.HttpError(502, 'Үн кызматына туташуу мүмкүн болгон жок.');
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audio.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(audio);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    C.send(res, status, { error: e.status ? e.message : 'Сервер катасы' });
  }
};
