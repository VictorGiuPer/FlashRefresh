# Notion card export

## What ChatGPT can automate

ChatGPT can read an authorized Notion database on a schedule and prepare a validated `cards.json` export. Its connected GitHub app is read-only, so a ChatGPT scheduled task cannot commit or push that file. Use the prompt below to validate the Notion data and produce the export; use the GitHub Actions + Notion API route for a fully unattended deployment.

## Notion properties

Use these property names, or replace them consistently in the prompt before creating the task:

| Notion property | Required value |
| --- | --- |
| `ID` | Permanent unique card ID. Prefer Notion's immutable page ID; otherwise use a frozen Notion Unique ID value. |
| `Deck ID` | Permanent machine-readable deck ID, such as `damodaran`. |
| `Deck` | Display name shown in the app. |
| `Topic Tag` | Short topic label shown on each card. |
| `Front` | Question text. |
| `Back` | Answer text. |
| `Approved` | Checkbox; only checked rows are exported. |

Never use a row number, current date, random UUID, changing formula, front-text hash, or list position as `ID`. The same Notion row must produce exactly the same `card.id` forever.

## One-time ChatGPT setup

1. In ChatGPT, open **Settings → Apps** and connect Notion.
2. Authorize the Notion workspace and make sure the connected account can open the flashcard database.
3. If you want the task to compare against the current repository, connect GitHub and authorize the Flash Refresh repository. This comparison is read-only.
4. Open **Scheduled tasks**, create a recurring task, choose the schedule you want, and paste the prompt below after replacing the two angle-bracket placeholders.

## Copy-ready scheduled-task prompt

```text
Every day at 06:00 Europe/Brussels, prepare the Flash Refresh card-library export.

Source:
- Notion database: <PASTE THE NOTION DATABASE URL OR EXACT NAME>
- Current repository for comparison only: <GITHUB-OWNER>/<REPOSITORY>
- Current file for comparison only: data/cards.json

Read every row in the Notion database where Approved is checked. Use these exact Notion properties:
- ID
- Deck ID
- Deck
- Topic Tag
- Front
- Back
- Approved

Build one JSON document with exactly this shape and no additional fields:
{
  "decks": [
    { "id": "<Deck ID>", "name": "<Deck>" }
  ],
  "cards": [
    {
      "id": "<ID>",
      "deckId": "<Deck ID>",
      "topicTag": "<Topic Tag>",
      "front": "<Front>",
      "back": "<Back>"
    }
  ]
}

Treat ID as permanent. Copy it exactly from Notion. Never generate, regenerate, renumber, hash, or otherwise replace it. If the Notion connector exposes the immutable system page ID and the ID property is not a frozen unique value, stop and ask me which identifier should be canonical before producing an export. Once a canonical ID format has been used, never switch formats.

Validate before producing the file. Stop the run and report a concise error list if:
- an approved row has a blank ID, Deck ID, Deck, Topic Tag, Front, or Back;
- two approved rows have the same ID;
- one Deck ID is paired with more than one Deck name;
- an ID differs from the ID for the same Notion page in the previous repository file, when that comparison can be made;
- the result is not valid JSON with the exact schema above.

Create each deck once. Sort decks by name, then sort cards by deckId, topicTag, and front so commits remain easy to review. Preserve all Unicode characters. Format the JSON with two-space indentation and a final newline.

Compare the generated document with the repository's current data/cards.json when GitHub access is available. If nothing changed, say "No card-library changes" and do not create a redundant file. If it changed, attach the complete generated file named cards.json and summarize the numbers of added, changed, and removed cards. Do not claim that GitHub was updated: ChatGPT's connected GitHub app is read-only. Remind me that the file must be committed as data/cards.json, or that I can enable the separate GitHub Actions + Notion API sync for a fully automatic push and deployment.
```

## Stable-ID rule

The safest canonical value is the Notion system page ID because it is immutable. A visible Notion `ID` property is also acceptable only when it is guaranteed unique, non-empty, and frozen for the life of the card. Do not switch from one scheme to the other after study progress exists: progress is keyed by the exact string in `card.id`.

