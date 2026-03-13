# 6thMile - Existing Vehicle Recorder

Workshop job card data extraction app. Upload images of handwritten/printed job cards and extract structured data using Gemini AI vision. Data is stored locally in SQLite.

## Features

- Image upload (JPEG, PNG, WebP) with drag-and-drop
- AI-powered data extraction from job card images via Google Gemini
- Editable table view for reviewing and correcting extracted data
- Local SQLite database storage
- Download as Excel or JSON
- Export script for seeding other databases

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Vite
- **AI:** Google Gemini (`@google/genai`)
- **Database:** SQLite (`better-sqlite3`)
- **Animation:** Motion (Framer Motion)

## Setup

**Prerequisites:** Node.js (v18+)

1. Clone and switch to develop branch:
   ```bash
   git clone https://github.com/bharathrams/6thmile-existing-vehicle-recorder.git
   cd 6thmile-existing-vehicle-recorder
   git checkout develop
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

4. Run the app:
   ```bash
   npm run dev
   ```

## Database

Job card data is stored in `data/jobcards.db` (auto-created on first submit).

### Tables

- **job_cards** — customer details, vehicle info, totals
- **job_card_items** — line items (description, quantity, costs)

### Export Data

```bash
npx tsx scripts/export-db.ts              # JSON to stdout
npx tsx scripts/export-db.ts --csv        # CSV to stdout
npx tsx scripts/export-db.ts > dump.json  # save to file
```

## Branch Strategy

- `main` — production (empty until first release)
- `develop` — active development
