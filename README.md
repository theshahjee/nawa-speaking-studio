# Nawa · Speaking studio

**Start with `START-HERE.md` for the quickest GitHub Pages setup. The `docs/` folder is already built and ready to publish.**

A local-first Urdu, English, bilingual Urdu-English, and professional English speaking studio. Built with React, TypeScript, and Vite. No backend, hosted database, API keys, authentication service, or paid integration is required by the app.

## Practice

Choose a 10, 12, or 15 minute session. Breathe, articulate, read, project, and reflect. The 34-entry library includes 24 longer original practice texts, six short Urdu warm-ups, and four credited historic speech excerpts or new Urdu practice translations. Intermediate and advanced texts include a small vocabulary set, a delivery focus, and an off-script speaking challenge.

Record several takes, play them back at different speeds, add timestamped notes, and compare two takes from the journal. Rate clarity, pace, confidence, and vocal control. Ratings are self assessments; the app does not claim to analyse your voice automatically.

## Local development

Node.js 22.13 or newer is recommended.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

`dist/` is the entire deployable app. It contains static files only. Relative asset URLs (`base: './'`) support both a domain root and a GitHub Pages project path.

## Storage and recording

- The current session, paused timer position, notes, ratings, and journal metadata save in `localStorage`.
- Audio and one-second capture chunks save to IndexedDB as independent byte buffers on the same browser and origin. Legacy Blob records remain readable. Stopping a take assembles the chunks into one playable Blob. Interrupted takes are recovered from the available chunks on the next visit, with a visible warning that the ending may be incomplete.
- The recorder asks for microphone access only after the user clicks Record. HTTPS or localhost is required. iPhone, iPad, and Safari use a codec-independent AudioWorklet capture path producing mono PCM16 WAV at 24 kHz (about 2.9 MB/minute). Other browsers use a MediaRecorder format that the same browser can play. The worklet is shipped as a separate static asset so it works under GitHub Pages project paths.
- Takes have a 15-minute limit. Recording is independent of the practice timer.
- No recording, note, or rating is sent to a server. No analytics or remote fonts are used. Source links open external transcript pages only when selected.
- Optional individual audio downloads and a JSON notes backup are available. The notes backup does **not** include audio and is not an automatic cloud backup.
- Browser storage is not a guarantee against loss: clearing site data, private-browsing sessions, storage pressure, or losing the device can remove it. The app offers a persistent-storage request, which browsers may approve or deny. This cannot protect against deliberate deletion.
- History does not automatically sync between browsers, devices, or website origins. Moving from Sites to GitHub Pages creates a separate origin; previous recordings remain at the original address. Different project paths on the same GitHub Pages domain share an origin, so only trusted apps should be hosted on that domain.
- Existing version-one Nawa notes and ratings migrate on the original Site origin. Deleting a migrated session does not cause it to reappear.

## GitHub Pages

A manual GitHub Actions workflow is provided at `.github/workflows/pages.yml`. It installs dependencies, runs the tests, builds the static app, uploads `dist/`, and deploys the artifact. It deliberately has **no push trigger** so that uploading the repository does not publish a website before public visibility is approved.

After approving public publication:

1. Push this project to a GitHub repository.
2. In Settings → Pages, choose GitHub Actions as the publishing source.
3. Run “Publish Nawa to GitHub Pages” from the Actions tab.
4. Review the URL returned by the deploy job.

Standard GitHub Pages websites are publicly accessible even when the source repository is private. GitHub Free requires a public source repository for Pages. Private site access is a separate Enterprise feature. A public static app still keeps each visitor's recordings in that visitor's browser; the recordings are not part of the repository or deployed files.

Official guidance: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Expand the library

Add a `Passage` entry in `src/library.ts`. Each entry has a stable ID, track, level, text paragraphs, delivery note, vocabulary, and speaking challenge. Source historic texts with their actual speaker and date; label adaptations and translations explicitly. No database is needed to ship a large content library.

## Sources and fonts

Historic selections link directly to the Library of Congress, National Park Service, American Presidency Project, and F. W. Pritchett's classroom transcription of the Iqbal Academy edition. The two Urdu speech selections are new practice translations of English source speeches, not claims of verbatim Urdu delivery. The app does not include recordings of the historical speakers.

Noto Nastaliq Urdu is bundled locally. Its license is in `public/fonts/NOTO-LICENSE.txt`.

## Validation

Fourteen automated tests cover ordered audio assembly and deletion, interrupted recording recovery, empty-capture errors, timer accounting, restored draft validation, self-rating validation, and multilingual library filtering. Browser QA also checks draft restoration, playback from a valid synthetic WAV fixture, playback speed, timestamp notes, session/audio association, comparison, reading filters, vocabulary disclosure, mobile overflow, and the missing-microphone error path. Live microphone capture needs a real microphone; the QA environment had none.

## iPhone playback compatibility

The player copies saved audio bytes into a fresh, correctly typed Blob and tries a data-URL source when required by Apple browsers or when Blob URL playback fails. If an older take still fails, “Try compatibility playback” asks the local Web Audio decoder to make a WAV playback copy. The copy is stored separately; the original recording is never overwritten. If the browser cannot decode the original bytes, the app keeps them and leaves the original download available. No recovery audio is uploaded.

The regression suite includes real worklet resampling at 44.1 and 48 kHz, final-block flushing, PCM-to-WAV recovery, legacy Blob reads, preservation of original recordings alongside playback copies, and byte-buffer persistence. Browser QA generated audio through the actual AudioWorklet, saved/reopened the WAV, and verified duration and playback. An iPhone hardware retest remains necessary; the screenshot alone cannot establish which WebKit media issue affected the old take.
