# Sprite Assets

Assets for the Daily Pet feature (`src/components/DailyPet.tsx`).

## Files

- `cat/sheet.png` — the cat's multi-row sprite sheet: 256x320 px,
  8 columns x 10 rows of 32x32 frames. The cat faces RIGHT in the art.
  Row-to-animation mapping lives in `src/spriteConfig.ts` (sit, groom,
  sleep, walk, jump, run — some rows are unused variants).
- `cat/idle.png` — an older cat-in-a-box strip (128x32, 4 frames of
  32x32). Currently unused; kept for a possible future feature.

## Adding or replacing sprites

1. Use PNG with transparency, equal-sized frames laid out in a grid.
2. Drop the file in this folder (it is served at `/sprites/...`).
3. Register frame size, rows, and animation timings in
   `src/spriteConfig.ts`.

Preview and debug on the test page: run `npm run dev` and open
`http://localhost:5173/pet-test` (bypasses login; has reset / make-sad
buttons).

## Licensing

Only use CC0 / CC-BY assets (check the source when downloading, e.g.
itch.io or OpenGameArt). Do not use sprites ripped from commercial games.
