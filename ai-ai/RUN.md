# Running TripWise AI

This build is real-provider-only. It does not contain demo travel packages.

## 1. Add Provider Keys

Copy `.env.example` to `.env`, then fill only official provider credentials.

```bash
copy .env.example .env
```

You can also set the same variables directly in your hosting provider.

HolidayFinder requires an official API, data feed, affiliate endpoint, or written partner agreement. Do not scrape their public website.

## 2. Start The Website And API

If Node is available:

```bash
node server.mjs
```

If Node is blocked on Windows, use the local PowerShell server:

```powershell
powershell -ExecutionPolicy Bypass -File .\local-server.ps1
```

Then open:

```text
http://127.0.0.1:4173
```

## 3. Expected Flow

- The frontend posts to `/api/packages/search`.
- The server calls only configured official providers.
- If no provider keys are configured, the response is empty.
- The frontend shows that no live provider is connected instead of inventing packages.
