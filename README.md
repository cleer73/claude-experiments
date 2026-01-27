# Claude Experiments

A collection of experimental projects built with Claude assistance.

## Projects

### [Todo App](./todo/README.md)

A full-stack todo application built with Bun, TypeScript, and SQLite.

**Features:**
- Create, read, update, and delete todos
- Tag support using hashtags (e.g., `#work`, `#personal`)
- Filter todos by tag via sidebar navigation
- Drag-and-drop reordering with persistent sort order
- Inline editing (double-click to edit)
- SQLite database for persistent storage
- RESTful API

**Tech Stack:**
- Runtime: [Bun](https://bun.sh)
- Language: TypeScript
- Database: SQLite (via `bun:sqlite`)
- Frontend: Vanilla HTML/CSS/JavaScript

### [Database Tool](./database/README.md)

A simple database management tool inspired by MS Access and Baserow.

**Features:**
- Create and manage tables with custom schemas
- Support for Text, Integer, Real, and Boolean column types
- Add, edit, and delete rows through a web interface
- RESTful API for programmatic access

**Tech Stack:**
- Runtime: [Bun](https://bun.sh)
- Language: TypeScript
- Web Framework: [Hono](https://hono.dev)
- Database: SQLite (via `bun:sqlite`)
- Frontend: Vanilla HTML/CSS/JavaScript
