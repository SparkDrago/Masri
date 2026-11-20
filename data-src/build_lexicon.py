#!/usr/bin/env python3
"""Build js/data/lexicon.js from the source lists in data-src/.
   Line format: arabic|roman|kyrgyz|pos|present (optional "arabic~roman" for verbs)
   Lines starting with # are comments. Duplicates (same Arabic + roman) are merged."""
import json, re, sys, os
here = os.path.dirname(os.path.abspath(__file__))
rows, seen, errors = [], {}, []
for fn in ['lex_verbs.txt', 'lex_nouns.txt', 'lex_other.txt', 'lex_more.txt', 'lex_extra.txt']:
    for n, line in enumerate(open(os.path.join(here, fn), encoding='utf8'), 1):
        line = line.strip()
        if not line or line.startswith('#'): continue
        p = line.split('|')
        if len(p) < 4: errors.append(f'{fn}:{n}: too few fields'); continue
        ar, ro, ky, pos = p[0].strip(), p[1].strip(), p[2].strip(), p[3].strip()
        pres = p[4].strip() if len(p) > 4 else ''
        if not re.search(r'[؀-ۿ]', ar): errors.append(f'{fn}:{n}: no Arabic')
        if re.search(r'[a-zA-Z]', ky): errors.append(f'{fn}:{n}: Latin letters in Kyrgyz gloss: {ky}')
        if re.search(r'[^a-z0-9SDTZ\- ?!.,\']', ro): errors.append(f'{fn}:{n}: unexpected character in transcription (use 7 for ح, 2 for ء/ق …): {ro}')
        if not re.fullmatch(r"[a-zA-Z0-9\- '?!.]+", ro): errors.append(f'{fn}:{n}: bad roman: {ro}')
        if pres and '~' not in pres: errors.append(f'{fn}:{n}: present form needs arabic~roman')
        key = (ar, ro)
        if key in seen:
            r = rows[seen[key]]
            for g in ky.split('; '):
                if g not in r[2].split('; '): r[2] += '; ' + g
            continue
        seen[key] = len(rows)
        rows.append([ar, ro, ky, pos, 'mz'] + ([pres] if pres else []))
if errors:
    print('\n'.join(errors)); sys.exit(1)
out = os.path.join(here, '..', 'js', 'data', 'lexicon.js')
with open(out, 'w', encoding='utf8') as f:
    f.write('/* Egyptian Arabic – Kyrgyz lexicon used by the dictionary, the reader and the word drops.\n'
            '   Compiled for this course (source lists and build script: data-src/).\n'
            '   Row: [arabic, roman (Cairo pronunciation), kyrgyz, part of speech, source, present form (verbs)]. */\n')
    f.write('window.LEXICON = {\n  sources: { mz: "Масри курсу үчүн түзүлгөн сөздүк" },\n  rows: ')
    f.write(json.dumps(rows, ensure_ascii=False, separators=(',', ':')))
    f.write('\n};\n')
print(len(rows), 'rows ->', os.path.relpath(out))
