const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 9000;

function directoryExists(path) {
  try {
    return fs.statSync(path).isDirectory();
  } catch (err) {
    return false;
  }
}

// Prepare log file
let dirLog = '/log'
if (!directoryExists(dirLog)){
  dirLog = '../log'
}
if (!directoryExists(dirLog)){
  console.log(`Debug: CREATING DirLog path: ${dirLog}`);
  fs.mkdirSync(dirLog);
}
const LOG_FILE = path.join(dirLog, 'conta_check_status_main.log');
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, '');
}
const absolutePathDirLog = path.resolve(dirLog);
console.log(`Debug: DirLog absolute path: ${absolutePathDirLog}`);
logMessage('Init', `Using LogFile: ${LOG_FILE}`)

// Prepare config file
let dirConfig = '/config';
const defaultConfig = {
  archiveFolderPath:  "../../conta_archivos/archive",
}
if (!directoryExists(dirConfig)){
  dirConfig = '../config'
}
if (!directoryExists(dirConfig)){
  console.log(`Debug: CREATING dirConfig path: ${dirConfig}`);  
  fs.mkdirSync(dirConfig);
}
const absolutePathDirConfig = path.resolve(dirConfig);
console.log(`Debug: Using DirConfig absolute path: ${absolutePathDirConfig}`);
const CONFIG_FILE = path.join(dirConfig, 'conta_check_status_config.json');
if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf8');
}
let config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
logMessage('Init', `Using ConfigFile: ${CONFIG_FILE}`)
logMessage('Init', `Using Config param, config.archiveFolderPath: ${config.archiveFolderPath}`)

// Support multiple data folders (main, support, periodic) with backward compatibility
//       1: Documentos con saldo final y movimientos a extraer (Extractos mensuales)
//       2: Documentos de soporte con movimientos a extraer, (Extractos tarjetas, eCard, Bizum)
//       3: Documentos gastos recurrentes (nomina, domiciliaciones servicios, telefono, luz, agua, gas, ...)
//       4: Documentos secundarios, solo clasificar (impuestos, liquidaciones, transferencias, ...)
//       5: Documentos movimientos inversion acciones, degiro, trader, etc
logMessage('Init', `Loaded archiveFolderPath: ${config.archiveFolderPath}`)
const basePath = config.archiveFolderPath || "/data_archive";
logMessage('Init', `Using archiveFolderPath -> basePath: ${basePath}`)
const folderMap = {
  main: path.join(basePath, "archive_main"),
  extractentries: path.join(basePath, "archive_extractentries"),
  periodic: path.join(basePath, "archive_periodic"),
  support: path.join(basePath, "archive_support"),
  investment: path.join(basePath, "archive_investment"),
  annual: path.join(basePath, "archive_annual"),
};

// Logging utility
function logMessage(functionName, message) {
  try {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${functionName}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
  } catch (err) {
    // If logging fails, print to console as fallback
    console.error('Logging error:', err);
  }
}

// Log all routes and absolute paths for the three data folders and logPath on every request
app.use((req, res, next) => {
  const absMainPath = path.resolve(folderMap.main);
  const absExtractentriesPath = path.resolve(folderMap.extractentries);
  const absPeriodicPath = path.resolve(folderMap.periodic);
  const absSupportPath = path.resolve(folderMap.support);
  const absInvestmentPath = path.resolve(folderMap.investment);
  const absAnnualPath = path.resolve(folderMap.annual);
  const absLogPath = path.resolve(LOG_FILE);
  const absConfigPath = path.resolve(CONFIG_FILE);
  logMessage(
    'route',
    `Request: ${req.method} ${req.originalUrl} | main=${absMainPath}, extractentries=${absExtractentriesPath}, periodic=${absPeriodicPath}, support=${absSupportPath}, investment=${absInvestmentPath}, annual=${absAnnualPath}, logPath=${absLogPath}, cfgPath=${absConfigPath}`
  );
  next();
});

// Middleware to compute req.externalBaseUrl from forwarded headers
app.use((req, res, next) => {
  const forwardedProto = req.headers['x-forwarded-proto'] || req.protocol;
  const forwardedHost = req.headers['x-forwarded-host'] || req.get("host");
  req.externalBaseUrl = `${forwardedProto}://${forwardedHost}`;
  next();
});

// Valid file extensions
const validExtensions = ['txt', 'csv', 'pdf', 'png', 'jpg', 'jpeg', 'bmp', 'xls', 'xlsx'];

function parseCustomNumber(str) {
  if (typeof str !== 'string') return NaN;

  const isNegative = str.startsWith('n');

  const cleaned = str
    .replace(/^n/, '')   // remove leading 'n'
    .replace('c', '.');  // replace decimal marker

  const num = Number(cleaned);

  return isNaN(num) ? NaN : (isNegative ? -num : num);
}

 // API endpoint
