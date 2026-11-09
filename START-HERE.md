# Nawa: download, run, and publish

This ZIP contains the complete speaking studio: source code, 34 readings, tests, local Urdu font and its license, a ready-built website, and a GitHub Actions workflow. There is no backend or hosted database to configure, and no API key is required.

## Quickest GitHub Pages setup: no build required

1. Unzip this download.
2. Create a **public** GitHub repository, for example `nawa-speaking-studio`.
3. Upload the **contents** of the `nawa-speaking-studio` folder to the repository. `package.json`, `START-HERE.md`, `src/`, and `docs/` should be at the repository root. Avoid adding an extra outer folder.
4. In the repository, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Choose branch **main**, folder **/docs**, then **Save**.
7. Wait for GitHub's Pages deployment to finish. Open the URL shown in Pages settings.

The `docs/` folder already contains the compiled app. Its `.nojekyll` file and relative asset paths support a GitHub Pages project address.

Official instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Run locally

Install Node.js 22.13 or newer, then open a terminal in this folder:

```sh
npm ci
npm run dev
```

Open the localhost URL printed in the terminal. Use that URL rather than double-clicking `index.html`; recording and browser modules need a web server.

## Change the app or add passages

- Readings, vocabulary, source credits, and challenges: `src/library.ts`
- Earlier short Urdu readings: `src/warmups.ts`
- Main interface: `src/App.tsx`
- Appearance: `src/styles.css`
- Recorder: `src/useRecorder.ts`
- Local audio persistence: `src/storage.ts`

After editing:

```sh
npm test
npm run build:pages
```

Upload or commit the updated source and `docs/` folder. Publishing from `main` and `/docs` automatically redeploys when that branch changes. Dependencies in `node_modules/` are recreated by `npm ci` and are intentionally excluded from this download.

## Alternative: build through GitHub Actions

The ZIP includes `.github/workflows/pages.yml`. If you prefer this route:

1. Include that hidden `.github` folder when uploading the project. On a Mac, Command + Shift + Period shows hidden files in Finder.
2. In Settings → Pages, select **GitHub Actions** as the publishing source.
3. Open Actions → **Publish Nawa to GitHub Pages** → **Run workflow**, using branch `main`.

The workflow runs tests, builds `dist/`, and deploys it. It is manual by default. Choose either the branch-based route or the Actions route; you only need one.

## Sessions, audio, and privacy

Audio, notes, ratings, and your paused session save in the browser on the device where you practise. You do not need to download files after each session. Audio uses IndexedDB; the current session and journal metadata use localStorage. The app does not upload recordings or analyse the voice automatically.

Use HTTPS for microphone recording. GitHub Pages supplies HTTPS. Allow microphone access when you click Record. Recordings automatically save when you stop; the app also retains available capture chunks for recovery after an interruption.

Browser history is specific to the website address. Recordings from the earlier private Site will stay at that earlier address and will not appear automatically on GitHub Pages. Clearing site data, private browsing, device loss, or browser eviction can erase local history. The persistent-storage button can reduce automatic eviction where supported. Optional notes export excludes audio; individual audio downloads are available.

## Validation and scope

Seven automated tests cover audio assembly and recovery, deletion, empty capture handling, timer accounting, draft restoration, rating validation, and multilingual library filtering. Browser checks also verified playback with valid sample audio, playback speed, timestamp notes, comparison, filters, and mobile overflow. The remote test environment had no physical microphone, so live capture should be checked on your own device.

Full project notes and historical speech/font credits are in `README.md`.
