type ExportValue = string | number | boolean | null | undefined
type ExportRow = Record<string, ExportValue>

function dateStamp() {
  return new Date().toISOString().split('T')[0]
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportCSV(rows: ExportRow[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const body = rows.map(row =>
    headers
      .map(header => JSON.stringify(row[header] ?? ''))
      .join(',')
  )
  const csv = [headers.join(','), ...body].join('\n')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filename}-${dateStamp()}.csv`)
}

export function exportPrintablePDF(title: string, rows: ExportRow[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
    h1 { font-size: 20px; margin: 0 0 6px; }
    p { color: #64748b; margin: 0 0 18px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #e2e8f0; padding: 7px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; color: #334155; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Generated ${new Date().toLocaleString('en-PK')}</p>
  <table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map(row => `<tr>${headers.map(h => `<td>${String(row[h] ?? '')}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
  <script>window.onload = () => window.print()</script>
</body>
</html>`
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${filename}-${dateStamp()}.html`)
}
