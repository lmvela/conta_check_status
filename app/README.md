# File Status Grid Web App (Multi-Folder, 3 Tabs)

A one-page web application that scans configured folders (and their subfolders) for files following a pattern and displays a monthly status grid. The UI provides three tabs that render the same grid logic for different folders.

- Tabs:
  - Main Files Status Grid
  - Support Files Status Grid
  - Periodic Invoices Status Grid

Each tab reads a different configured folder.

## Features

- Scans a folder and all subfolders for files named as `YYYYMM_Description.ext`
  - Examples: `202401_sales.csv`, `202312_Receipts_January.pdf`, `202402_Invoices_Company____v2.xlsx`
- Valid extensions: `txt`, `csv`, `pdf`, `png`, `jpg`, `jpeg`, `bmp`, `xls`, `xlsx`
- Dynamically creates columns for each unique `Description` found in filenames
- Displays a grid:
  - Rows: months (oldest at bottom, newest at top; grid is rendered newest first)
  - Columns: `Description` values
- Icons:
  - ✔️ one file present
  - ❌ no file
  - ⚠️ multiple files
- Hover over ✔️ or ⚠️ to view the file path(s)
- For ✔️:
  - Text/CSV/PDF/Image: opens a viewer in a new tab
  - Excel (.xls, .xlsx): downloads a copy marked `_readonly`
- Shows a list of unprocessed files at the end (invalid format or extension)
- Modern UI with dark theme and tab bar
- Title displays active tab and number of rows

## Tabs and API

- The frontend has a tab bar (Main, Support, Periodic).
- Clicking a tab loads data from the same endpoint with a query parameter:
  - GET `/api/status?type=main|support|periodic`
  - Default: `type=main`

Response JSON shape (unchanged across tabs):
```json
{
  "months": ["202401", "202402", "..."],
  "columns": [{ "key": "Sales", "label": "Sales" }, "..."],
  "grid": [
    {
      "month": "202401",
      "Sales": { "count": 1, "paths": ["..."], "exts": ["csv"] },
      "Receipts": { "count": 0, "paths": [], "exts": [] }
    }
  ],
  "unprocessedFiles": ["..."]
}
```

## File Viewer

- Supported in-browser views:
  - `.txt`, `.csv` (text)
  - `.pdf` (embedded)
  - `.png`, `.jpg`, `.jpeg`, `.bmp` (image)
- Excel `.xls`/`.xlsx`: offered as download (`_readonly` suffix)

Security: The backend only serves/view files located inside any of the configured data roots (Main/Support/Periodic).

## Configuration

Edit `config/config.json`. Example:

```json
{
  "folderPath": "../data",
  "logPath": "../log",
  "mainFolderPath": "../data",
  "supportFolderPath": "../data/support",
  "periodicFolderPath": "../data/periodic"
}
```

- mainFolderPath: Folder for the Main tab
- supportFolderPath: Folder for the Support tab
- periodicFolderPath: Folder for the Periodic tab
- logPath: Directory where `main.log` is written
- folderPath: Legacy key retained for compatibility; the app uses the three specific keys above. If present, it may mirror `mainFolderPath`.

Notes:
- Relative paths are resolved on the server side.
- The server auto-creates `config/config.json` with sensible defaults if it does not exist.

## Setup

1) Install dependencies:
```
npm install
```

2) Start the server:
```
npm start
```

3) Visit:
- http://localhost:9000

4) Place files in the configured folders (Main/Support/Periodic) following the naming pattern.

## File Pattern

- Name files as: `YYYYMM_Description.ext`
  - `YYYYMM`: year+month (6 digits)
  - `Description`: free text used as a column name (may include underscores)
  - `ext`: one of `txt,csv,pdf,png,jpg,jpeg,bmp,xls,xlsx`
- Files not matching the pattern or extension are listed as “Unprocessed Files”.

## Deployment under a subpath

Frontend links respect a base path when served under `/conta_check_docs`. If deploying behind a reverse proxy with that subpath, the UI will adapt its fetch and links.

## Project Structure

- `server.js` — Node.js/Express backend
  - GET `/api/status?type=main|support|periodic`
  - GET `/view?file=...` (HTML viewer)
  - GET `/file?file=...` (raw file for embedding/downloading)
- `public/` — Frontend assets (HTML, JS, CSS)
- `config/config.json` — Configuration
- `data/` — Example location for your files (match the configured folders)
- `log/` — Log output directory (configurable via `logPath`)

## License

MIT
