# Wan Shi Tong

Personal offline media library. Books and movies live in local records you own and back up however you want. Optional links to IMDb, TMDb, and similar sites are just references — lookup never depends on those services being up.

Labels, search, grouping. Sort A–Z or by release date.

## How it works

One JSON file on disk. Each record is local; nothing is fetched at runtime. Open Library and TMDb are optional import sources when adding an item. Optional GitHub Gist sync can copy the file when you want it.

`external_url` is optional. Movies can point at IMDb or [TMDb](https://www.themoviedb.org/). Books point at [Open Library](https://openlibrary.org) (open catalog, work/edition IDs — the IMDb analogue that is not a walled garden). IDs (`imdb_id`, `tmdb_id`, `openlibrary_id`, `isbn`) stay even if the URL changes.

Fields for search, grouping, and lists:

| Field | Why |
| --- | --- |
| `kind` (`movie` \| `book`) | Group and filter |
| `name`, `title`, `original_title` | Search and A–Z |
| `creators` | Search by author / director |
| `series`, `series_index` | Group a franchise / book series |
| `labels` | User grouping |
| `completed` | Read / watched status; defaults to `true` |
| `language` | Filter mixed libraries |
| `release_date` | Date sort |
| `description` | Search body |
| `imdb_id` / `tmdb_id` / `openlibrary_id` / `isbn` | Exact lookup |
| `external_url` | Optional outbound link |
| `image_path` | Local poster for lists (`image_url` is optional source) |

## Interface

The JSON file is the API. Any UI can read and write it — browser, native, CLI, a text editor.

Sync is whoever copies that file: optional GitHub Gist sync, a private repo, S3, a USB stick. Online hosts are optional backups, not a runtime dependency.

## Run

```sh
make -C frontend serve
```

Requires `python3`. Open [http://localhost:9999/frontend/](http://localhost:9999/frontend/). A local server lets the browser load `library.json`; browsers block that request when the page is opened with `file://`.
