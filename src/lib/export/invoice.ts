// Order invoice PDF generator with shop branding
import type { OrderRecord, PaymentRecord } from '@/lib/db/schema'
import { orderBalance } from '@/lib/payments/calculations'
import { GARMENT_LABELS, ORDER_STATUS_CONFIG } from '@/types'

interface InvoiceData {
  order: OrderRecord
  payments: PaymentRecord[]
  shop: {
    name: string
    phone?: string
    address?: string
    city?: string
    logoUrl?: string
    brandColor?: string
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatCurrency(amount: number) {
  return `Rs. ${amount.toLocaleString()}`
}

export async function exportOrderInvoice(data: InvoiceData) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const { order, payments, shop } = data
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const brandColor = hexToRgb(shop.brandColor ?? '#1d4ed8')
  const pageW = 190 // usable width in mm
  let y = 10

  // ── Header ──────────────────────────────────────────────────────
  doc.setFillColor(...brandColor)
  doc.rect(0, 0, 210, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(shop.name || 'MeraDarzi', 14, 16)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const subLine = [shop.city, shop.phone].filter(Boolean).join(' • ')
  if (subLine) doc.text(subLine, 14, 22)
  y = 34

  // ── Invoice title ───────────────────────────────────────────────
  doc.setTextColor(...brandColor)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('ORDER INVOICE', 14, y)
  y += 6

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`Generated: ${new Date().toLocaleString('en-PK')}`, 14, y)
  y += 10

  // ── Order Info ──────────────────────────────────────────────────
  const infoRows = [
    ['Order #', String(order.orderNumber).padStart(3, '0')],
    ['Status', ORDER_STATUS_CONFIG[order.status]?.label ?? order.status],
    ['Date', formatDate(order.createdAt)],
    ['Due Date', formatDate(order.dueDate)],
    ['Tracking Code', order.trackingCode],
  ]
  autoTable(doc, {
    body: infoRows,
    startY: y,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35, textColor: [100, 100, 100] },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 14 },
    tableWidth: pageW,
  })
  y = (doc as any).lastAutoTable?.finalY + 6 || y + 40

  // ── Customer Info ───────────────────────────────────────────────
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...brandColor)
  doc.text('Customer', 14, y)
  y += 5

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  const custFields = [
    order.customerName,
    order.customerPhone,
    order.orderForRelation && order.orderForRelation !== 'self'
      ? `For: ${order.orderForName ?? order.orderForRelation}`
      : null,
  ].filter(Boolean)
  custFields.forEach(f => {
    doc.text(`• ${f}`, 14, y)
    y += 4.5
  })
  y += 3

  // ── Garment Details ─────────────────────────────────────────────
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...brandColor)
  doc.text('Order Details', 14, y)
  y += 5

  const garmentRows = [
    ['Garment', GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS]?.label ?? order.garmentType],
    ['Urgent', order.isUrgent === 1 ? 'Yes ⚡' : 'No'],
  ]
  if (order.specialInstructions) {
    garmentRows.push(['Instructions', order.specialInstructions])
  }
  if (order.assignedToName) {
    garmentRows.push(['Assigned To', order.assignedToName])
  }
  autoTable(doc, {
    body: garmentRows,
    startY: y,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30, textColor: [100, 100, 100] },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 14 },
    tableWidth: pageW,
  })
  y = (doc as any).lastAutoTable?.finalY + 6 || y + 30

  // ── Price Breakdown ─────────────────────────────────────────────
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...brandColor)
  doc.text('Price Breakdown', 14, y)
  y += 5

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const balance = orderBalance(order)
  const priceRows = [
    ['Total Price', formatCurrency(order.totalPrice)],
    ['Amount Paid', formatCurrency(totalPaid)],
    ['Balance Due', balance > 0 ? formatCurrency(balance) : 'Paid ✓'],
  ]
  autoTable(doc, {
    body: priceRows,
    startY: y,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40, textColor: [100, 100, 100] },
      1: { cellWidth: 'auto', halign: 'right' },
    },
    margin: { left: 14 },
    tableWidth: pageW,
  })
  y = (doc as any).lastAutoTable?.finalY + 6 || y + 30

  // ── Payment History ─────────────────────────────────────────────
  if (payments.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...brandColor)
    doc.text('Payment History', 14, y)
    y += 5

    autoTable(doc, {
      head: [['Date', 'Method', 'Amount']],
      body: payments.map(p => [
        formatDate(p.paidAt),
        p.method.charAt(0).toUpperCase() + p.method.slice(1),
        formatCurrency(p.amount),
      ]),
      startY: y,
      styles: { fontSize: 7 },
      headStyles: { fillColor: brandColor, textColor: [255, 255, 255] },
      margin: { left: 14 },
      tableWidth: pageW,
    })
    y = (doc as any).lastAutoTable?.finalY + 8 || y + 30
  }

  // ── Footer ──────────────────────────────────────────────────────
  if (y < 260) y = 265
  doc.setDrawColor(220, 220, 220)
  doc.line(14, y, 196, y)
  y += 6

  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.setFont('helvetica', 'normal')
  doc.text('Generated by MeraDarzi — Best Tailor Management Software in Pakistan', 14, y)
  doc.text('meradarzi.pk', 14, y + 4)

  // Download
  const filename = `invoice-${shop.name.replace(/\s+/g, '-')}-${order.orderNumber}-${new Date().toISOString().split('T')[0]}.pdf`
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '')
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ]
}
