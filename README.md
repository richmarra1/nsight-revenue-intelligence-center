# NSIGHT Revenue Intelligence Center

Real Next.js build with live Claude API calls and real Gmail send (no compose-window handoff, actually lands in the inbox).

## Local setup

1. Copy the environment template:
   ```
   copy .env.local.example .env.local
   ```

2. Open `.env.local` in Notepad and fill in the real values:
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — from your downloaded `client_secret_...json` file
   - `GOOGLE_REFRESH_TOKEN` — the token printed by `get-refresh-token.js`
   - `RECIPIENT_EMAIL` — who the brief gets sent to
   - `ANTHROPIC_API_KEY` — your Anthropic API key (console.anthropic.com)

3. Install dependencies:
   ```
   npm install
   ```

4. Run locally:
   ```
   npm run dev
   ```

5. Open http://localhost:3000 in your browser.

## Important

- `.env.local` is in `.gitignore` and will never be committed to GitHub.
- The Gmail refresh token was minted while the OAuth app is in "Testing" mode. Test the real send soon after setup rather than letting it sit for days unused.
- When you deploy to Vercel, you'll add these same five values as Environment Variables in the Vercel project settings, not in any committed file.
