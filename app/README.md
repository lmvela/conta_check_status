# Conta Check Status

A Node.js/Express web application that scans configured archive folders (and their subfolders) and shows, in a grid, which monthly documents exist or are missing.  
It is designed to work with multiple logical folders (main, support, periodic, extract entries, investment) and to be served standalone or behind a reverse proxy (e.g. `/conta_check_docs`).

---

## 1. Features

- Scan one or several archive folders and all their subfolders.
- Detect files following the naming pattern:

  ```text
  YYYYMM_Description_Suffix....ext
  ```

  Examples:

  - `202401_Sales_January.pdf`
  - `202312_Receipts_Supermarket____v2.xlsx`
  - `202402_Payroll_Company.txt`

- Supported extensions:

  - `txt`, `csv`, `pdf`, `png`, `jpg`, `jpeg`, `bmp`, `xls`, `xlsx`

- Build a **status grid**:

  - Rows: months (YYYYMM)
  - Columns: distinct descriptions derived from the file name
  - Cell content:
    - ✔️ one file present
    - ⚠️ more than one file
    - ❌ no file

- Hover over ✔️ or ⚠️ to see full paths and extensions.
- For each cell with files you can open a viewer or download the document:
  - `.txt`, `.csv`: shown as formatted text in the browser
  - `.pdf`: embedded viewer
  - `.png`, `.jpg`, `.jpeg`, `.bmp`: image viewer
  - `.xls`, `.xlsx`: downloaded (read-only usage)
- Separate logical “types” of archive:

  - `main`
  - `extractentries`
  - `support`
  - `periodic`
  - `investment`

- Backend logs every request and main processing steps to a log file.

---

## 2. Architecture Overview

The project consists of a small Express backend and a static frontend:

- **Backend (`app/server.js`)**
  - HTTP server on port `9000` by default.
  - Serves the SPA frontend from `app/public`.
  - API:
    - `GET /api/status?type=main|extractentries|support|periodic|investment`
    - `GET /view?file=...` HTML viewer for a given file
    - `GET /file?file=...` raw file streaming for embedding/downloading
  - Reads its configuration from `config/config.json` (auto-creates file with defaults if missing).
  - Writes logs to a configurable log directory.

- **Frontend (`app/public/`)**
  - Single-page application (HTML + JS) that:
    - Renders a tabbed UI (for the different types of folders).
    - Calls `/api/status?type=...` and renders the status grid.
    - Opens viewers/downloads when the user clicks a cell with documents.

---

## 3. Configuration

Configuration is read from `config/config.json` relative to `app/server.js`.  
If the file does not exist, it is automatically created with defaults.

### 3.1. Default config

By default, the server uses:

```json
{
  "logPath": "../log",
  "mainFolderPath": "../../conta_archivos/archive/archive_main",
  "extractEntriesFolderPath": "../../conta_archivos/archive/archive_extract_entries",
  "periodicFolderPath": "../../conta_archivos/archive/archive_periodic",
  "supportFolderPath": "../../conta_archivos/archive/archive_support",
  "investmentFolderPath": "../../conta_archivos/archive/archive_investment"
}
```

> Note: these defaults are oriented to the original environment of the project.  
> Adapt the paths to your own folder structure.

### 3.2. Archive root and `archive_main`

The backend now supports a common archive root via `archiveFolderPath`.  
Internally, the mapping used is:

```js
const folderMap = {
  main: config.archiveFolderPath
    ? path.join(config.archiveFolderPath, "archive_main")
    : config.mainFolderPath,
  extractentries: config.extractEntriesFolderPath,
  periodic: config.periodicFolderPath,
  support: config.supportFolderPath,
  investment: config.investmentFolderPath
};
```

This means:

- If `archiveFolderPath` is defined in `config/config.json`, the **main** folder becomes:

  ```text
  <archiveFolderPath>/archive_main
  ```

- If `archiveFolderPath` is **not** defined, the server falls back to the old behavior and uses `mainFolderPath`.

#### Example config using a common root

```json
{
  "logPath": "../log",
  "archiveFolderPath": "../../conta_archivos/archive",
  "extractEntriesFolderPath": "../../conta_archivos/archive/archive_extract_entries",
  "periodicFolderPath": "../../conta_archivos/archive/archive_periodic",
  "supportFolderPath": "../../conta_archivos/archive/archive_support",
  "investmentFolderPath": "../../conta_archivos/archive/archive_investment"
}
```

With this configuration:

- `type=main` → `../../conta_archivos/archive/archive_main`
- `type=extractentries` → `../../conta_archivos/archive/archive_extract_entries`
- `type=support` → `../../conta_archivos/archive/archive_support`
- `type=periodic` → `../../conta_archivos/archive/archive_periodic`
- `type=investment` → `../../conta_archivos/archive/archive_investment`

### 3.3. Log directory

`logPath` indicates where the main log file will be written. The server:

- Ensures the directory exists (creates it if needed).
- Writes a log file named `main.log`:

  ```js
  const LOG_FILE = path.join(logPath, 'main.log');
  ```

Logs include route calls, folder scans, regex matches, grid construction, and errors.

---

## 4. API Details

### 4.1. `GET /api/status?type=...`

Returns status information for the requested folder type.

**Query parameter:**

- `type` (optional): one of

  - `main`
  - `extractentries`
  - `support`
  - `periodic`
  - `investment`

  If omitted or invalid, defaults to `main`.

**Response JSON:**

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

