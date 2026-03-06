# Reward Point Lookup Web App

Simple web app to search a student by registration number and show:
- Balance Points
- Eligible Carry Forward Points

## Data Source
This app fetches from Google Sheet:
- Sheet ID: `1R8MCP0U2ZZ-ccD29jfw9Hd6BhyYu72cu_aKuDgB1X7M`
- Tab: `COMPLETE LIST`
- Endpoint: Google Visualization API (`gviz/tq?sheet=...&tqx=out:json`)

## Run
Use any static server (recommended):

```bash
npx serve .
```

Then open the printed local URL in your browser.

## Notes
- `ROLL NO.` is used as the registration number.
- `BALANCE POINTS` is shown directly.
- If a dedicated carry-forward column is not present in the tab, the app uses balance points as eligible carry-forward points and shows this in status text.
- Example tested reg no: `7376251EC298` (returns balance `662`).
