# Масри — Egyptian Arabic for Kyrgyz speakers, from zero to B2

A complete Egyptian (Cairene) Arabic course with the whole interface in **Kyrgyz**. It's the sister app of **Кыргызча** (Kyrgyz for English speakers) and has the same features: a structured course like **Busuu**, a reading library like **LingQ**, accounts that sync across devices, a community that corrects your writing, and an installable phone app. It deploys to Vercel in about 10 minutes.

There's no framework and no build step. The front end is plain HTML, CSS and JS. The back end is five small Vercel functions with **zero npm dependencies**, storing data in **Supabase** (Postgres).

---

## What's inside

**Course (Busuu-style)**
- 59 lessons in 7 stages, from the Arabic alphabet to B2. Each lesson has a plain-language explanation, Kyrgyz-vs-Egyptian comparison boxes, colour-coded prefixes and endings, vocabulary and a practice test (546 questions in total).
- **Cairo situations (Kallimni ʿArabi Bishweesh syllabus):** 10 lessons, one per module of the book's first volume, at the end of stages 2 and 3: meeting people, objects, phone numbers and time, money and shopping, location and addresses, directions and hotels, daily routine, jobs and hosting guests, invitations and gifts, taxi, train and restaurant. Each lesson shows its module number, and the «Кантип үйрөнөбүз» page has a module → lesson table for learners who use the book in class.
- **Placement test** that finds your starting stage.
- **Study plan**: pick a level, minutes a day and days a week to get a daily XP goal and a finish date.
- **Today dashboard**: goal ring, streak, next lesson, due reviews, weekly chart and plan progress.
- **Smart review**: spaced repetition with mixed exercise types (meaning, reverse, typing, listening).
- **Fix my mistakes**, **flashcards**, and **My words** with word strength.
- **Word drops** (Drops-style): 3, 5 or 10-minute picture sessions across 44 topics in 7 groups (575 words, each with a picture). You meet the word, tap the picture, pick the word, listen, build it from Arabic letter blocks and match pairs.
- **Speaking practice**: listen, record yourself, play it back, and optionally check it with speech recognition (ar-EG).
- **Community**: 14 writing prompts (A1–B2). Other learners and native speakers correct your text with highlighted edits. You can mark corrections as helpful or report a post.
- **Weekly league** (you can opt out) and **level tests with printable certificates** for A1, A1+, A2, B1 and B2.

**Egyptian Arabic engine** (`js/eg.js`)
- Every Arabic item in the data is written `"عربي~roman"`. The roman part is the Cairo pronunciation (2 = ء/ق, 3 = ع, 7 = ح, x = خ, gh = غ, S D T Z = ص ض ط ظ, doubled vowels = long).
- The pronunciation is shown in **Kyrgyz Cyrillic** (ʻ ʼ ҳ һ ғ ў and с̣ д̣ т̣ з̣), or in scholarly Latin, or hidden. The «Окулушу» button cycles through these.
- Answers are accepted in Arabic script, in Cyrillic transcription or in Latin transcription. Common spelling variants (ة/ه, ى/ي, hamza seats) are tolerated. There's an on-screen Arabic keyboard.
- **Real voices only.** Learners hear only recordings of an Egyptian speaker, made in the built-in recording studio (`/#record`). Text that isn't recorded yet shows its transcription and no play button; listening exercises use only recorded words. Synthesized voices are off by default (see the end of this file).
- **Word machine** (replaces the suffix machine): possessive endings with the ة→t and vowel-shortening rules, the article with sun/moon letters, dual and plural; full conjugation of 40 verbs (past, bare, bi- present, ha- future, negation, imperative); adjective agreement with kaan/haykuun; Egyptian numbers to 999,999,999.

**Dictionary**: 1,891 Egyptian Arabic words and phrases with Kyrgyz meanings, kept apart when two words share a spelling (كتب *kutub* / *katab*). You can search in Arabic, in Kyrgyz, or by pronunciation in Cyrillic or Latin. If you type a word with prefixes and endings (مابيكتبوش, عربيتها), it finds the stem. Any word can be added to your review deck.

**Library (LingQ-style)**
- 12 graded stories (A1–B2). Every sentence has a pronunciation line and a Kyrgyz translation.
- Every word has a status: **new** (blue), then **learning 1–4** (yellow), then **known**.
- Tapping a word shows its pronunciation, meaning, a prefix + stem + ending analysis (بي + كتب + وا), your own note, the Kyrgyz cognate, and links to Wiktionary, Glosbe and Google Translate.
- You can import any text. Pronunciation is exact for known words and marked «≈» for guessed ones.

