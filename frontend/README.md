# Frontend (Alpine.js + Tailwind CSS)

Static single-page interface for Wan Shi Tong. Runs directly in any web browser without a backend server or build pipeline.

## Tech Stack

- **HTML5**: Standard markup structure.
- **Alpine.js**: Lightweight reactive UI state and client-side logic loaded via CDN (`unpkg.com`).
- **Tailwind CSS**: Utility-first styling loaded via CDN script (`cdn.tailwindcss.com` or `unpkg.com`).

Dependencies are loaded over CDN with standard browser caching, requiring zero local build tools, Node.js packages, or local dev servers.

## Features

- **Database Loading**: Automatically attempts to fetch `library.json` from the root on startup. If unavailable (or when opened directly via file protocol without fetch permissions), fallback to manual file selection (`<input type="file">`) or drag-and-drop.
- **Full Search**: Filter items across `title`, `name`, `original_title`, `creators`, `description`, `labels`, and identifiers (`imdb_id`, `openlibrary_id`, `isbn`).
- **Filtering & Grouping**:
  - Filter by `kind` (`movie`, `book`, or all).
  - Filter by `labels`.
  - Filter / group by `series`.
  - Filter by `language`.
- **Sorting**:
  - Alphabetical (A–Z, Z–A) by title/name.
  - Release date (newest first, oldest first).
  - Series index.
- **Pagination**: Configurable page intervals (e.g. 12, 24, 48 items per page) with page navigation controls.
- **Item Details & Media Cards**: Grid and list display cards showing local poster (`image_path` or fallback `image_url`), metadata tags, creator info, and optional outbound reference links.
