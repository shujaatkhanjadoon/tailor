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

export async function exportPrintablePDF(title: string, rows: ExportRow[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const data = rows.map(row => headers.map(h => String(row[h] ?? '')))

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFontSize(14)
  doc.text(title, 14, 20)
  doc.setFontSize(8)
  doc.text(`Generated ${new Date().toLocaleString('en-PK')}`, 14, 26)

  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 30,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 41, 59] },
    margin: { top: 20 },
  })

  downloadBlob(doc.output('blob'), `${filename}-${dateStamp()}.pdf`)
}
