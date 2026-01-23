import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";

// Initialize SQLite database
const db = new Database("todos.db");

// Create todos table
db.run(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    sort_order INTEGER DEFAULT 0
  )
`);

// Add sort_order column if it doesn't exist (migration for existing databases)
try {
  db.run(`ALTER TABLE todos ADD COLUMN sort_order INTEGER DEFAULT 0`);
} catch (e) {
  // Column already exists
}

// Prepared statements
const getAllTodos = db.query("SELECT * FROM todos ORDER BY sort_order ASC, created_at DESC");
const getTodoById = db.query("SELECT * FROM todos WHERE id = ?");
const getMaxSortOrder = db.query("SELECT COALESCE(MAX(sort_order), 0) as max_order FROM todos");
const insertTodo = db.prepare("INSERT INTO todos (title, sort_order) VALUES (?, ?) RETURNING *");
const updateTodo = db.query("UPDATE todos SET title = ?, completed = ? WHERE id = ? RETURNING *");
const updateSortOrder = db.prepare("UPDATE todos SET sort_order = ? WHERE id = ?");
const deleteTodo = db.query("DELETE FROM todos WHERE id = ?");

interface Todo {
  id: number;
  title: string;
  completed: number;
  created_at: string;
}

interface TodoWithTags extends Todo {
  tags: string[];
}

function extractTags(title: string): string[] {
  const matches = title.match(/#[a-zA-Z0-9_-]+/g);
  return matches ? matches.map(tag => tag.slice(1)) : [];
}

function addTagsToTodo(todo: Todo): TodoWithTags {
  return { ...todo, tags: extractTags(todo.title) };
}

// Serve static files and API
const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // API routes
    if (path.startsWith("/api/todos")) {
      // GET /api/todos - List all todos
      if (req.method === "GET" && path === "/api/todos") {
        const todos = getAllTodos.all() as Todo[];
        const todosWithTags = todos.map(addTagsToTodo);

        const tagFilter = url.searchParams.get("tag");
        if (tagFilter) {
          const filtered = todosWithTags.filter(todo =>
            todo.tags.includes(tagFilter)
          );
          return Response.json(filtered);
        }

        return Response.json(todosWithTags);
      }

      // POST /api/todos - Create a new todo
      if (req.method === "POST" && path === "/api/todos") {
        const body = (await req.json()) as { title?: string };
        if (!body.title || typeof body.title !== "string") {
          return Response.json({ error: "Title is required" }, { status: 400 });
        }
        const maxOrder = (getMaxSortOrder.get() as { max_order: number }).max_order;
        const todo = insertTodo.get(body.title.trim(), maxOrder + 1) as Todo;
        return Response.json(addTagsToTodo(todo), { status: 201 });
      }

      // PUT /api/todos/reorder - Reorder todos
      if (req.method === "PUT" && path === "/api/todos/reorder") {
        const body = (await req.json()) as { orderedIds?: number[] };
        if (!body.orderedIds || !Array.isArray(body.orderedIds)) {
          return Response.json({ error: "orderedIds array is required" }, { status: 400 });
        }
        body.orderedIds.forEach((id, index) => {
          updateSortOrder.run(index, id);
        });
        return Response.json({ success: true });
      }

      // Match /api/todos/:id
      const idMatch = path.match(/^\/api\/todos\/(\d+)$/);
      if (idMatch && idMatch[1]) {
        const id = parseInt(idMatch[1], 10);

        // GET /api/todos/:id
        if (req.method === "GET") {
          const todo = getTodoById.get(id) as Todo | null;
          if (!todo) {
            return Response.json({ error: "Todo not found" }, { status: 404 });
          }
          return Response.json(addTagsToTodo(todo));
        }

        // PUT /api/todos/:id - Update a todo
        if (req.method === "PUT") {
          const existing = getTodoById.get(id) as Todo | null;
          if (!existing) {
            return Response.json({ error: "Todo not found" }, { status: 404 });
          }
          const body = (await req.json()) as { title?: string; completed?: boolean };
          const title = body.title ?? existing.title;
          const completed = body.completed !== undefined ? (body.completed ? 1 : 0) : existing.completed;
          const todo = updateTodo.get(title, completed, id) as Todo;
          return Response.json(addTagsToTodo(todo));
        }

        // DELETE /api/todos/:id
        if (req.method === "DELETE") {
          const existing = getTodoById.get(id) as Todo | null;
          if (!existing) {
            return Response.json({ error: "Todo not found" }, { status: 404 });
          }
          deleteTodo.run(id);
          return new Response(null, { status: 204 });
        }
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Serve static files
    if (path === "/" || path === "/index.html") {
      const html = readFileSync(join(import.meta.dir, "public/index.html"), "utf-8");
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (path === "/style.css") {
      const css = readFileSync(join(import.meta.dir, "public/style.css"), "utf-8");
      return new Response(css, {
        headers: { "Content-Type": "text/css" },
      });
    }

    if (path === "/app.js") {
      const js = readFileSync(join(import.meta.dir, "public/app.js"), "utf-8");
      return new Response(js, {
        headers: { "Content-Type": "application/javascript" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Todo app running at http://localhost:${server.port}`);
