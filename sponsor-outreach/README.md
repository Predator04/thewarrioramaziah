# Warrior Sponsor Outreach

Local sponsor outreach tracker for Avishai "The Warrior" Amaziah.

Double-click `Start Sponsor Outreach.bat` to open it, or open `index.html` in a browser. The app stores sponsor leads in the browser using `localStorage`, so export CSV regularly as a backup.

## What it does

- Tracks Las Vegas sponsor leads by pipeline status.
- Stores contact info, notes, amount, and follow-up date.
- Generates email, DM, and follow-up message drafts.
- Searches Google Places for local businesses and imports good matches as leads.
- Filters Google results to businesses with websites, which is the best available path to finding real contact emails.
- Runs an automated sponsor search across sponsor-friendly categories like barbershops, gyms, restaurants, tattoo shops, car detail shops, recovery clinics, clothing brands, and churches.
- Auto-adds up to three website-backed leads per category, skips duplicates, and flags them as needing an email.
- Adds quick Google searches to help find a business email.
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

Google Places does not return business email addresses. Use the website-only filter, then click **Find Email** on a result to search for the best public contact email.

Use **Run Auto Search** when you want the app to work through the strongest local sponsor categories for you. It will only auto-add businesses with websites because that gives you a realistic path to finding a public contact email before sending outreach.

If the API search is not set up yet, use **Open Google Maps Search** to manually find businesses and add them yourself.

## Sponsor offer

Default sponsorship amount: `$1,500 per fight`.

Public sponsor page:

`https://thewarrioramaziah.com/sponsors.html`
