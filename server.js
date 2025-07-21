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
        // Check if any file for this month contains the substring
        const found = fileData.some(
          f => f.ym === month && f.file.includes(col.key)
        );
        row[col.key] = found;
      });
      return row;
    });

    res.json({
      months,
      columns,
      grid
    });
});

// Serve static frontend
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
