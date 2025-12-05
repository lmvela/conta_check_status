const basePath = window.location.pathname.startsWith('/conta_check_docs')
  ? '/conta_check_docs'
  : '';
const TAB_LABELS = {
  main: 'Main Files Status Grid',
  support: 'Support Files Status Grid',
  periodic: 'Periodic Invoices Status Grid'
};
let currentType = 'main';

function extractBadgeNumber(origName) {
  const dotIdx = origName.lastIndexOf('.');
  const usIdx = origName.lastIndexOf('_');
  if (dotIdx === -1 || usIdx === -1 || dotIdx <= usIdx + 1) return null;
  const seg = origName.slice(usIdx + 1, dotIdx);
  const matches = [...seg.matchAll(/\d+-\d+/g)];
  if (matches.length === 0) return null;
  return matches[matches.length - 1][0].replace('-', ',');
}

async function fetchStatus(type = 'main') {
  const res = await fetch(`${basePath}/api/status?type=${encodeURIComponent(type)}`);
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
          icon = `<a href="${basePath}/file?file=${encodeURIComponent(cell.paths[0])}" download="${downloadName}" style="color:inherit;text-decoration:underline;">✔️</a>`;
          icon += `<div style="font-size:0.8em; color:#bbb; margin-top:2px;">${extension}</div>`;
          const badge = extractBadgeNumber(origName);
          if (badge) {
            icon += `<div class="file-badge-number">${badge}</div>`;
          }
        } else {
          const pathParts = cell.paths[0].split(/[\\/]/);
          const origName = pathParts[pathParts.length - 1];
          const dotIdx = origName.lastIndexOf('.');
          const extension = dotIdx !== -1 ? origName.slice(dotIdx) : '';
          icon = `<a href="${basePath}/view?file=${encodeURIComponent(cell.paths[0])}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">✔️</a>`;
          icon += `<div style="font-size:0.8em; color:#bbb; margin-top:2px;">${extension}</div>`;
          const badge = extractBadgeNumber(origName);
          if (badge) {
            icon += `<div class="file-badge-number">${badge}</div>`;
          }
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

async function render() {
  const data = await fetchStatus(currentType);
  if (!data) return;
  let html = `
    <div style="display: flex; flex-direction: column; align-items: stretch; width: 100%; max-width: 1100px; margin: 32px auto; padding: 0 16px;">
      ${renderGrid(data)}
      ${renderUnprocessedFiles(data.unprocessedFiles)}
    </div>
  `;
  document.getElementById('app').innerHTML = html;

  // Update the title with the file counter and active tab label
  const titleElem = document.getElementById('main-title');
  if (titleElem && Array.isArray(data.grid)) {
    const label = TAB_LABELS[currentType] || 'File Status Grid';
    titleElem.textContent = `${label} (${data.grid.length})`;
  }
}

// Initialize tab click handling
function initTabs() {
  const tabs = document.getElementById('tabs');
  if (!tabs) return;
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const type = btn.getAttribute('data-type');
    if (!type || type === currentType) return;

    // Update active state
    document.querySelectorAll('#tabs .tab').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-type') === type);
    });

    currentType = type;
    render();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Ensure correct active tab on load
  document.querySelectorAll('#tabs .tab').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-type') === currentType);
  });
  initTabs();
  render();
});