- `months`: sorted list of all months in the data (the frontend may display newest first).
- `columns`: each unique description derived from the filename.
- `grid`: one entry per month, with each description as a property.
  - `count`: 0, 1, or >1
  - `paths`: absolute file paths discovered.
  - `exts`: corresponding extensions.
- `unprocessedFiles`: full paths for files that:
  - do not match the naming pattern `YYYYMM_Description_...ext`, or
  - have an unsupported extension.

**Filename pattern (server-side):**

The code uses a regex roughly equivalent to:

```
re^([^_]+)_([^_]+)_(.+?)_d_(\d+)_t_([^\.]+)\.([^.]+)$
```

Where:

- Group 1: `YYYYMM`
- Group 2: first description token
- Group 3: the rest of the description
- Group 4: extension

### 4.2. `GET /view?file=...`

Opens an HTML-based viewer for a given file path.

- `file` is an absolute path as returned by `/api/status`.
- **Security**: the path must be inside one of the configured data roots:

  - `folderMap.main`
  - `folderMap.extractentries`
  - `folderMap.periodic`
  - `folderMap.support`
  - `folderMap.investment`

If the path is outside these roots, the server responds with `403 Access denied`.

Supported behavior:

- `.txt`, `.csv`: displayed as HTML `<pre>` with dark theme.
- `.pdf`: embedded via `<embed>`.
- Images (`.png`, `.jpg`, `.jpeg`, `.bmp`): displayed via `<img>`.
- `.xls`, `.xlsx`:
  - Loaded in the browser using SheetJS (`xlsx.full.min.js`).
  - Rendered as HTML tables in the viewer page.

### 4.3. `GET /file?file=...`

Streams the raw file content. Used by the `/view` page for embedding or downloading.

- Same security check as `/view`.
- Content-Type inferred with `mime-types`.
- If the file does not exist → `404`.

---

## 5. Frontend Usage

The frontend is served statically from `app/public`:

- Main page: `http://localhost:9000/`
- Renders:

  - Tab bar for each type of folder (e.g. Main, Support, Periodic, Extract Entries, Investment).
  - Status grid using the `/api/status` endpoint.
  - Clickable cells for viewing/downloading documents.

Typical flow:

1. User selects a tab (e.g. **Main**).
2. Frontend issues `GET /api/status?type=main`.
3. Data is rendered into a grid.
4. User clicks a cell with ✔️ or ⚠️:
   - If there is exactly one file, the viewer is opened directly.
   - If there are multiple, the UI may let the user choose which one to open/download.

---

## 6. Running the Application

### 6.1. Local (Node.js)

Requirements:

- Node.js (LTS recommended)
- npm

Steps:

```bash
cd app
npm install
npm start
```

By default the server listens on:

- `http://localhost:9000/`

Place your documents in the configured archive folders (`archive_main`, `archive_support`, etc.), adjusting `config/config.json` as needed.

### 6.2. With Docker / docker-compose

The repository includes a `Dockerfile` and `docker-compose.yml` at the project root.

Typical usage (from the project root):

```bash
docker-compose up --build
```

- The container will run the Node.js server inside.
- Mount or copy your archive folders into the container according to your `config/config.json` paths.
- Expose the container port (by default `9000`) to your host.

Consult `docker-compose.yml` for exact volume and port mappings and adjust them to match your environment.

---

## 7. Deployment Behind a Reverse Proxy

The application can be served under a subpath such as `/conta_check_docs`. Important details:

- The backend computes an `externalBaseUrl` per request using:
  - `x-forwarded-proto`
  - `x-forwarded-host`
- The frontend builds some links using `req.externalBaseUrl` to keep URLs consistent when running behind a reverse proxy.

When deploying:

1. Configure your reverse proxy (nginx, Apache, Traefik, etc.) to route:
   - `/conta_check_docs/` → backend server (`http://backend:9000/`)
2. Ensure the proxy sets appropriate `X-Forwarded-*` headers:
   - `X-Forwarded-Proto`
   - `X-Forwarded-Host`
3. Verify that:
   - `/conta_check_docs/` loads the SPA.
   - API calls go to `/conta_check_docs/api/status?...`.
   - File viewer links also use the same base path.

---

## 8. Logs and Troubleshooting

### 8.1. Log location

- Default log file: `../log/main.log` (relative to `app/server.js`), or as defined by `logPath`.
- Typical events logged:
  - Incoming route (`/api/status`, `/view`, `/file`) plus resolved paths.
  - Directory scans (`getAllFiles`).
  - Regex matches and unmatched files.
  - Grid generation details.
  - Errors reading directories or files.

### 8.2. Common issues

- **`The "path" argument must be of type string. Received undefined`**  
  Usually indicates a missing or mis-typed path in `config/config.json`.  
  Check:

  - `archiveFolderPath`
  - `mainFolderPath`
  - `extractEntriesFolderPath`
  - `periodicFolderPath`
  - `supportFolderPath`
  - `investmentFolderPath`

  Ensure all required folder paths are strings and point to real directories.

- **Access denied (403) on viewer/file endpoints**  
  The file is outside of the configured roots.  
  Make sure the archive folders in `config/config.json` correctly cover your documents.

---

## 9. Project Structure

At the repository root:

- `Dockerfile` – container build definition.
- `docker-compose.yml` – optional orchestration for the app.
- `app/`
  - `server.js` – Express backend.
  - `package.json`, `package-lock.json` – Node.js dependencies.
  - `public/` – static frontend (HTML, JS, CSS).
  - `README.md` – this document.
- `config/`
  - `config.json` – runtime configuration (auto-created on first run).
- `log/`
  - `main.log` and other log files (path configurable via `logPath`).

---

## 10. License

MIT