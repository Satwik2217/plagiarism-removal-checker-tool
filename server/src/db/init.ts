import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'plagiarism.db');

let db: SqlJsDatabase | null = null;
let dbPath: string = DB_PATH;

export async function initializeDatabase(customPath?: string): Promise<SqlJsDatabase> {
  if (db) return db;

  if (customPath) dbPath = customPath;

  const dir = dbPath.substring(0, dbPath.lastIndexOf('\\'));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS checks (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      filename TEXT,
      original_text TEXT NOT NULL,
      similarity REAL NOT NULL,
      matches TEXT NOT NULL,
      exported INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS corpus_papers (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      added_at TEXT DEFAULT CURRENT_TIMESTAMP,
      enabled INTEGER DEFAULT 1
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_checks_date ON checks(date DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_corpus_enabled ON corpus_papers(enabled)`);

  const defaults: Array<[string, string]> = [
    ['plagiarism_threshold', '15'],
    ['ngram_size', '5'],
    ['enable_web_check', 'false'],
    ['llm_provider', 'openai'],
    ['llm_model', 'gpt-3.5-turbo']
  ];

  for (const [key, value] of defaults) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  saveDatabase();
  console.log('Database initialized at', dbPath);
  return db;
}

export function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);
}

export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
  const results = queryAll<T>(sql, params);
  return results[0];
}

export function run(sql: string, params: any[] = []): void {
  const database = getDatabase();
  if (params.length > 0) {
    database.run(sql, params);
  } else {
    database.run(sql);
  }
  saveDatabase();
}