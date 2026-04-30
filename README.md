# VIBE Agenda — Netlify Database version

This version is ready for Netlify + Netlify Database/Postgres.

## Deploy

1. Upload/push this folder to GitHub.
2. In Netlify, create a new site from that GitHub repo.
3. Add/enable **Netlify Database** for the site.
4. Add an environment variable if needed:
   - `ADMIN_PIN=629122`
5. Deploy.

The app uses `process.env.NETLIFY_DATABASE_URL` automatically through `@netlify/neon`.

## Local test

```bash
npm install
npm run dev
```

Then open the URL shown by Netlify CLI.