**«Тектештер» (cognates) toggle**: the original's "Arabic hints" feature, turned around. With it on:
- A green «К» note appears under every Egyptian word that Kyrgyz also has (89 words: китеп ← كتاب, убакыт ← وقت, азыр ← حاضر…).
- A Standard Arabic (Fusha) version appears in the comparison boxes.
- A short "Egyptian vs Fusha" note appears at the top of most lessons.
- The **Тектеш сөздөр** page lists the cognates, the sound-change rules, the false friends (мектеп ≠ مكتب "office", макул ≠ معقول "really?!") and a Fusha/Egyptian table.

**Also**: the alphabet page (28 letters with their joined forms, Egyptian pronunciation and a reading drill), a cheat sheet, offline support and "Add to Home Screen".

**Guest mode**: without a server (opened as a file, offline or in a preview), everything still works and is saved on the device. When the learner signs in, the device's progress is merged into the account.

---

## Deploy to Vercel — step by step

You need free accounts on **GitHub** and **Vercel**. Vercel creates the Supabase database for you.

> **Already deployed Кыргызча?** You can reuse its Supabase project. Масри's tables and functions all start with `mz_` (Кыргызча uses `kg_`), so they don't clash. In step 3, connect the *existing* database to the new project instead of creating a new one. Then run `supabase/schema.sql` in the same SQL Editor. The free Supabase plan allows only two projects, so sharing one is often handy.

### 1. Put the files on GitHub
1. Unzip `masri.zip`.
2. On **github.com** click **+** → **New repository**, name it `masri`, and click **Create repository**.
3. Click **"uploading an existing file"**, drag in **everything inside** the `masri` folder (including the `api`, `css`, `js`, `icons`, `supabase` and `data-src` folders), and click **Commit changes**.
   - Check that `index.html` and the `api` folder are at the top level of the repository.

### 2. Create the Vercel project
1. On **vercel.com** → **Add New… → Project** → pick `masri` → **Import**.
2. Set Framework preset to **Other**. Leave Build Command and Output Directory **empty**. Click **Deploy**.

### 3. Add the database (Supabase)
1. In the Vercel project, open **Storage** → **Create Database** (or **Connect** an existing one) → **Supabase**, and connect it to the `masri` project.
2. Vercel adds `SUPABASE_URL` and the secret key (`SUPABASE_SECRET_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` on older projects) for you.
3. Click **Open in Supabase** → **SQL Editor** → **New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and press **Run**. You should see "Success. No rows returned". Running it again later is safe.

### 4. Add the session secret
Go to Project → **Settings → Environment Variables** and add `SESSION_SECRET`. Its value should be a long random string of **at least 32 characters** (for example from `openssl rand -base64 48`). Use a different value from Кыргызча's.

### 5. Record the audio
The site plays **only real recordings** of an Egyptian speaker; synthesized voices are switched off (`js/config.js`). Until a sentence is recorded, learners see its transcription and no play button, so nothing wrong is ever heard.

1. **Switch on uploading (once).** In Vercel → Project → **Settings → Environment Variables**, add `RECORDER_KEY` with a long random value (for example `openssl rand -base64 24`), for Production and Preview, then **Redeploy**. If your Supabase project was set up before November 2026, also run the latest `supabase/schema.sql` in Supabase → SQL Editor (it adds the `audio` storage bucket and the `mz_audio` table).
2. Open `https://your-site/#record` (the recording studio) on a computer or phone with a decent microphone, in a quiet room, and paste the key into **☁ Recorder key** once. The browser remembers it.
3. Pick your voice (female/male) and a set. Sets follow the course order: lessons first, then stories, word drops and the dictionary. Read each sentence the way you'd say it in Cairo and press **Space** to start and stop. With **Auto-next** on, the next sentence appears right away. **⏭ Next unrecorded** jumps to the first gap anywhere in the course. Recording a sentence again replaces it. If a sentence is written wrongly, press **⚑** and type the correction; flags are sent to the site owner too (table `mz_rec_flags`).
4. That's it: each take is cleaned up in the browser (silence trimmed, loudness evened out), uploaded in the background to Supabase Storage, and plays on the site for everyone within about a minute. The line next to the key shows what's waiting. If you're offline, takes wait on the device and upload when you're back.

