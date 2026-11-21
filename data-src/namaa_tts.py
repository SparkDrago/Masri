#!/usr/bin/env python3
"""Generate the course audio with NAMAA-Egyptian-TTS (free, MIT licence) on a GPU.

NAMAA-Egyptian-TTS (https://huggingface.co/NAMAA-Space/NAMAA-Egyptian-TTS) is an Egyptian
Arabic voice built on Chatterbox Multilingual. It runs well on the free T4 GPU of Kaggle
or Google Colab. This script reads audio/jobs.tsv (made by `node data-src/build_audio.js
--export`) and writes one MP3 per sentence, named with the same id the site looks for.

Typical use in a Kaggle / Colab notebook (GPU on, internet on):

    !pip install -q chatterbox-tts
    !python namaa_tts.py --jobs jobs.tsv --out audio --sample 15     # listen to 15 first
    !python namaa_tts.py --jobs jobs.tsv --out audio --zip           # then everything

Re-running skips files that already exist, so a dropped session just continues.
Optional: --ref voice.wav gives every sentence the voice of a 10-20 s clip of a native
speaker (get their permission). Use --voice m --ref male.wav for the male voice.
"""
import argparse, csv, os, random, shutil, subprocess, sys, tempfile, time


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--jobs', default='audio/jobs.tsv', help='audio/jobs.tsv from build_audio.js --export')
    ap.add_argument('--out', default='audio', help='folder for the MP3 files')
    ap.add_argument('--voice', default='f', help='which rows of jobs.tsv to make: f (default) or m')
    ap.add_argument('--ref', default=None, help='optional reference clip (.wav) for the voice')
    ap.add_argument('--column', default='text', choices=['text', 'text_with_vowels'],
                    help='text = plain Egyptian spelling (default; the model was trained without vowel marks)')
    ap.add_argument('--sample', type=int, default=0, help='only make N random sentences, to judge quality first')
    ap.add_argument('--limit', type=int, default=0, help='stop after N new files')
    ap.add_argument('--seed', type=int, default=1234)
    ap.add_argument('--exaggeration', type=float, default=0.5)
    ap.add_argument('--cfg', type=float, default=0.5, help='lower = slower, more careful speech')
    ap.add_argument('--temperature', type=float, default=0.7)
    ap.add_argument('--zip', action='store_true', help='zip the output folder at the end (audio.zip)')
    a = ap.parse_args()

    try:
        import torch, torchaudio as ta
        from huggingface_hub import snapshot_download
        from safetensors.torch import load_file as load_safetensors
        from chatterbox import mtl_tts
    except ImportError as e:
        sys.exit(f'Missing package ({e}). In the notebook run:  !pip install -q chatterbox-tts')

    rows = [r for r in csv.DictReader(open(a.jobs, encoding='utf-8'), delimiter='\t') if r['voice'] == a.voice]
    if not rows:
        sys.exit(f'No rows for voice "{a.voice}" in {a.jobs}. Export with --voices f,m to get both voices.')
    if a.sample:
        random.Random(a.seed).shuffle(rows)
        rows = rows[:a.sample]
    os.makedirs(a.out, exist_ok=True)
    todo = [r for r in rows if not any(os.path.exists(os.path.join(a.out, r['id'] + ext)) for ext in ('.mp3', '.wav'))]
    print(f'{len(rows)} sentences, {len(rows) - len(todo)} already done, {len(todo)} to make.')
    if a.limit:
        todo = todo[:a.limit]

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    if device == 'cpu':
        print('WARNING: no GPU found — this will be very slow. In Kaggle/Colab switch the accelerator to GPU.')
    ckpt = snapshot_download(repo_id='NAMAA-Space/NAMAA-Egyptian-TTS', repo_type='model', revision='main')
    model = mtl_tts.ChatterboxMultilingualTTS.from_pretrained(device=device)
    model.t3.load_state_dict(load_safetensors(os.path.join(ckpt, 't3_mtl23ls_v2.safetensors'), device=device))
    model.t3.to(device).eval()

    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        print('ffmpeg not found: files will be saved as .wav (larger). Colab and Kaggle have ffmpeg.')
    # trim silence at both ends, mono, 48 kbps MP3 (~6 KB per second)
    trim = 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.15'

    kw = dict(language_id='ar', exaggeration=a.exaggeration, cfg_weight=a.cfg, temperature=a.temperature)
    if a.ref:
        kw['audio_prompt_path'] = a.ref
    failed, t0 = [], time.time()
    for i, r in enumerate(todo, 1):
        text = r[a.column].strip()
        try:
            torch.manual_seed(a.seed)
            try:
                wav = model.generate(text, **kw)
            except TypeError:  # older/newer chatterbox without some keyword
                wav = model.generate(text, language_id='ar', **({'audio_prompt_path': a.ref} if a.ref else {}))
            if ffmpeg:
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                    ta.save(tmp.name, wav.cpu(), model.sr)
                subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', tmp.name, '-af', trim, '-ac', '1', '-b:a', '48k',
                                os.path.join(a.out, r['id'] + '.mp3')], check=True)
                os.unlink(tmp.name)
            else:
                ta.save(os.path.join(a.out, r['id'] + '.wav'), wav.cpu(), model.sr)
        except Exception as e:  # keep going; failures are listed at the end
            failed.append((r['id'], text, repr(e)))
        if i % 25 == 0 or i == len(todo):
            el = time.time() - t0
            print(f'  {i}/{len(todo)}  ({el / i:.1f} s each, ~{(len(todo) - i) * el / i / 60:.0f} min left)', flush=True)
        if a.sample:
            print(f'  {r["id"]}  {r["key"]}')

    if failed:
        with open(os.path.join(a.out, 'failed.tsv'), 'w', encoding='utf-8') as f:
            f.writelines('\t'.join(x) + '\n' for x in failed)
        print(f'{len(failed)} failed — see {a.out}/failed.tsv. Re-run to retry them.')
    with open(os.path.join(a.out, 'CREDITS.txt'), 'w', encoding='utf-8') as f:
        f.write('Generated audio: NAMAA-Egyptian-TTS by the NAMAA Community (MIT License)\n'
                'https://huggingface.co/NAMAA-Space/NAMAA-Egyptian-TTS — based on Chatterbox by Resemble AI.\n')
    if a.zip:
        shutil.make_archive('audio', 'zip', a.out)
        print('Wrote audio.zip — download it, unzip into the site\'s audio/ folder, then run:'
              '  node data-src/build_audio.js --manifest')


if __name__ == '__main__':
    main()
