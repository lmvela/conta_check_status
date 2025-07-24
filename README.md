# File Status Grid Web App

This is a one-page web application that checks the content of a configured folder (and all its subfolders) for files following a specific pattern. It displays a grid showing which files are present for each month and category.

## Features

- Scans a folder and all subfolders for files named as `YYYYMM...` (e.g., `202401_sales.csv`)
- Scans for files named as `YYYYMM_Description.ext` (e.g., `202401_sales.csv`) with a valid extension
- Dynamically creates columns for each unique `Description` found in the filenames
- Displays a grid: rows are months (oldest at bottom, newest at top), columns are Descriptions
- Green check (✔️) if a file is present, red cross (❌) if not, warning (⚠️) if more than one file is found for a cell
- Hover over green or warning icons to see the file path(s)
- For green checks, the icon is clickable:
  - For text, csv, pdf, png, jpg, bmp: opens a file viewer in a new tab
  - For Excel files (.xls, .xlsx): downloads the file as "_readonly"
- The file extension is shown below each green check icon
- At the end of the grid, a list of files that could not be processed (invalid format or extension) is shown
- Modern UI: dark purple background, white text, rounded edges, fixed-width columns
- No sticky headers; grid scrolls normally

## File Viewer

Supported formats for viewing in the browser:
- `.txt`, `.csv`: Displayed as plain text
- `.pdf`: Embedded PDF viewer
- `.png`, `.jpg`, `.jpeg`, `.bmp`: Image preview
- `.xls`, `.xlsx`: Download only (not viewed in browser, downloaded as "_readonly")

## Configuration

Edit `config/config.json`:

```json
{
  "folderPath": "./data"
}
```

- `folderPath`: Path to the folder to scan (relative to project root)
- No dictionary is needed; columns are detected automatically from filenames

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Start the server:

   ```
   npm start
   ```

3. Open your browser at [http://localhost:9000](http://localhost:9000)

4. Place your files in the configured folder (and subfolders).

## File Pattern

- Files must be named as `YYYYMM_Description.ext` (e.g., `202401_sales.csv`)
- `YYYYMM` is the year and month (6 digits)
- `Description` is any string (used as the column name)
- `.ext` is a valid extension: `.txt`, `.csv`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.bmp`, `.xls`, `.xlsx`
- Files not matching this pattern or with invalid extensions are listed as "unprocessed" at the end of the grid

## Project Structure

- `server.js` — Node.js/Express backend
- `public/` — Frontend (HTML, JS, CSS)
- `config/config.json` — Configuration file
- `data/` — Place your files here

## License

MIT
