const basePath = window.location.pathname.startsWith('/conta_check_docs')
  ? '/conta_check_docs'
  : '';

let currentType = 'main';

function extractBadgeNumber(str) {
  const match = str.match(/_t_([n]?\d+c\d+)/);
  if (!match) return null;

  let value = match[1];

  return value
    .replace(/^n/, '-')  // leading n → -
    .replace('c', ',');  // c → ,
}

async function fetchStatus(type = 'main') {
  const endpoint = (type === 'totals')
    ? `${basePath}/api/totals`
    : `${basePath}/api/status?type=${encodeURIComponent(type)}`;

  const res = await fetch(endpoint);
  if (!res.ok) {
    document.getElementById('app').innerHTML = 'Failed to load data.';
    return null;
  }
  return res.json();
}

function buildMonthlyValueMap(items, key) {
  const map = {};

  if (!Array.isArray(items)) {
    return map;
  }

  items.forEach((item) => {
    if (item && item.ym != null) {
      map[item.ym] = Number(item[key]) || 0;
    }
  });

  return map;
}

function renderTotalsHistogram(months, totalsMap, investmentsMap, formatMonth, formatAmount) {
  const values = months.map((ym) => {
    const mainDocs = totalsMap[ym] != null ? Number(totalsMap[ym]) : 0;
    const investments = investmentsMap[ym] != null ? Number(investmentsMap[ym]) : 0;

    return {
      ym,
      mainDocs,
      investments,
      combined: mainDocs + investments
    };
  });

  const maxCombined = Math.max(...values.map((value) => value.combined), 0);
  const chartTop = 28;
  const chartBottom = 262;
  const chartLeft = 64;
  const chartRight = 24;
  const plotHeight = chartBottom - chartTop;
  const slotWidth = 74;
  const barWidth = 34;
  const width = chartLeft + (values.length * slotWidth) + chartRight;
  const height = 308;
  const scaleMax = maxCombined > 0 ? maxCombined : 1;
  const gridSteps = 4;

  let svg = `<svg viewBox="0 0 ${width} ${height}" class="totals-chart-svg" role="img" aria-label="Monthly totals chart">`;

  for (let step = 0; step <= gridSteps; step++) {
    const ratio = step / gridSteps;
    const y = chartBottom - (plotHeight * ratio);
    const labelValue = formatAmount(scaleMax * ratio);
    svg += `<line x1="${chartLeft}" y1="${y}" x2="${width - chartRight}" y2="${y}" class="chart-grid-line"></line>`;
    svg += `<text x="${chartLeft - 10}" y="${y + 4}" text-anchor="end" class="chart-axis-label">${labelValue}</text>`;
  }

  svg += `<line x1="${chartLeft}" y1="${chartBottom}" x2="${width - chartRight}" y2="${chartBottom}" class="chart-axis-line"></line>`;

  values.forEach((value, index) => {
    const slotStart = chartLeft + (index * slotWidth);
    const barX = slotStart + ((slotWidth - barWidth) / 2);
    const mainHeight = (value.mainDocs / scaleMax) * plotHeight;
    const investmentHeight = (value.investments / scaleMax) * plotHeight;
    const mainY = chartBottom - mainHeight;
    const investmentY = mainY - investmentHeight;
    const labelY = Math.max(18, investmentY - 8);
    const monthLabel = formatMonth(value.ym);
    const tooltip = `${monthLabel} | Main Docs: ${formatAmount(value.mainDocs)} | Investments: ${formatAmount(value.investments)} | Total: ${formatAmount(value.combined)}`;

    svg += `<g>`;
    svg += `<title>${tooltip}</title>`;

    if (value.combined > 0) {
      svg += `<rect x="${barX}" y="${mainY}" width="${barWidth}" height="${mainHeight}" rx="10" ry="10" class="chart-bar-main"></rect>`;

      if (value.investments > 0) {
        svg += `<rect x="${barX}" y="${investmentY}" width="${barWidth}" height="${investmentHeight}" rx="10" ry="10" class="chart-bar-investment"></rect>`;
      }

      svg += `<text x="${slotStart + (slotWidth / 2)}" y="${labelY}" text-anchor="middle" class="chart-value-label">${formatAmount(value.combined)}</text>`;
    }

    svg += `<text x="${slotStart + (slotWidth / 2)}" y="${chartBottom + 24}" text-anchor="middle" class="chart-month-label">${monthLabel}</text>`;
    svg += `</g>`;
  });

  svg += '</svg>';

  return `
    <section class="data-card totals-chart-card">
      <div class="section-heading">
        <h2>Monthly Totals</h2>
      </div>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-swatch legend-swatch-main"></span>Totals Main Docs</span>
        <span class="legend-item"><span class="legend-swatch legend-swatch-investment"></span>Total Investments</span>
      </div>
      <div class="chart-wrap">
        ${svg}
      </div>
    </section>
  `;
}

