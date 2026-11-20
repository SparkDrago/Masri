/* Microsoft Azure Speech — Egyptian Arabic neural voices.
   Shared by /api/tts (live) and data-src/build_audio.js (pre-generated files).
   Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (e.g. "westeurope"). */
'use strict';

const VOICES = { f: 'ar-EG-SalmaNeural', m: 'ar-EG-ShakirNeural' };
const RATE = '-10%'; // the browser plays files at rate/0.85, so this is the "normal" learner speed

const configured = () => !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
const xml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

// Only Arabic letters/marks, digits, spaces and ordinary punctuation may be spoken.
const ALLOWED = /^[؀-ۿݐ-ݿࢠ-ࣿ‌‍0-9\s.,!?'"()\-:;«»…]+$/;
function validText(t) {
  t = String(t || '').replace(/\s+/g, ' ').trim();
  const bare = t.replace(/[ً-ْٰـ]/g, ''); // vowel marks don't count
  if (!t || bare.length > 300 || t.length > 800 ||!/[؀-ۿ]/.test(t) || !ALLOWED.test(t)) return '';
  return t;
}

function ssml(text, voice) {
  return `<speak version='1.0' xml:lang='ar-EG'><voice xml:lang='ar-EG' name='${VOICES[voice] || VOICES.f}'><prosody rate='${RATE}'>${xml(text)}</prosody></voice></speak>`;
}

async function synth(text, voice, timeoutMs) {
  const region = String(process.env.AZURE_SPEECH_REGION || '').trim().toLowerCase();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
  try {
    const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'masri-course'
      },
      body: ssml(text, voice)
    });
    if (!r.ok) { const e = new Error('Azure ' + r.status); e.status = r.status; throw e; }
    return Buffer.from(await r.arrayBuffer());
  } finally { clearTimeout(timer); }
}

module.exports = { VOICES, RATE, configured, validText, ssml, synth };
