# File Status Grid Web App

This is a one-page web application that checks the content of a configured folder (and all its subfolders) for files following a specific pattern. It displays a grid showing which files are present for each month and category.

## Features

- Scans a folder and all subfolders for files named as `YYYYMM...` (e.g., `202401_sales.csv`)
- Uses a configurable dictionary to define expected file types (columns)
- Displays a grid: rows are months (oldest at bottom, newest at top), columns are file types
- Green check (✔️) if the expected file is present, red cross (❌) if not, warning (⚠️) if more than one file is found for a cell
- Hover over green or warning icons to see the file path(s)
- For green checks, the icon is clickable:
  - For text, csv, pdf, png, jpg, bmp: opens a file viewer in a new tab
  - For Excel files (.xls, .xlsx): downloads the file as "_readonly"
- The file extension is shown below each green check icon
- Modern UI: dark purple background, white text, rounded edges, fixed-width columns
- No sticky headers; grid scrolls normally

## File Viewer

Supported formats for viewing in the browser:
- `.txt`, `.csv`: Displayed as plain text
- `.pdf`: Embedded PDF viewer
- `.png`, `.jpg`, `.jpeg`, `.bmp`: Image preview
- `.xls`, `.xlsx`: Download only (not viewed in browser, downloaded as "_readonly")

## Configuration

Edit `config.json`:

```json
{
  "folderPath": "./data",
  "dictionary": {
    "sales": "Sales Report",
    "inventory": "Inventory List",
    "expenses": "Expense Sheet"
  }
}
```

- `folderPath`: Path to the folder to scan (relative to project root)
- `dictionary`: Keys are substrings to look for in filenames, values are column names

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Start the server:

   ```
   npm start
   ```

3. Open your browser at [http://localhost:3001](http://localhost:3001)

4. Place your files in the configured folder (and subfolders).

## File Pattern

- Files must start with `YYYYMM` (e.g., `202401_sales.csv`)
- The substring for each column (e.g., `sales`) must appear in the filename

## Project Structure

- `server.js` — Node.js/Express backend
- `public/` — Frontend (HTML, JS, CSS)
- `config.json` — Configuration file
- `data/` — Place your files here

## License

MIT
