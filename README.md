# GoalGetter — Duo Quest ⚔️

A motivational, gamified point tracker for two players working toward a shared goal.

## Features

- Quantity-based activity logging with configurable points and targets.
- Two players, individual scores, streaks, achievements, levels, and daily quests.
- Positive activities, penalties, reading progress, and a shared prize.
- Static GitHub Pages hosting with shared state stored as JSON on a `data` branch.
- A cached local copy for reading during temporary network interruptions.

## Local development

```sh
npm install
npm run dev
```

The first run shows a one-time setup screen because `public/github-config.json` does not yet
contain an encrypted token.

## One-time GitHub storage setup

1. Create a fine-grained GitHub token restricted to this repository with only
   **Contents: Read and write** permission.
2. Run `npm run dev` and open the local URL.
3. Enter the token and a strong shared password in the setup screen.
4. The browser verifies access, encrypts the token locally with PBKDF2 and AES-GCM, and
   downloads `github-config.json`.
5. Replace `public/github-config.json` with that downloaded file.
6. Commit and push the application to `main`.

The plaintext token and shared password must never be committed. The encrypted token is safe
to publish for this personal use case as long as the password is strong and the token remains
narrowly scoped.

On the first unlocked launch, GoalGetter creates the `data` branch and initializes
`state.json` from the current `server/data.json`. Subsequent updates use GitHub's file SHA for
conflict detection and retry against the newest state.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds and deploys pushes to `main`.
In the repository's **Settings → Pages**, select **GitHub Actions** as the publishing source.

The deployed project URL is:

```text
https://oterogonzalo.github.io/GoalGetter/
```

## Data safety

- The original `server/data.json` is retained as the migration source.
- Remote updates create commits on the `data` branch, providing a recoverable history.
- The browser caches the last successfully synchronized state in `localStorage`.
- Keep an external copy of `server/data.json` until the remote `state.json` has been verified.

The legacy Express server remains in `server/` as a migration fallback, but the deployed app
does not require or call it.