app.get('/api/status', (req, res) => {
  // Recursively collect all files in folderPath and subfolders
  function getAllFiles(dir, fileList = []) {
    logMessage('getAllFiles', `Reading directory: ${dir}`);
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

  // Determine which folder to process based on query param ?type=main|support|periodic (default: main)
  const type = (req.query.type || 'main').toLowerCase();
  const validTypes = ['main', 'extractentries', 'support', 'periodic', 'investment', 'annual'];
  const selectedType = validTypes.includes(type) ? type : 'main';
  const selectedFolder = folderMap[selectedType];

  logMessage('/api/status', `Started processing API request for type=${selectedType} (path: ${selectedFolder})`);
  let files = [];
  try {
    files = getAllFiles(selectedFolder);
    logMessage('/api/status', `Found ${files.length} files in folder: ${selectedFolder}`);
  } catch (err) {
    logMessage('/api/status', `ERROR: Failed to read folder: ${err.message}`);
    return res.status(500).json({ error: 'Failed to read folder' });
  }

  // Pattern: YYYYMM_Description.ext
  const pattern = /^([^_]+)_([^_]+)_(.+?)_d_(\d+)_t_([^\.]+)\.([^.]+)$/;

  // Process files
  const fileData = [];
  const unprocessedFiles = [];
  files.forEach(fullPath => {
    const file = path.basename(fullPath);
    const match = file.match(pattern);
    if (match) {
      logMessage('/api/status', `Match Regex: ${file} (month: ${match[1]}, desc: ${match[2]} ${match[3]}, fecha:${match[4]}, total:${match[5]}, ext: ${match[6]})`);
      if (validExtensions.includes(match[6].toLowerCase())) {
        fileData.push({
          file,
          ym: match[1],
          description: match[2] + "_" + match[3],
          date: match[4],
          total: parseCustomNumber(match[5]),
          ext: match[6],
          fullPath,
          public_url: `${req.externalBaseUrl}/conta_check_docs/api/status`
        });
        logMessage('/api/status', `Processed file OK: ${file} `);
      } else {
        unprocessedFiles.push(fullPath);
        logMessage('/api/status', `Invalid extension file: ${file} `);
      }
    } else {
      unprocessedFiles.push(fullPath);
      logMessage('/api/status', `Unmatch Regex: ${file}`);
    }
  });

  // Get all unique months, sorted ascending
  const monthsSet = new Set(fileData.map(f => f.ym));
  let months = Array.from(monthsSet).sort();
  logMessage('/api/status', `Unique months found: ${months.join(', ')}`);

  // Get all unique descriptions (columns)
  const descSet = new Set(fileData.map(f => f.description));
  const columns = Array.from(descSet).sort().map(desc => ({
    key: desc,
    label: desc
  }));
  logMessage('/api/status', `Unique descriptions (columns) found: ${columns.map(c => c.key).join(', ')}`);

  // Generate all months between min and max (inclusive)
  function getAllMonths(start, end) {
    logMessage('getAllMonths', `Generating months from ${start} to ${end}`);
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
    logMessage('getAllMonths', `Generated months: ${result.join(', ')}`);
    return result;
  }

  if (months.length > 0) {
    const allMonths = getAllMonths(months[0], months[months.length - 1]);
    months = allMonths;
  }

  // Build grid: rows = months, columns = descriptions
  const grid = months.map(month => {
    const row = { month };
    columns.forEach(col => {
      // Collect all matching files for this month and description
      const matches = fileData.filter(f => f.ym === month && f.description === col.key);
      row[col.key] = {
        count: matches.length,
        paths: matches.map(f => f.fullPath),
        exts: matches.map(f => f.ext)
      };
      logMessage('/api/status', `Grid cell [${month}][${col.key}]: ${matches.length} file(s)`);
    });
    return row;
  });

  logMessage('/api/status', `Returning grid with ${months.length} months and ${columns.length} columns. Unprocessed files: ${unprocessedFiles.length}`);
  res.json({
    months,
    columns,
    grid,
    unprocessedFiles
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
  // Security: only allow files inside any of the configured folders
  const allowedRoots = [
    path.resolve(folderMap.main),
    path.resolve(folderMap.extractentries),
    path.resolve(folderMap.periodic),
    path.resolve(folderMap.support),
    path.resolve(folderMap.investment),
    path.resolve(folderMap.annual)
  ];
  const isAllowed = allowedRoots.some(root => absPath.startsWith(root));
  if (!isAllowed) {
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
  const allowedRoots = [
    path.resolve(folderMap.main),
    path.resolve(folderMap.extractentries),
    path.resolve(folderMap.periodic),
    path.resolve(folderMap.support),
    path.resolve(folderMap.investment),
    path.resolve(folderMap.annual)
  ];
  const isAllowed = allowedRoots.some(root => absPath.startsWith(root));
  if (!isAllowed) {
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
  logMessage('app.Listen', `Server running on http://localhost:${PORT}`)
});