Without the key (or as a backup) you can still use the ZIP route: press **⬇ Export new**, then on your computer run `node data-src/build_audio.js --add ~/Downloads/masri-recordings-….zip` (needs ffmpeg) and push `audio/` + `js/data/audio-manifest.js`. Deployed files and uploaded takes work side by side; when both exist for a sentence, the uploaded one (the newer take) plays.

`node data-src/build_audio.js` shows how much is in the deployed files (the whole course is about 3,360 sentences, about 1,450 of them single dictionary words); `--missing` lists what's left. The studio's progress bar counts uploaded takes too.

You can also add a recording by hand: find the sentence in `audio/jobs.tsv` (made by `--export`), save the recording as `audio/<id>.mp3` (or `.m4a`/`.webm`), run `node data-src/build_audio.js --manifest`, and upload.

### 6. Redeploy
Go to **Deployments** → the latest one → **⋯** → **Redeploy**.

### 7. Try it
Open your URL → **Кирүү → Аккаунт ачуу**. On a phone, choose **Add to Home Screen** to install the app.

**If something's wrong**, the app tells you, in Kyrgyz:
- «Маалымат базасы туташкан эмес»: the database isn't connected to this project, or you didn't redeploy.
- «Маалымат базасынын таблицалары жок»: run `supabase/schema.sql` (step 3.3).
- «SESSION_SECRET жок…»: do step 4, then redeploy.
- No play buttons: nothing is recorded yet, or `js/data/audio-manifest.js` wasn't uploaded with the `audio/` files (step 5).

---

## Run it on your computer

```bash
cd masri
SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SECRET_KEY=sb_secret_xxx node dev-server.js   # Node 18+; open http://localhost:3000
```
Without the Supabase settings the app runs in guest mode. Double-clicking `index.html` also works, in guest mode.

---

## How it's built

```
masri/
├── index.html, favicon.svg, manifest.webmanifest, sw.js, icons/   app shell + PWA
├── css/style.css                 design system (Nile blue, terracotta, desert gold; Noto Naskh Arabic)
├── js/
│   ├── eg.js                     Egyptian Arabic engine: pronunciation, checking, speech, verbs, nouns, numbers
│   ├── app.js                    router, lessons, quizzes, word machine, cheat sheet, plugin API (window.APP)
│   ├── cloud.js                  accounts, sync/merge, league XP, account page, install prompt
│   ├── reader.js                 library, word statuses, clitic analyser, imports
│   ├── learn.js                  dashboard, plan, placement, review, speaking, community, certificates
│   ├── drops.js                  word drops: picture topics, timed sessions, letter blocks, pairs
│   ├── dictionary.js             searchable dictionary (Arabic / Kyrgyz / transcription, stem finder)
│   ├── record.js                 recording studio (#record): record, preview, flag, export new/all as ZIP
│   ├── config.js                 site settings (synthesizedVoices: false)
│   └── data/                     course-*.js (course-cairo-a/b.js = Kallimni-syllabus lessons), readers, alphabet, links (cognates), fusha, drops, lexicon, audio-manifest
├── audio/                        the recordings (MP3) — added with build_audio.js --add
├── api/                          Vercel serverless functions (Кыргызча's logic, mz_ tables) + tts.js (Azure ar-EG voices)
├── supabase/schema.sql           tables + SQL functions, all prefixed mz_
├── data-src/                     lexicon lists, build_lexicon.py, build_audio.js (recording import/status), namaa_tts.py (not deployed)
├── dev-server.js                 local server (not deployed)
└── vercel.json, package.json
```

Security, sync and moderation work exactly as in Кыргызча: scrypt passwords, signed HttpOnly cookies (`mz_s`), a CSRF header, rate limits, escaped user text, posts hidden after 3 reports (set `reports` to 3 in `mz_posts` to hide one yourself), and account deletion cascades.

## Editing content
- **Lessons** are plain objects in `js/data/course-*.js`. Write Arabic as `"عربي~roman"`, and inside HTML as `[[عربي~roman]]`. A `|` inside the Arabic part splits a word into coloured pieces (`ب|يـ|كتب|وا`). In multiple-choice questions **the first option is the correct one** (options are shuffled on screen). Each `compare` box takes `ky` and `ar`, plus optional `fus` and `fnote` for the Fusha view.
- **Dictionary**: edit the lists in `data-src/lex_*.txt` (`arabic|roman|kyrgyz|pos|present`), then run `python3 data-src/build_lexicon.py`. The script refuses Latin letters in Kyrgyz glosses and malformed pronunciations.
- After editing, bump `CACHE` in `sw.js` so installed apps fetch the new files.

