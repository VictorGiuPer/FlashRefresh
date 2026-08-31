# Flash Refresh

Flash Refresh is a private, mobile-first flashcard PWA. Card content is read-only and comes from individual JSON files in `data/decks/`; study progress stays on the current device in browser storage.

## One-time GitHub Pages setup

Do these steps once. Afterward, every push to `main` publishes the latest app and card library automatically.

1. Go to [GitHub](https://github.com/new) and create a new empty repository.

   - Choose any repository name you like.
   - Do **not** add a README, `.gitignore`, or license on GitHub—the project already contains its own files.

2. Open a terminal in this project folder. Copy and paste this first block, then press Enter:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   ```

3. Copy the repository address from GitHub. Replace `<your-username>` and `<repo-name>` in the next block, then paste both commands and press Enter:

   ```bash
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```

4. On GitHub, open the repository and go to **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**. Do not select “Deploy from a branch.”

5. Open the repository’s **Actions** tab. Wait for **Deploy Flash Refresh to GitHub Pages** to finish with a green check.

6. Return to **Settings → Pages**. GitHub shows the live site address there. Open that address on your phone and use the browser’s **Add to Home Screen** action to install the PWA.

7. That is the last manual deployment step. Every later push to `main`—including a future Notion sync that updates a deck file—builds and publishes automatically.

## Card library contract

Each `.json` file directly inside `data/decks/` is one deck. The app discovers those files automatically at development and build time, so adding a valid file adds a deck without updating an index or application code. File names are only for readability; the JSON `id` is the permanent deck identifier.

Use this exact shape for each deck file, for example `data/decks/damodaran.json`:

```json
{
  "id": "damodaran",
  "name": "Damodaran Valuation Playlist",
  "cards": [
    {
      "id": "<stable Notion page id>",
      "topicTag": "Damodaran S4 — Equity Risk Premiums",
      "front": "...",
      "back": "..."
    }
  ]
}
```

The containing deck file supplies `deckId`; do not add `deckId` to individual cards. The build rejects malformed files, duplicate deck IDs, and duplicate card IDs, leaving the last deployed version live if a content edit is invalid.

> **Critical for the future Notion automation:** `card.id` must always be the permanent Notion page ID. Never generate new IDs during a sync. Progress is stored by `card.id`, so changing IDs silently makes existing progress appear lost.

The repository currently includes a small sample deck so the interface and study loop are easy to review before deployment. Replace it with generated deck files when the sync is ready. An empty `data/decks/` directory represents an empty library.

Content updates may add, replace, or remove deck files, but must not write to or depend on the app’s local progress data.

The copy-ready ChatGPT export task and stable-ID rules are in [`NOTION_SYNC_AUTOMATION.md`](./NOTION_SYNC_AUTOMATION.md). ChatGPT's connected GitHub app is read-only, so a truly unattended Notion-to-repository sync needs a GitHub Action with Notion credentials; the ChatGPT task can prepare and validate the export but cannot push it.

## Local preview

To run the app locally, paste these commands in the project folder:

```bash
npm install
npm run dev
```

Open the local address printed in the terminal. To verify the production build:

```bash
npm test
npm run build
npm run preview
```

## Progress storage

- `flashRefresh.progress` contains progress keyed by stable card ID.
- A card is marked **Needs attention** in Manage after two consecutive **Didn't know it** grades. Any other grade clears that streak.
- `flashRefresh.deckStreaks` stores each deck’s study streak on this device. A day counts only after every card due in that deck’s session is graded; missing a day resets the displayed streak.
- `flashRefresh.appState` contains the last selected deck.
- Progress is local to the current browser/device and is never sent anywhere.
- Removed cards leave harmless orphaned progress entries; newly synced cards are immediately due.
