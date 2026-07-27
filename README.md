# GoalGetter — Duo Quest ⚔️

A motivational, gamified point tracker for two players working toward a shared goal.

Log positive activities by **quantity** — minutes exercised, pages read, meals eaten —
and each activity's points-per-unit converts that into points. Penalties (alcohol,
eating out, junk food…) subtract from the team total. Every positive activity has its
own point target, and all targets add up to the team goal shown in the big progress ring.

## Features

- **Quantity-based logging** — enter 30 min of exercise or 20 pages read; points = quantity × pts/unit.
- **Team goal ring** — see at a glance how far you are from the objective, with points remaining.
- **Per-activity targets** — each activity has its own progress bar contributing to the total.
- **Two players** — individual scores, daily streaks, and a crown for the leader.
- **Penalties** — negative activities subtract from the team total.
- **Gamification** — team levels with titles, 10 achievements, confetti at 25/50/75/100% milestones.
- **Activity feed** — recent history with one-click undo.
- **Fully configurable** — edit players, activities, units, pts/unit and targets in Settings.
- **Shared data via API** — an Express server stores everything in `server/data.json`, so both
  players see the same state (screens auto-refresh every 5 s), and you can log points from
  scripts, shortcuts or other devices.

## Running

```sh
npm install
npm run dev      # API server on :3001 + web app on :5173 (with /api proxy)
```

Production: `npm run build` then `npm start` — one process serves both the app and the API
on http://localhost:3001.

## API

Base URL: `http://localhost:3001` (or `:5173/api/...` through the dev proxy). CORS is open.

| Method | Path | Body | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/state` | — | Full state: players, activities, log |
| POST | `/api/log` | `{"playerId": "p1", "activityId": "exercise", "quantity": 30}` | Log a quantity; returns the created entry with computed points |
| DELETE | `/api/log/:id` | — | Undo a log entry |
| PUT | `/api/settings` | `{"players": [...], "activities": [...]}` | Replace players and/or activities |
| POST | `/api/reset` | — | Clear all logged progress |

Example — log 30 minutes of exercise for player 1:

```sh
curl -X POST http://localhost:3001/api/log \
  -H "Content-Type: application/json" \
  -d '{"playerId": "p1", "activityId": "exercise", "quantity": 30}'
```

Activity ids are visible in `GET /api/state`. Defaults: `exercise` (min, 0.5 pts/min,
target 400), `reading` (pages, 0.5 pts/page, target 200), and the penalties `alcohol`
(drinks, −4) and `eating-out` (times, −5). Add more in Settings or via `PUT /api/settings`.

## Notes

- The team goal is the sum of all activity targets — change targets in Settings to change the goal.
- Points-per-unit can be edited any time; past log entries keep the points they were logged with.
- Data lives in `server/data.json` — back it up or delete it to start over.
