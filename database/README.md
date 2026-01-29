# Database Tool

A simple database management tool inspired by MS Access and Baserow. Create tables, define schemas, and manage data through a web interface.

## Features

- Create and delete tables with custom schemas
- Define columns with types: Text, Integer, Real, Boolean
- Add, update, and delete rows
- View data in a spreadsheet-like interface
- RESTful API for all operations
- SQLite storage for persistence

## Tech Stack

- Runtime: [Bun](https://bun.sh)
- Language: TypeScript
- Web Framework: [Hono](https://hono.dev)
- Database: SQLite (via `bun:sqlite`)
- Frontend: Vanilla HTML/CSS/JavaScript

## Getting Started

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun run dev
```

Or run in production mode:

```bash
bun run start
```

The app will be available at http://localhost:3000

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tables` | List all tables |
| POST | `/api/tables` | Create a new table |
| DELETE | `/api/tables/:name` | Delete a table |
| GET | `/api/tables/:name/schema` | Get table schema |
| GET | `/api/tables/:name/rows` | Get all rows |
| POST | `/api/tables/:name/rows` | Add a row |
| PUT | `/api/tables/:name/rows/:id` | Update a row |
| DELETE | `/api/tables/:name/rows/:id` | Delete a row |

## Project Structure

```
database/
├── public/
│   ├── index.html      # Frontend HTML entry point
│   ├── app.js          # Frontend application logic
│   └── style.css       # Frontend styles
├── src/
│   ├── db/
│   │   └── index.ts    # SQLite database setup
│   ├── routes/
│   │   └── tables.ts   # API routes
│   ├── types/
│   │   └── index.ts    # TypeScript types
│   └── index.ts        # Server entry point
├── data.db             # SQLite database (created on first run)
└── package.json
```
