import { Database } from "bun:sqlite";

const db = new Database("data.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS _tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS _columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    position INTEGER NOT NULL,
    FOREIGN KEY (table_id) REFERENCES _tables(id) ON DELETE CASCADE,
    UNIQUE(table_id, name)
  );
`);

export default db;
