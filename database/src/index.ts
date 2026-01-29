import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import tables from "./routes/tables";

const app = new Hono();

app.use("*", cors());

app.route("/api/tables", tables);

app.get("/style.css", serveStatic({ path: "./public/style.css" }));
app.get("/app.js", serveStatic({ path: "./public/app.js" }));
app.get("/", serveStatic({ path: "./public/index.html" }));

const port = process.env.PORT || 3000;
console.log(`Server running at http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
