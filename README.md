# Boardmark

A small personal tracker for boarding stays and bill days. Built with Next.js, Lucide React, and shadcn-style Button and Dialog components.

## How it works

- Electric starts on the 1st and water on the 7th by default. Set each cycle start day and optional daily rate separately in Settings.
- Mark check-in when you arrive and check-out when you leave. Exact times are saved.
- A stay of 12 hours or less counts as 0 days. A longer stay rounds up to the next full 24-hour day: 12 hours 1 minute is 1 day, and 24 hours 1 minute is 2 days.
- Each billable day belongs to the bill cycle containing the start of its 24-hour block. This avoids double counting when a stay crosses a bill boundary.
- Review electric and water totals for current or earlier cycles. Edit or add stays if you forgot to record one.
- Download a JSON backup before changing devices or browsers, and import it on the new one.

Boardmark saves data in browser local storage. Each browser/device has its own records; Vercel hosts the app, but does not store or sync your stays. No account or external database is needed.

Existing date-only records and version 1 backups are converted to midnight check-in/check-out times. You can edit them in Stay history if you know the actual times.

## Run locally

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

## Deploy on Vercel

Import this repository as a Next.js project in Vercel and deploy with the default settings. There are no environment variables or server data services to configure. Because records live in the browser, users should download a backup if they need to move devices or clear browser data.

## Install on iPhone

Deploy over HTTPS, then open the site in Safari and choose **Share → Add to Home Screen**. The Home Screen icon opens Boardmark in standalone mode. If you have existing records in Safari, use Settings to download a backup and import it in the installed app if its storage is separate on your iPhone.

The production app registers `/sw.js`. It stores the public app shell, icons, and versioned Next.js assets for offline launches. Your attendance records still use this device's local storage, so the existing check-in, check-out, and editing features work offline after the app has loaded. Other routes and any future server features require the network. The service worker does not queue writes or cache API responses. New deployments use the network for page navigation and refresh the saved shell and assets. Service-worker caching is disabled during local development.
