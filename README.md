# Point Club 🃏

Planning poker styled as a bright heist movie. One permanent room link, no logins, characters, sound, a 3‑2‑1 card reveal, and a Case Files that keeps every sprint.

## Try it locally (demo mode)
```bash
npm install
npm run dev
```
Open the printed address and click **Open a new table**. To play as several people in one browser, open the same link in more tabs with `&p=2`, `&p=3` and so on added to the end.

Without Supabase keys, the app runs in **demo mode**: tabs in one browser share the room, and nobody else can join.

## Share with the team (Vercel + Neon, both free)
1. Import this repo into Vercel.
2. In the Vercel project, open **Storage**, connect **Neon** (sets `DATABASE_URL`), and add the env var `VITE_BACKEND=api`.
3. Deploy. The API creates its tables on first use (`db/schema.sql`), so there's no manual database step.

Each screen checks the server for changes about once a second (every 3 s after two quiet minutes, every 5 s in a background tab).

To test team mode locally without Vercel, run `npm run dev:api`. It serves the same API on an in-memory Postgres; open the room in several browsers or profiles.

## How a session goes
- **Lobby:** pick a character and type a first name. Next time the same browser gets "Welcome back" with three buttons: *Take my seat*, *I'm away*, *Not me / remove*.
- **Load stories (host):** paste or drop a screenshot of the ADO board. It's read in the browser (Tesseract.js) and never uploaded. Fix the table, set the ADO link pattern once (`…/_workitems/edit/{id}`), then add the stories.
- **Vote → Roll the reveal:** a countdown plays, then the cards flip.
  - ✅ **Clean job:** everyone agrees. Money rain.
  - 🤝 **Close enough:** the votes are on neighbouring cards.
  - ⚠️ **Compromised:** the votes are 2+ cards apart. The high and low voters get a spotlight.
- **Lock it in** a number (the crowd pick is highlighted), or start a revote (*Take 2*).
- Click a teammate's seat to throw 💵🪙🍅🌹 at them.
- **Wrap the job** shows "The Take" for everyone (awards: Sharpshooter, Most Contrarian, Coffee Break MVP) and saves the sprint to the **Case Files** (posters, velocity chart, every vote, CSV export).
- **Open in ADO ↗** opens the story in a side window, where you're already signed in through the VPN. ADO doesn't allow itself to be shown inside other sites.

## Notes
- The room is open to anyone with the link, by design. The only data stored is story numbers, titles, ADO links, first names and votes.
- Crew portraits (original, AI-generated with Higgsfield) live in `public/cast/<id>.jpg`. Replace a file to change a face; a missing file falls back to initials.
- `npm test` runs the consensus, screenshot-parser and room-API tests (the API tests use an in-memory Postgres).
