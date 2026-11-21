/* Site settings.
   synthesizedVoices: false (default) — learners hear ONLY real recordings from /audio. Text that has no
   recording yet shows its transcription and no play button. Set to true to also allow the synthesized
   voices (Azure /api/tts, the browser's Egyptian voice, and — if a learner opts in — Fusha voices). */
window.MASRI_CONFIG = window.MASRI_CONFIG || {
  synthesizedVoices: false
};
