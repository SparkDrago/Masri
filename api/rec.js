/* /api/rec — recordings from the studio (#record) go live without a redeploy.
     GET                      → { base, files: "id/time.ext …" }  public list of uploaded recordings
     GET ?check=1             → { ok }   is the recorder key right? (header X-Rec-Key)
     POST (audio bytes)       → upload one take. Headers: X-Rec-Key, X-Rec-Id, X-Rec-Voice,
                                X-Rec-Text (encodeURIComponent of the sentence key), X-Rec-Type (mime)
     POST ?flag=1 {key, fix, off} → the speaker says a sentence is written wrongly
   Only someone with the recorder key (Vercel env RECORDER_KEY) can upload. The audio is stored in
   Supabase Storage (public bucket "audio"); the table mz_audio says which file is current. */
'use strict';
const crypto = require('crypto');
const C = require('./_lib/core');

const SB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'audio';
const MAX = 4 * 1024 * 1024;
const EXT = { 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' };

function checkKey(req) {
  const want = process.env.RECORDER_KEY || '';
  if (!want) throw new C.HttpError(503, 'Uploading is not switched on: set RECORDER_KEY in Vercel.');
  const got = String(req.headers['x-rec-key'] || '');
  const a = crypto.createHash('sha256').update(got).digest(), b = crypto.createHash('sha256').update(want).digest();
  if (!got || !crypto.timingSafeEqual(a, b)) throw new C.HttpError(401, 'Wrong recorder key.');
}

async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = []; let size = 0;
  for await (const ch of req) { size += ch.length; if (size > MAX) throw new C.HttpError(413, 'Recording too large'); chunks.push(ch); }
  return Buffer.concat(chunks);
}

function storage(method, path, body, headers) {
  const h = { apikey: SB_KEY, ...headers };
  if (SB_KEY.startsWith('eyJ')) h.Authorization = 'Bearer ' + SB_KEY;
  return fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, { method, headers: h, body });
}

module.exports = C.handler(async (req, res, q) => {
  if (req.method === 'GET') {
    if (q.check) { checkKey(req); return C.send(res, 200, { ok: true }); }
    const list = await C.db('mz_audio_list', {});
    // short CDN cache: new takes show up for learners within about a minute
    return C.send(res, 200, { base: `${SB_URL}/storage/v1/object/public/${BUCKET}/`, files: list.files || '', count: list.count || 0 },
      { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300' });
  }
  if (req.method !== 'POST') throw new C.HttpError(405, 'Method not allowed');
  checkKey(req);

  if (q.flag) {
    const b = await C.body(req);
    const key = C.clean(b.key, 2000);
    if (!key) throw new C.HttpError(400, 'Missing sentence');
    await C.db('mz_rec_flag', { key, fix: C.clean(b.fix, 2000), off: !!b.off });
    return C.send(res, 200, { ok: true });
  }

  const id = String(req.headers['x-rec-id'] || '');
  const voice = String(req.headers['x-rec-voice'] || '');
  const type = String(req.headers['x-rec-type'] || '').split(';')[0].trim().toLowerCase();
  let key = '';
  try { key = C.clean(decodeURIComponent(String(req.headers['x-rec-text'] || '')), 2000); } catch (e) { /* bad encoding */ }
  if (!/^[0-9a-f]{16}$/.test(id) || !/^[fm]$/.test(voice) || !key) throw new C.HttpError(400, 'Missing recording details');
  if (!EXT[type]) throw new C.HttpError(400, 'Unsupported audio type');
  const data = await rawBody(req);
  if (data.length < 1000) throw new C.HttpError(400, 'Recording is empty');
  if (data.length > MAX) throw new C.HttpError(413, 'Recording too large');

  // a new path for every take, so phones and the CDN never play an old cached version
  const path = `${id}/${Date.now().toString(36)}.${EXT[type]}`;
  const r = await storage('POST', path, data, { 'Content-Type': type, 'Cache-Control': 'max-age=31536000', 'x-upsert': 'true' });
  if (!r.ok) {
    console.error('storage upload failed', r.status, (await r.text()).slice(0, 300));
    throw new C.HttpError(502, 'Could not store the recording. Try again.');
  }
  const out = await C.db('mz_audio_put', { id, voice, key, path, bytes: data.length });
  if (out && out.old && out.old !== path) storage('DELETE', out.old).catch(() => {}); // tidy up the replaced take
  C.send(res, 200, { ok: true, path });
});
