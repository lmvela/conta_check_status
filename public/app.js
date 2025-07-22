async function fetchStatus() {
  const res = await fetch('/api/status');
  if (!res.ok) {
    document.getElementById('app').innerHTML = 'Failed to load data.';
    return null;
  }
  return res.json();
}

// Render the main grid
function renderGrid({ months, columns, grid }) {
  if (!months.length) {
    return '<p>No files found in the configured folder.</p>';
  }

  // Table header
  let html = '<table><thead><tr><th>Month</th>';
  columns.forEach(col => {
    html += `<th>${col.label}</th>`;
  });
  html += '</tr></thead><tbody>';

  // Table rows (oldest at bottom, newest at top)
  for (let i = grid.length - 1; i >= 0; i--) {
    const row = grid[i];
    // Format month as YYYY/MM
    const formattedMonth = row.month.length === 6
      ? row.month.slice(0, 4) + '/' + row.month.slice(4)
      : row.month;
    html += `<tr><td>${formattedMonth}</td>`;
    columns.forEach(col => {
      const cell = row[col.key];
      let icon, cellClass, title = '';
      if (cell.count === 0) {
        icon = '❌';
        cellClass = 'fail';
      } else if (cell.count === 1) {
        icon = '✔️';
        cellClass = 'ok';
        title = cell.paths[0];
        // If Excel, download; else, open viewer
        const ext = cell.paths[0].split('.').pop().toLowerCase();
        if (ext === 'xls' || ext === 'xlsx') {
          // Set download filename: original + _readonly + extension
          const pathParts = cell.paths[0].split(/[\\/]/);
          const origName = pathParts[pathParts.length - 1];
          const dotIdx = origName.lastIndexOf('.');
          const base = dotIdx !== -1 ? origName.slice(0, dotIdx) : origName;
          const extension = dotIdx !== -1 ? origName.slice(dotIdx) : '';
          const downloadName = base + '_readonly' + extension;
          icon = `<a href="/file?file=${encodeURIComponent(cell.paths[0])}" download="${downloadName}" style="color:inherit;text-decoration:underline;">✔️</a>`;
          icon += `<div style="font-size:0.8em; color:#bbb; margin-top:2px;">${extension}</div>`;
        } else {
          const pathParts = cell.paths[0].split(/[\\/]/);
          const origName = pathParts[pathParts.length - 1];
          const dotIdx = origName.lastIndexOf('.');
          const extension = dotIdx !== -1 ? origName.slice(dotIdx) : '';
          icon = `<a href="/view?file=${encodeURIComponent(cell.paths[0])}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">✔️</a>`;
          icon += `<div style="font-size:0.8em; color:#bbb; margin-top:2px;">${extension}</div>`;
        }
      } else {
        icon = '⚠️';
        cellClass = 'warn';
        title = cell.paths.join('\n');
      }
      html += `<td class="cell-${cellClass}"${title ? ` title="${title.replace(/"/g, '"')}"` : ''}>${icon}</td>`;
    });
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

// Render the unprocessed files list
function renderUnprocessedFiles(unprocessedFiles) {
  if (!unprocessedFiles || !unprocessedFiles.length) return '';
  let html = `
    <div class="unprocessed-section">
      <h2 style="margin-top:2em; color:#fff; text-align:center;">Unprocessed Files</h2>
      <div class="unprocessed-list" style="background:#2d014d; border-radius:10px; padding:1em; margin-bottom:2em;">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="background:#4b1a7f; color:#fff; text-align:left; padding:8px; border-radius:6px 6px 0 0;">Full Path</th>
            </tr>
          </thead>
          <tbody>
  `;
  unprocessedFiles.forEach(file => {
    html += `
      <tr>
        <td style="padding:8px; color:#fff; font-family:monospace; word-break:break-all; background:#1a0033; font-weight:bold;">
          ${file}
        </td>
      </tr>
    `;
  });
  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;
  return html;
}

async function main() {
  const data = await fetchStatus();
  if (!data) return;
  let html = `
    <div style="display: flex; flex-direction: column; align-items: stretch; width: 100%; max-width: 1100px; margin: 32px auto; padding: 0 16px;">
      ${renderGrid(data)}
      ${renderUnprocessedFiles(data.unprocessedFiles)}
    </div>
  `;
  document.getElementById('app').innerHTML = html;
}

main();
