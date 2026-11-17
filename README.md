# Point Club Cinema 🎬🍿

Planning poker with a movie theater theme. One permanent room link, no logins, characters, sound, a 3‑2‑1 projector reveal, and a Film Vault that keeps every sprint.

## Try it locally (demo mode)
```bash
npm install
npm run dev
```
Open the printed address and click **Open a new theater**. To play as several people in one browser, open the same link in more tabs with `&p=2`, `&p=3` and so on added to the end.

Without Supabase keys, the app runs in **demo mode**: tabs in one browser share the room, and nobody else can join.

## Share with the team (Supabase + Vercel)
1. Create a Supabase project and run `supabase/migrations/001_init.sql` in its SQL editor.
2. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Set the same two values in Vercel.
3. Deploy to Vercel (`npm run build` → `dist/`).

## How a session goes
- **Lobby:** pick a character and type a first name. Next time the same browser gets "Welcome back" with three buttons: *Take my seat*, *I'm away*, *Not me / remove*.
- **Load stories (host):** paste or drop a screenshot of the ADO board. It's read in the browser (Tesseract.js) and never uploaded. Fix the table, set the ADO link pattern once (`…/_workitems/edit/{id}`), then add the stories.
- **Vote → Roll the reveal:** a countdown plays, then the cards flip.
  - 🏆 **Blockbuster:** everyone agrees. Fanfare and popcorn.
  - ⭐ **Critics' Choice:** the votes are on neighbouring cards.
  - 🌀 **Plot Twist:** the votes are 2+ cards apart. The high and low voters get a spotlight.
- **Lock it in** a number (the crowd pick is highlighted), or start a revote (*Take 2*).
- Click a teammate's seat to throw 🍿🍅⭐🌹 at them.
- **Wrap sprint** rolls closing credits for everyone (awards: Sharpshooter, Most Contrarian, Coffee Break MVP) and saves the sprint to the **Film Vault** (posters, velocity chart, every vote, CSV export).
- **Open in ADO ↗** opens the story in a side window, where you're already signed in through the VPN. ADO doesn't allow itself to be shown inside other sites.

## Notes
- The room is open to anyone with the link, by design. The only data stored is story numbers, titles, ADO links, first names and votes.
- The characters are emoji placeholders for now. Add a portrait by setting `image` in `src/lib/cast.ts`.
- `npm test` runs the consensus and screenshot-parser tests.
