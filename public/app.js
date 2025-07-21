async function fetchStatus() {
  const res = await fetch('/api/status');
  if (!res.ok) {
    document.getElementById('app').innerHTML = 'Failed to load data.';
    return null;
  }
  return res.json();
}

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
      html += `<td class="cell-${row[col.key] ? 'ok' : 'fail'}">` +
        (row[col.key] ? '✔️' : '❌') +
        '</td>';
    });
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

async function main() {
  const data = await fetchStatus();
  if (!data) return;
  document.getElementById('app').innerHTML = renderGrid(data);
}

main();
