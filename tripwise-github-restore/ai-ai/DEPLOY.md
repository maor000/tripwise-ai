# Deploy TripWise AI As A Real Website

The project is ready for Vercel deployment.

## Recommended Path

1. Create a free Vercel account: https://vercel.com
2. Create a new project.
3. Upload/import this project folder.
4. Add these Environment Variables in Vercel:
   - `TRAVELPAYOUTS_TOKEN`
   - `TRAVELPAYOUTS_MARKER`
   - `TRAVELPAYOUTS_DEFAULT_ORIGIN`
   - `TRAVELPAYOUTS_AFFILIATE_BASE_URL`
   - `HOLIDAYFINDER_API_BASE_URL`
   - `HOLIDAYFINDER_API_KEY`
   - `HOLIDAYFINDER_SEARCH_PATH`
   - `KAYAK_API_BASE_URL`
   - `KAYAK_API_KEY`
   - `KAYAK_SEARCH_PATH`
   - `VIATOR_API_BASE_URL`
   - `VIATOR_API_KEY`
   - `VIATOR_SEARCH_PATH`
5. Deploy.
6. Connect a domain, for example `tripwise.co.il`.

## What Works After Deployment

- Public website over HTTPS.
- Installable PWA app.
- `/api/packages/search` serverless endpoint.
- Provider API keys stay secret on the server.
- No mock packages are shown.

## Important

Do not put API keys in frontend files like `app.js`, `index.html`, or `manifest.webmanifest`.
Provider keys must stay in Vercel Environment Variables or another secure hosting secret manager.
