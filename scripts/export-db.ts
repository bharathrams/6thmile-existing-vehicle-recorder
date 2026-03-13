/**
 * Export SQLite job card data to JSON or CSV for seeding another database.
 *
 * Usage:
 *   npx tsx scripts/export-db.ts              # JSON to stdout
 *   npx tsx scripts/export-db.ts --csv        # CSV to stdout
 *   npx tsx scripts/export-db.ts > dump.json  # save to file
 */
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '..', 'data', 'jobcards.db');
const db = new Database(dbPath, { readonly: true });

const cards = db.prepare('SELECT * FROM job_cards ORDER BY id').all() as any[];
for (const card of cards) {
  card.items = db.prepare('SELECT sl_no, description, quantity, material_cost, labour_cost FROM job_card_items WHERE job_card_id = ?').all(card.id);
}

const csv = process.argv.includes('--csv');

if (csv) {
  // Flat CSV: one row per item, job card fields repeated
  const headers = [
    'id', 'customer_name', 'date', 'mobile_number', 'address', 'vin_number',
    'delivery_date', 'vehicle_make', 'registration_number', 'work_done_by', 'km_reading',
    'material_total', 'labour_total', 'grand_total', 'submitted_at',
    'sl_no', 'description', 'quantity', 'material_cost', 'labour_cost',
  ];
  console.log(headers.join(','));
  for (const card of cards) {
    const base = headers.slice(0, 15).map(h => `"${(card[h] ?? '').toString().replace(/"/g, '""')}"`);
    if (card.items.length === 0) {
      console.log([...base, '', '', '', '', ''].join(','));
    } else {
      for (const item of card.items) {
        const itemCols = ['sl_no', 'description', 'quantity', 'material_cost', 'labour_cost']
          .map(h => `"${(item[h] ?? '').toString().replace(/"/g, '""')}"`);
        console.log([...base, ...itemCols].join(','));
      }
    }
  }
} else {
  console.log(JSON.stringify(cards, null, 2));
}

db.close();
