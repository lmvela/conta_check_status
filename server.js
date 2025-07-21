const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Load config
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const folderPath = config.folderPath;
const dictionary = config.dictionary;

// Helper to extract YYYYMM from filename
function extractYearMonth(filename) {
  const match = filename.match(/^(\d{6})/);
  return match ? match[1] : null;
}

// API endpoint
app.get('/api/status', (req, res) => {
  // Recursively collect all files in folderPath and subfolders
  function getAllFiles(dir, fileList = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        getAllFiles(fullPath, fileList);
      } else if (entry.isFile()) {
        fileList.push(fullPath);
      }
    });
    return fileList;
  }

  let files = [];
  try {
    files = getAllFiles(folderPath);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read folder' });
  }

  // Filter files matching pattern
  const fileData = [];
  files.forEach(fullPath => {
    const file = path.basename(fullPath);
    const ym = extractYearMonth(file);
    if (ym) {
      fileData.push({ file, ym });
    }
  });

    // Get all unique months, sorted ascending
    const monthsSet = new Set(fileData.map(f => f.ym));
    let months = Array.from(monthsSet).sort();

    // Generate all months between min and max (inclusive)
    function getAllMonths(start, end) {
      const result = [];
      let year = parseInt(start.slice(0, 4), 10);
      let month = parseInt(start.slice(4, 6), 10);
      const endYear = parseInt(end.slice(0, 4), 10);
      const endMonth = parseInt(end.slice(4, 6), 10);
      while (year < endYear || (year === endYear && month <= endMonth)) {
        result.push(
          year.toString().padStart(4, '0') +
          month.toString().padStart(2, '0')
        );
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }
      return result;
    }

    if (months.length > 0) {
      const allMonths = getAllMonths(months[0], months[months.length - 1]);
      months = allMonths;
    }

    // Prepare columns and result matrix
    const columns = Object.entries(dictionary).map(([key, value]) => ({
      key,
      label: value
    }));

    // Build grid: rows = months, columns = dictionary keys
    const grid = months.map(month => {
      const row = { month };
      columns.forEach(col => {
        // Collect all matching files for this month and substring
        const matches = files.filter(fullPath => {
          const file = path.basename(fullPath);
          const ym = extractYearMonth(file);
          return ym === month && file.includes(col.key);
        });
        row[col.key] = {
          count: matches.length,
          paths: matches
        };
      });
      return row;
    });

    res.json({
      months,
      columns,
      grid
    });
});

const mime = require('mime-types');

// Serve static frontend
app.use(express.static('public'));

// File viewer endpoint
app.get('/view', (req, res) => {
  const filePath = req.query.file;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).send('Missing file parameter');
  }
  // Security: only allow files inside the configured folder
  const absPath = path.resolve(filePath);
  const absRoot = path.resolve(folderPath);
  if (!absPath.startsWith(absRoot)) {
    return res.status(403).send('Access denied');
  }
  // Supported formats
  const ext = path.extname(absPath).toLowerCase();
  const supported = ['.txt', '.csv', '.pdf', '.png', '.jpg', '.jpeg', '.bmp', '.xls', '.xlsx'];
  if (!supported.includes(ext)) {
    return res.status(415).send('Unsupported file type');
  }
  // Render a simple HTML viewer
  let content = '';
  if (ext === '.txt' || ext === '.csv') {
    const text = fs.readFileSync(absPath, 'utf8');
    content = `<pre style="white-space: pre-wrap; word-break: break-all; background:#222; color:#fff; padding:1em; border-radius:8px;">${escapeHtml(text)}</pre>`;
  } else if (ext === '.pdf') {
    content = `<embed src="/file?file=${encodeURIComponent(absPath)}" type="application/pdf" width="100%" height="800px" />`;
  } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.bmp') {
    content = `<img src="/file?file=${encodeURIComponent(absPath)}" style="max-width:100%; max-height:800px; border-radius:8px; background:#222;" />`;
  } else if (ext === '.xls' || ext === '.xlsx') {
    // SheetJS viewer
    content = `
      <div id="excel-viewer" style="background:#222; color:#fff; border-radius:8px; padding:1em;"></div>
      <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
      <script>
        fetch('/file?file=${encodeURIComponent(absPath)}')
          .then(res => res.arrayBuffer())
          .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            let html = '';
            workbook.SheetNames.forEach(function(sheetName) {
              html += '<h3 style="color:#7cffb2;">' + sheetName + '</h3>';
              html += XLSX.utils.sheet_to_html(workbook.Sheets[sheetName], { header: '<th style="background:#4b1a7f;color:#fff;">' });
            });
            document.getElementById('excel-viewer').innerHTML = html;
          })
          .catch(err => {
            document.getElementById('excel-viewer').innerHTML = '<p style="color:#ff6b81;">Failed to load Excel file.</p>';
          });
      </script>
    `;
  }
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>File Viewer</title>
      <meta name="viewport" content="width=900, initial-scale=1.0">
      <style>
        body { background: #2d014d; color: #fff; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; }
        h1 { color: #fff; }
        a { color: #7cffb2; }
        table { border-collapse: collapse; margin-bottom: 2em; }
        th, td { border: 1px solid #5e2e8c; padding: 6px 12px; color: #fff; }
        th { background: #4b1a7f; }
      </style>
    </head>
    <body>
      <h1>File Viewer</h1>
      <p><a href="#" onclick="window.close(); return false;">Close</a></p>
      <div>${content}</div>
    </body>
    </html>
  `);
});

// Serve raw file for embedding/viewing
app.get('/file', (req, res) => {
  const filePath = req.query.file;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).send('Missing file parameter');
  }
  const absPath = path.resolve(filePath);
  const absRoot = path.resolve(folderPath);
  if (!absPath.startsWith(absRoot)) {
    return res.status(403).send('Access denied');
  }
  if (!fs.existsSync(absPath)) {
    return res.status(404).send('File not found');
  }
  const mimeType = mime.lookup(absPath) || 'application/octet-stream';
  res.setHeader('Content-Type', mimeType);
  fs.createReadStream(absPath).pipe(res);
});

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, function (m) {
    return ({
      '&': '&',
      '<': '<',
      '>': '>',
      '"': '"',
      "'": '&#39;'
    })[m];
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