// Render the main grid or totals grid depending on currentType
function renderGrid(data) {
  const { months } = data;
  if (!months || !months.length) {
    return '<section class="data-card empty-state"><p>No files found in the configured folder.</p></section>';
  }

  const formatMonth = (ym) =>
    ym && ym.length === 6 ? ym.slice(0, 4) + '/' + ym.slice(4) : ym;
  const formatAmount = (value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue.toFixed(2) : '0.00';
  };

  // Totals view: histogram plus monthly totals table.
  if (currentType === 'totals') {
    const totalsMap = buildMonthlyValueMap(data.totals, 'total');
    const investmentsMap = buildMonthlyValueMap(data.investments, 'totalOpenBuyValueEur');

    let html = renderTotalsHistogram(months, totalsMap, investmentsMap, formatMonth, formatAmount);
    html += '<section class="data-card"><div class="table-wrap"><table><thead><tr><th>Month</th><th>Totals Main Docs</th><th>Total Investments</th><th>TOTAL</th></tr></thead><tbody>';

    // Oldest at bottom, newest at top
    for (let i = months.length - 1; i >= 0; i--) {
      const ym = months[i];
      const formattedMonth = formatMonth(ym);
      const totalValue = totalsMap[ym] != null ? totalsMap[ym] : 0;
      const investmentValue = investmentsMap[ym] != null ? investmentsMap[ym] : 0;
      const combinedTotal = Number(totalValue) + Number(investmentValue);
      html += `<tr><td>${formattedMonth}</td><td class="cell-ok">${formatAmount(totalValue)}</td><td class="cell-ok">${formatAmount(investmentValue)}</td><td class="cell-ok">${formatAmount(combinedTotal)}</td></tr>`;
    }

    html += '</tbody></table></div></section>';
    return html;
  }

  // Default status view (original behavior)
  const { columns, grid } = data;

  // Table header
  let html = '<section class="data-card"><div class="table-wrap"><table><thead><tr><th>Month</th>';
  columns.forEach(col => {
    html += `<th>${col.label}</th>`;
  });
  html += '</tr></thead><tbody>';

  // Table rows (oldest at bottom, newest at top)
  for (let i = grid.length - 1; i >= 0; i--) {
    const row = grid[i];
    const formattedMonth = formatMonth(row.month);
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
      } else if (cell.count === 2) {
        // Two documents: show two check icons with both links, no warning
        cellClass = 'ok';
        const linkParts = cell.paths.map(p => {
          const ext = p.split('.').pop().toLowerCase();
          const pathParts = p.split(/[\\/]/);
          const origName = pathParts[pathParts.length - 1];
          const dotIdx = origName.lastIndexOf('.');
          const extension = dotIdx !== -1 ? origName.slice(dotIdx) : '';
          let linkHtml;
          if (ext === 'xls' || ext === 'xlsx') {
            const base = dotIdx !== -1 ? origName.slice(0, dotIdx) : origName;
            const extensionOnly = dotIdx !== -1 ? origName.slice(dotIdx) : '';
            const downloadName = base + '_readonly' + extensionOnly;
            linkHtml = `<a href="${basePath}/file?file=${encodeURIComponent(p)}" download="${downloadName}" style="color:inherit;text-decoration:underline;">✔️</a>`;
          } else {
            linkHtml = `<a href="${basePath}/view?file=${encodeURIComponent(p)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">✔️</a>`;
          }
          let extra = `<div style="font-size:0.8em; color:#bbb; margin-top:2px;">${extension}</div>`;
          const badge = extractBadgeNumber(origName);
          if (badge) {
            extra += `<div class="file-badge-number">${badge}</div>`;
          }
          return linkHtml + extra;
        });
        icon = linkParts.join('<hr style="border:none;border-top:1px solid #555;margin:4px 0;">');
        title = cell.paths.join('\n');
      } else {
        icon = '⚠️';
        cellClass = 'warn';
        title = cell.paths.join('\n');
      }
      html += `<td class="cell-${cellClass}"${title ? ` title="${title.replace(/"/g, '"')}"` : ''}>${icon}</td>`;
    });
    html += '</tr>';
  }

  html += '</tbody></table></div></section>';
  return html;
}

// Render the unprocessed files list
function renderUnprocessedFiles(unprocessedFiles) {
  if (!unprocessedFiles || !unprocessedFiles.length) return '';
  let html = `
    <section class="data-card unprocessed-section">
      <div class="section-heading">
        <h2>Unprocessed Files</h2>
        <p>Files that could not be parsed with the expected naming pattern or extension rules.</p>
      </div>
      <div class="table-wrap unprocessed-list">
        <table class="unprocessed-table">
          <thead>
            <tr>
              <th>Full Path</th>
            </tr>
          </thead>
          <tbody>
  `;
  unprocessedFiles.forEach(file => {
    html += `
      <tr>
        <td class="file-path-cell">
          ${file}
        </td>
      </tr>
    `;
  });
  html += `
          </tbody>
        </table>
      </div>
    </section>
  `;
  return html;
}

async function render() {
  const data = await fetchStatus(currentType);
  if (!data) return;
  let html = `
    <div class="content-stack">
      ${renderGrid(data)}
      ${renderUnprocessedFiles(data.unprocessedFiles)}
    </div>
  `;
  document.getElementById('app').innerHTML = html;
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
