# Wan Shi Tong

Personal offline media library. Books and movies live in local records you own and back up however you want. Optional links to IMDb and similar sites are just references — lookup never depends on those services being up.

Labels, search, grouping. Sort A–Z or by release date.

## How it works

One JSON file on disk. Each record is local; nothing is fetched at runtime.

`external_url` is optional. Movies point at IMDb. Books point at [Open Library](https://openlibrary.org) (open catalog, work/edition IDs — the IMDb analogue that is not a walled garden). IDs (`imdb_id`, `openlibrary_id`, `isbn`) stay even if the URL changes.

Fields for search, grouping, and lists:

| Field | Why |
| --- | --- |
| `kind` (`movie` \| `book`) | Group and filter |
| `name`, `title`, `original_title` | Search and A–Z |
| `creators` | Search by author / director |
| `series`, `series_index` | Group a franchise / book series |
| `labels` | User grouping |
| `language` | Filter mixed libraries |
| `release_date` | Date sort |
| `description` | Search body |
| `imdb_id` / `openlibrary_id` / `isbn` | Exact lookup |
| `external_url` | Optional outbound link |
| `image_path` | Local poster for lists (`image_url` is optional source) |

## Interface

The JSON file is the API. Any UI can read and write it — browser, native, CLI, a text editor.

Sync is whoever copies that file: a secret GitHub gist, a private repo, S3, a USB stick. The library does not own sync. Online hosts are optional backups, not a runtime dependency.