## Known limits
- There's no email, so there's no "forgot password". The owner can delete the person's row in `mz_users` so they can sign up again.
- Audio exists only for recorded sentences. Words a learner taps in imported texts, and forms generated by the word machine, have no recording, so they show the transcription only.
- Egyptian Arabic has no official spelling. The course uses common Cairene spellings and tolerates the usual variants in answers.
- The dictionary has 1,891 entries (Кыргызча's has about 3,000). It's easy to extend through `data-src/`.

Content and code are original; the course layout follows Кыргызча. The 10 «Cairo situations» lessons follow the topic order (scope and sequence) of *Kallimni ʿArabi Bishweesh* by Samia Louis (AUC Press), so that learners using the book can study alongside it; their dialogues, explanations and exercises are written from scratch, and nothing from the book is reproduced.

## Optional: synthesized voices (off by default)
They're less accurate for colloquial Egyptian, which is why they're off. To turn them on, set `synthesizedVoices: true` in `js/config.js`; recordings still play first, and the synthesized voice fills the gaps.

**NAMAA-Egyptian-TTS (free).** [NAMAA-Egyptian-TTS](https://huggingface.co/NAMAA-Space/NAMAA-Egyptian-TTS) is an open Egyptian Arabic voice (MIT licence, credit is shown on the «Аудио жөнүндө» page). You run it once on a free GPU and ship the MP3s with the site, so there's no running cost and audio works offline.
1. On your computer: `node data-src/build_audio.js --export` (add `--voices f,m` if you'll make a second voice). This writes `audio/jobs.tsv`, about 4,100 sentences.
2. Go to [kaggle.com](https://www.kaggle.com) (free; verify your phone to unlock GPU and internet) → **Create → New Notebook**. In the right panel set **Accelerator: GPU T4** and **Internet: on**. Upload `audio/jobs.tsv` and `data-src/namaa_tts.py` (**Add Input → Upload**), or copy them into `/kaggle/working`.
3. In a cell, run:
   ```
   !pip install -q chatterbox-tts
   !python namaa_tts.py --jobs jobs.tsv --out audio --sample 15
   ```
   Listen to the 15 samples in `audio/`. If you like them, run the whole set (a few hours on a T4; the script prints how long is left, and if the session stops, run it again and it continues):
   ```
   !python namaa_tts.py --jobs jobs.tsv --out audio --zip
   ```
   (Use the paths Kaggle shows for your uploaded files, e.g. `/kaggle/input/…/jobs.tsv`.) Google Colab works the same way (**Runtime → Change runtime type → T4 GPU**).
4. Download `audio.zip`, unzip it into the site's `audio/` folder, run `node data-src/build_audio.js --manifest`, and push to GitHub.

Tips: `--ref clip.wav` makes every sentence sound like a 10–20 second clip of a native speaker (with their permission). `--voice m --ref male.wav` makes the male voice. The model's authors note that ق and numbers are sometimes mispronounced; the export already rewrites ق as a glottal stop where Cairenes say one and spells numbers out as words. Listen through the lessons and replace any bad sentence with a real recording (step 5).

**Live Azure voice.** Lower accuracy for colloquial words, but it covers anything not pre-generated (imported texts, tapped words).
1. Go to [portal.azure.com](https://portal.azure.com) (a free Azure account works) → **Create a resource** → search **Speech** → **Create**.
2. Pricing tier **Free F0** (500,000 characters a month). Pick any region, e.g. *West Europe*.
3. When it's created, open it → **Keys and Endpoint**. Copy **KEY 1** and the **Location/Region** (e.g. `westeurope`).
4. In Vercel → **Settings → Environment Variables**, add `AZURE_SPEECH_KEY` (KEY 1) and `AZURE_SPEECH_REGION` (e.g. `westeurope`).

Each sentence is generated once and then served from Vercel's cache, so the free tier lasts a long time. With the database connected, `/api/tts` also limits each visitor to 300 new sentences an hour and the whole site to 3,000 a day (`TTS_MAX_PER_DAY` changes this). The whole course is about 55,000 characters per voice.

**Optional: pre-generate all audio with Azure instead of NAMAA.** On your computer, with Node 18+:
```bash
AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=westeurope node data-src/build_audio.js --azure              # Salma
AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=westeurope node data-src/build_audio.js --azure --voices f,m  # both voices
```
This writes `audio/*.mp3`, `audio/index.tsv` and `js/data/audio-manifest.js`. Commit and push them. The site then plays these files first, even offline from the cache and even if the key is later removed. `--dry` only counts the characters.

