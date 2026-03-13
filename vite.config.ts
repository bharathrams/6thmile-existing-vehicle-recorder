import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import Database from 'better-sqlite3';
import fs from 'fs';

function getDb() {
  const dbPath = path.resolve(__dirname, 'data', 'jobcards.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT,
      date TEXT,
      mobile_number TEXT,
      address TEXT,
      vin_number TEXT,
      delivery_date TEXT,
      vehicle_make TEXT,
      registration_number TEXT,
      work_done_by TEXT,
      km_reading TEXT,
      material_total TEXT,
      labour_total TEXT,
      grand_total TEXT,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS job_card_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_card_id INTEGER NOT NULL,
      sl_no TEXT,
      description TEXT,
      quantity TEXT,
      material_cost TEXT,
      labour_cost TEXT,
      FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
    );
  `);
  return db;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString();
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'sqlite-api',
        configureServer(server) {
          // POST /api/job-cards — save a job card
          server.middlewares.use('/api/job-cards', async (req: IncomingMessage, res: ServerResponse) => {
            const db = getDb();

            try {
              if (req.method === 'POST') {
                const body = JSON.parse(await readBody(req));
                const d = body.job_card_details;
                const t = body.totals;

                const insert = db.prepare(`
                  INSERT INTO job_cards (customer_name, date, mobile_number, address, vin_number,
                    delivery_date, vehicle_make, registration_number, work_done_by, km_reading,
                    material_total, labour_total, grand_total, submitted_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                const insertItem = db.prepare(`
                  INSERT INTO job_card_items (job_card_id, sl_no, description, quantity, material_cost, labour_cost)
                  VALUES (?, ?, ?, ?, ?, ?)
                `);

                const result = db.transaction(() => {
                  const info = insert.run(
                    d.customer_name, d.date, d.mobile_number, d.address, d.vin_number,
                    d.delivery_date, d.vehicle_make, d.registration_number, d.work_done_by, d.km_reading,
                    t.material_total, t.labour_total, t.grand_total,
                    body.submitted_at || new Date().toISOString()
                  );
                  const jobCardId = info.lastInsertRowid;
                  for (const item of body.items || []) {
                    insertItem.run(jobCardId, item.sl_no, item.description, item.quantity, item.material_cost, item.labour_cost);
                  }
                  return jobCardId;
                })();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, id: result, message: 'Job card saved to database' }));

              } else if (req.method === 'GET') {
                const cards = db.prepare(`SELECT * FROM job_cards ORDER BY id DESC`).all();
                for (const card of cards as any[]) {
                  card.items = db.prepare(`SELECT * FROM job_card_items WHERE job_card_id = ?`).all(card.id);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(cards));

              } else {
                res.writeHead(405, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Method not allowed' }));
              }
            } catch (err: any) {
              console.error('[sqlite-api] Error:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            } finally {
              db.close();
            }
          });
        },
      },
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
