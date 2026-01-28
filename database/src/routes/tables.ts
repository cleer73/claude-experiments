import { Hono } from "hono";
import db from "../db";
import type { TableMeta, ColumnMeta, CreateTableRequest } from "../types";

const tables = new Hono();

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

function quoteIdentifier(name: string): string {
  // Double any existing double quotes and wrap in double quotes
  return `"${name.replace(/"/g, '""')}"`;
}

function mapSqliteType(type: ColumnMeta["type"]): string {
  switch (type) {
    case "text":
      return "TEXT";
    case "integer":
      return "INTEGER";
    case "real":
      return "REAL";
    case "boolean":
      return "INTEGER";
    default:
      return "TEXT";
  }
}

// List all tables
tables.get("/", (c) => {
  const result = db.query("SELECT * FROM _tables ORDER BY name").all() as TableMeta[];
  return c.json(result);
});

// Get table schema
tables.get("/:name/schema", (c) => {
  const name = c.req.param("name");
  const table = db.query("SELECT * FROM _tables WHERE name = ?").get(name) as TableMeta | null;

  if (!table) {
    return c.json({ error: "Table not found" }, 404);
  }

  const columns = db
    .query("SELECT * FROM _columns WHERE table_id = ? ORDER BY position")
    .all(table.id) as ColumnMeta[];

  return c.json({ ...table, columns });
});

// Create a new table
tables.post("/", async (c) => {
  const body = await c.req.json<CreateTableRequest>();
  const safeName = sanitizeName(body.name);

  if (!safeName || safeName.startsWith("_")) {
    return c.json({ error: "Invalid table name" }, 400);
  }

  if (!body.columns || body.columns.length === 0) {
    return c.json({ error: "At least one column is required" }, 400);
  }

  try {
    db.exec("BEGIN TRANSACTION");

    db.query("INSERT INTO _tables (name) VALUES (?)").run(safeName);
    const tableResult = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
    const tableId = tableResult.id;

    const columnDefs = ['"id" INTEGER PRIMARY KEY AUTOINCREMENT'];

    for (let i = 0; i < body.columns.length; i++) {
      const col = body.columns[i];
      const safeColName = sanitizeName(col.name);
      const sqlType = mapSqliteType(col.type);

      columnDefs.push(`${quoteIdentifier(safeColName)} ${sqlType}`);

      db.query(
        "INSERT INTO _columns (table_id, name, type, position) VALUES (?, ?, ?, ?)"
      ).run(tableId, safeColName, col.type, i);
    }

    db.exec(`CREATE TABLE ${quoteIdentifier(safeName)} (${columnDefs.join(", ")})`);
    db.exec("COMMIT");

    return c.json({ success: true, name: safeName, id: tableId }, 201);
  } catch (error) {
    db.exec("ROLLBACK");
    return c.json({ error: String(error) }, 500);
  }
});

// Get all rows from a table
tables.get("/:name/rows", (c) => {
  const name = sanitizeName(c.req.param("name"));

  const table = db.query("SELECT * FROM _tables WHERE name = ?").get(name);
  if (!table) {
    return c.json({ error: "Table not found" }, 404);
  }

  try {
    const rows = db.query(`SELECT * FROM ${quoteIdentifier(name)}`).all();
    return c.json(rows);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Add a row to a table
tables.post("/:name/rows", async (c) => {
  const name = sanitizeName(c.req.param("name"));
  const body = await c.req.json<Record<string, unknown>>();

  const table = db.query("SELECT * FROM _tables WHERE name = ?").get(name) as TableMeta | null;
  if (!table) {
    return c.json({ error: "Table not found" }, 404);
  }

  const columns = db
    .query("SELECT name FROM _columns WHERE table_id = ?")
    .all(table.id) as { name: string }[];

  const validColumns = columns.map((c) => c.name);
  const insertColumns: string[] = [];
  const insertValues: unknown[] = [];

  for (const [key, value] of Object.entries(body)) {
    const safeKey = sanitizeName(key);
    if (validColumns.includes(safeKey)) {
      insertColumns.push(safeKey);
      insertValues.push(value);
    }
  }

  if (insertColumns.length === 0) {
    return c.json({ error: "No valid columns provided" }, 400);
  }

  try {
    const placeholders = insertColumns.map(() => "?").join(", ");
    const quotedColumns = insertColumns.map(quoteIdentifier).join(", ");
    db.query(
      `INSERT INTO ${quoteIdentifier(name)} (${quotedColumns}) VALUES (${placeholders})`
    ).run(...insertValues);

    const lastId = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
    return c.json({ success: true, id: lastId.id }, 201);
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Update a row
tables.put("/:name/rows/:id", async (c) => {
  const name = sanitizeName(c.req.param("name"));
  const rowId = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  const table = db.query("SELECT * FROM _tables WHERE name = ?").get(name) as TableMeta | null;
  if (!table) {
    return c.json({ error: "Table not found" }, 404);
  }

  const columns = db
    .query("SELECT name FROM _columns WHERE table_id = ?")
    .all(table.id) as { name: string }[];

  const validColumns = columns.map((c) => c.name);
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(body)) {
    const safeKey = sanitizeName(key);
    if (validColumns.includes(safeKey)) {
      updates.push(`${quoteIdentifier(safeKey)} = ?`);
      values.push(value);
    }
  }

  if (updates.length === 0) {
    return c.json({ error: "No valid columns provided" }, 400);
  }

  values.push(rowId);

  try {
    db.query(`UPDATE ${quoteIdentifier(name)} SET ${updates.join(", ")} WHERE "id" = ?`).run(...values);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Delete a row
tables.delete("/:name/rows/:id", (c) => {
  const name = sanitizeName(c.req.param("name"));
  const rowId = c.req.param("id");

  const table = db.query("SELECT * FROM _tables WHERE name = ?").get(name);
  if (!table) {
    return c.json({ error: "Table not found" }, 404);
  }

  try {
    db.query(`DELETE FROM ${quoteIdentifier(name)} WHERE "id" = ?`).run(rowId);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Delete a table
tables.delete("/:name", (c) => {
  const name = sanitizeName(c.req.param("name"));

  const table = db.query("SELECT * FROM _tables WHERE name = ?").get(name) as TableMeta | null;
  if (!table) {
    return c.json({ error: "Table not found" }, 404);
  }

  try {
    db.exec("BEGIN TRANSACTION");
    db.query("DELETE FROM _columns WHERE table_id = ?").run(table.id);
    db.query("DELETE FROM _tables WHERE id = ?").run(table.id);
    db.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(name)}`);
    db.exec("COMMIT");
    return c.json({ success: true });
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Ignore rollback errors to avoid masking the original error
    }
    return c.json({ error: String(error) }, 500);
  }
});

export default tables;
