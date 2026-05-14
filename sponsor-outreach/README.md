# Warrior Sponsor Outreach

Local sponsor outreach tracker for Avishai "The Warrior" Amaziah.

Double-click `Start Sponsor Outreach.bat` to open it, or open `index.html` in a browser. The app stores sponsor leads in the browser using `localStorage`, so export CSV regularly as a backup.

## What it does

- Tracks Las Vegas sponsor leads by pipeline status.
- Stores contact info, notes, amount, and follow-up date.
- Generates email, DM, and follow-up message drafts.
- Searches Google Places for local businesses and imports good matches as leads.
- Copies the public sponsor page link.
- Exports and imports CSV.

## Google Places setup

To auto-populate local businesses, create a Google Cloud API key with **Places API (New)** enabled.

1. Go to Google Cloud Console.
2. Create or choose a project.
3. Enable **Places API (New)**.
4. Create an API key.
5. Paste the key into the `Google Places API Key` field in the app.

The key is saved only in your browser's local storage. Do not put API keys into GitHub.

If the API search is not set up yet, use **Open Google Maps Search** to manually find businesses and add them yourself.

## Sponsor offer

Default sponsorship amount: `$1,500 per fight`.

Public sponsor page:

`https://thewarrioramaziah.com/sponsors.html`
