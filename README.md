# Масри — Egyptian Arabic for Kyrgyz speakers, from zero to B2

A complete Egyptian (Cairene) Arabic course with the whole interface in **Kyrgyz**. It's the sister app of **Кыргызча** (Kyrgyz for English speakers) and has the same features: a structured course like **Busuu**, a reading library like **LingQ**, accounts that sync across devices, a community that corrects your writing, and an installable phone app. It deploys to Vercel in about 10 minutes.

There's no framework and no build step. The front end is plain HTML, CSS and JS. The back end is five small Vercel functions with **zero npm dependencies**, storing data in **Supabase** (Postgres).

---

## What's inside

**Course (Busuu-style)**
- 49 lessons in 7 stages, from the Arabic alphabet to B2. Each lesson has a plain-language explanation, Kyrgyz-vs-Egyptian comparison boxes, colour-coded prefixes and endings, vocabulary and a practice test (446 questions in total).
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
- **Speech is Egyptian only.** Sources, best first: a recorded or pre-generated file in `/audio` → `/api/tts` (Microsoft Azure's Cairene neural voices, Salma or Shakir) → an ar-EG voice in the browser (Edge has "Microsoft Salma Online" for free). Fusha voices (ar-SA etc.) are **off by default**, because they say *qahwa* and *jamiil* instead of *2ahwa* and *gamiil*; a learner can switch them on in «Аудио жөнүндө» after a warning.
- Before text goes to any voice it's prepared from the transcription: vowel marks are added (كتب + *katab* → كَتَبْ, so nothing is guessed and no Fusha case endings appear), ق becomes ء/أ where it's a glottal stop, and ث/ذ become ت/س and د/ز.
- **Word machine** (replaces the suffix machine): possessive endings with the ة→t and vowel-shortening rules, the article with sun/moon letters, dual and plural; full conjugation of 40 verbs (past, bare, bi- present, ha- future, negation, imperative); adjective agreement with kaan/haykuun; Egyptian numbers to 999,999,999.

**Dictionary**: 1,866 Egyptian Arabic words and phrases with Kyrgyz meanings, kept apart when two words share a spelling (كتب *kutub* / *katab*). You can search in Arabic, in Kyrgyz, or by pronunciation in Cyrillic or Latin. If you type a word with prefixes and endings (مابيكتبوش, عربيتها), it finds the stem. Any word can be added to your review deck.

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

### 5. Turn on the Egyptian voice (recommended, free)
Without this, only learners with an Egyptian voice on their device (e.g. Microsoft Edge) hear audio; everyone else sees the transcription.
1. Go to [portal.azure.com](https://portal.azure.com) (a free Azure account works) → **Create a resource** → search **Speech** → **Create**.
2. Pricing tier **Free F0** (500,000 characters a month). Pick any region, e.g. *West Europe*.
3. When it's created, open it → **Keys and Endpoint**. Copy **KEY 1** and the **Location/Region** (e.g. `westeurope`).
4. In Vercel → **Settings → Environment Variables**, add `AZURE_SPEECH_KEY` (KEY 1) and `AZURE_SPEECH_REGION` (e.g. `westeurope`).

Each sentence is generated once and then served from Vercel's cache, so the free tier lasts a long time. With the database connected, `/api/tts` also limits each visitor to 300 new sentences an hour and the whole site to 3,000 a day (`TTS_MAX_PER_DAY` changes this). The whole course is about 50,000 characters per voice.

**Optional: pre-generate all audio.** On your computer, with Node 18+:
```bash
AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=westeurope node data-src/build_audio.js            # Salma
AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=westeurope node data-src/build_audio.js --voices f,m  # both voices
```
This writes `audio/*.mp3`, `audio/index.tsv` and `js/data/audio-manifest.js`. Commit and push them. The site then plays these files first, even offline from the cache and even if the key is later removed. `--dry` only counts the characters.

**Real recordings.** To replace a generated sentence with a native speaker's recording, find the sentence in `audio/index.tsv`, save the recording as `audio/<id>.mp3`, run `node data-src/build_audio.js --manifest`, and push.

### 6. Redeploy
Go to **Deployments** → the latest one → **⋯** → **Redeploy**.

### 7. Try it
Open your URL → **Кирүү → Аккаунт ачуу**. On a phone, choose **Add to Home Screen** to install the app.

**If something's wrong**, the app tells you, in Kyrgyz:
- «Маалымат базасы туташкан эмес»: the database isn't connected to this project, or you didn't redeploy.
- «Маалымат базасынын таблицалары жок»: run `supabase/schema.sql` (step 3.3).
- «SESSION_SECRET жок…»: do step 4, then redeploy.
- No sound, and «Аудио жөнүндө» says «Египетче үн жок»: check step 5 (both variables, then redeploy). Open `/api/tts?probe=1`: it should say `"ok":true`.

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
│   └── data/                     course-*.js, readers, alphabet, links (cognates), fusha, drops, lexicon, audio-manifest
├── audio/                        pre-generated / recorded Egyptian audio (empty until you run build_audio.js)
├── api/                          Vercel serverless functions (Кыргызча's logic, mz_ tables) + tts.js (Azure ar-EG voices)
├── supabase/schema.sql           tables + SQL functions, all prefixed mz_
├── data-src/                     lexicon source lists + build_lexicon.py, build_audio.js (not deployed)
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
- Audio: synthesized voices are good but not perfect. Words written with Fusha spelling but said differently in Cairo (e.g. زيتون *zatuun*, باذنجان *bitingaan*) may still be read from the spelling. For the most important sentences, a native speaker's recording (see step 5) is best. Without an Azure key or an Egyptian device voice, the site stays silent rather than play Fusha.
- Egyptian Arabic has no official spelling. The course uses common Cairene spellings and tolerates the usual variants in answers.
- The dictionary has 1,866 entries (Кыргызча's has about 3,000). It's easy to extend through `data-src/`.

Content and code are original; the course layout follows Кыргызча. Kallimni ʿArabi Bishweesh (AUC Press) was used only as a reference to spot-check common Cairene forms; nothing from it is reproduced.
