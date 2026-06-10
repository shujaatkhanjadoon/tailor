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

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '')
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ]
}

// jsPDF's default Helvetica font only supports WinAnsiEncoding
// (Latin-1).  Emoji, Arabic/Urdu script, and other non-Latin
// characters render as garbled bytes.  Strip them — for full Urdu
// support we'd need to embed Noto Nastaliq Urdu (~500 KB).
function sanitizeForPdf(text: string): string {
  return (
    text
      // Remove emoji and other symbol blocks
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{FE00}-\u{FEFF}]/gu, '')
      .replace(/[\u{200D}\u{200C}]/gu, '')
      // Remove Arabic / Urdu script blocks — cannot render without an
      // embedded font.  This removes parenthesised Urdu like (گول گردن)
      // but preserves the English label.
      .replace(/[؀-ۿ]/g, '')
      .replace(/[ݐ-ݿ]/g, '')
      .replace(/[ﭐ-﷿]/g, '')
      .replace(/[ﹰ-﻿]/g, '')
      // Collapse whitespace left by removed characters
      .replace(/\s*\(\s*\)/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  )
}

// Format instructions into separate lines for readability
function formatInstructions(raw: string): string {
  const cleaned = sanitizeForPdf(raw)
  if (!cleaned) return ''
  if (cleaned.includes('|')) {
    return cleaned
      .split('|')
      .map(s => s.trim())
      .filter(Boolean)
      .join('\n')
  }
  return cleaned
}

export async function exportOrderInvoice(data: InvoiceData) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const { order, payments, shop } = data
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const brandColor = hexToRgb(shop.brandColor ?? '#1d4ed8')
  const pageW = 190
  const margin = 14
  let y = 0

  // ═══════════════════════════════════════════════════════════════
  // HEADER BAR
  // ═══════════════════════════════════════════════════════════════
  doc.setFillColor(...brandColor)
  doc.rect(0, 0, 210, 32, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(shop.name || 'MeraDarzi', margin, 14)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const subLine = [shop.city, shop.phone].filter(Boolean).join('  •  ')
  if (subLine) doc.text(subLine, margin, 21)

  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', 196, 20, { align: 'right' })
  y = 40

  // ═══════════════════════════════════════════════════════════════
  // ORDER NUMBER & STATUS
  // ═══════════════════════════════════════════════════════════════
  doc.setTextColor(...brandColor)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`Order #${String(order.orderNumber).padStart(3, '0')}`, margin, y)
  y += 7

  const statusCfg = ORDER_STATUS_CONFIG[order.status]
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(`Status: ${statusCfg?.label ?? order.status}`, margin, y)
  y += 4

  doc.setFontSize(7)
  doc.setTextColor(140, 140, 140)
  doc.text(`Generated: ${new Date().toLocaleString('en-PK')}`, margin, y)
  y += 10

  // ═══════════════════════════════════════════════════════════════
  // SEPARATOR
  // ═══════════════════════════════════════════════════════════════
  doc.setDrawColor(...brandColor)
  doc.setLineWidth(0.3)
  doc.line(margin, y, 196, y)
  y += 8

  // ═══════════════════════════════════════════════════════════════
  // KEY DETAILS — two-column grid
  // ═══════════════════════════════════════════════════════════════
  const leftCol = [
    { label: 'Date',      value: formatDate(order.createdAt) },
    { label: 'Due Date',  value: formatDate(order.dueDate) },
  ]
  const rightCol = [
    { label: 'Tracking',  value: order.trackingCode },
    { label: 'Urgent',    value: order.isUrgent === 1 ? 'Yes' : 'No' },
  ]

  const colW = (pageW - 10) / 2
  let rowY = y

  leftCol.forEach(({ label, value }) => {
    doc.setFontSize(7)
    doc.setTextColor(140, 140, 140)
    doc.setFont('helvetica', 'normal')
    doc.text(label.toUpperCase(), margin, rowY)
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    doc.setFont('helvetica', 'bold')
    doc.text(value, margin, rowY + 4)
    rowY += 11
  })

  rowY = y
  rightCol.forEach(({ label, value }) => {
    doc.setFontSize(7)
    doc.setTextColor(140, 140, 140)
    doc.setFont('helvetica', 'normal')
    doc.text(label.toUpperCase(), margin + colW + 10, rowY)
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    doc.setFont('helvetica', 'bold')
    doc.text(String(value), margin + colW + 10, rowY + 4)
    rowY += 11
  })

  y += 26

  // ═══════════════════════════════════════════════════════════════
  // CUSTOMER CARD
  // ═══════════════════════════════════════════════════════════════
  doc.setDrawColor(220, 220, 220)
  doc.setFillColor(250, 250, 250)
  doc.roundedRect(margin, y - 2, pageW, 14, 2, 2, 'FD')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(80, 80, 80)
  doc.text('CUSTOMER', margin + 3, y + 3)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(order.customerName, margin + 3, y + 8.5)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(order.customerPhone, margin + colW + 10, y + 8.5)

  if (order.orderForRelation && order.orderForRelation !== 'self') {
    doc.setFontSize(7)
    doc.setTextColor(140, 140, 140)
    doc.text(`For: ${order.orderForName ?? order.orderForRelation}`, margin + 3, y + 13)
  }
  y += 18

  // ═══════════════════════════════════════════════════════════════
  // GARMENT DETAILS
  // ═══════════════════════════════════════════════════════════════
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...brandColor)
  doc.text('Garment Details', margin, y)
  y += 6

  const garmentLabel = GARMENT_LABELS[order.garmentType as keyof typeof GARMENT_LABELS]
  const garmentName = garmentLabel?.label ?? order.garmentType

  autoTable(doc, {
    body: [[
      { content: garmentName, styles: { fontSize: 11, fontStyle: 'bold', textColor: [30, 30, 30] } },
    ]],
    startY: y,
    theme: 'plain',
    styles: { cellPadding: 5 },
    margin: { left: margin },
    tableWidth: pageW,
    tableLineColor: [...brandColor, 0.15] as any,
    tableLineWidth: 0.5,
  })
  y = (doc as any).lastAutoTable?.finalY + 3 || y + 15

  // Special instructions — render each line in its own row for readability
  if (order.specialInstructions) {
    const formatted = formatInstructions(order.specialInstructions)
    const lines = formatted.split('\n').filter(Boolean)

    autoTable(doc, {
      body: lines.map(line => [line]),
      startY: y,
      theme: 'plain',
      styles: { fontSize: 8, textColor: [70, 70, 70], cellPadding: 3 },
      margin: { left: margin },
      tableWidth: pageW,
      tableLineColor: [225, 225, 225] as any,
      tableLineWidth: 0.2,
    })
    y = (doc as any).lastAutoTable?.finalY + 5 || y + 15
  }

  // Assigned karigar
  if (order.assignedToName) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`Assigned to: ${order.assignedToName}`, margin, y)
    y += 6
  }

  y += 3

  // ═══════════════════════════════════════════════════════════════
  // PRICE BREAKDOWN
  // ═══════════════════════════════════════════════════════════════
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...brandColor)
  doc.text('Price Breakdown', margin, y)
  y += 6

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const balance = orderBalance(order)

  autoTable(doc, {
    body: [
      ['Total Price',   formatCurrency(order.totalPrice)],
      ['Amount Paid',   formatCurrency(totalPaid)],
      [
        { content: 'Balance Due', styles: { fontStyle: 'bold', textColor: balance > 0 ? [180, 50, 50] : [40, 140, 60] } },
        { content: balance > 0 ? formatCurrency(balance) : 'Fully Paid', styles: { fontStyle: 'bold', textColor: balance > 0 ? [180, 50, 50] : [40, 140, 60] } },
      ],
    ],
    startY: y,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60, textColor: [80, 80, 80] },
      1: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold', textColor: [30, 30, 30] },
    },
    margin: { left: margin },
    tableWidth: pageW,
    tableLineColor: [230, 230, 230] as any,
    tableLineWidth: 0.3,
  })
  y = (doc as any).lastAutoTable?.finalY + 6 || y + 35

  // ═══════════════════════════════════════════════════════════════
  // PAYMENT HISTORY
  // ═══════════════════════════════════════════════════════════════
  if (payments.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...brandColor)
    doc.text('Payment History', margin, y)
    y += 6

    autoTable(doc, {
      head: [['Date', 'Method', 'Amount']],
      body: payments.map(p => [
        formatDate(p.paidAt),
        p.method.charAt(0).toUpperCase() + p.method.slice(1),
        formatCurrency(p.amount),
      ]),
      startY: y,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: brandColor, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 50 },
        2: { cellWidth: 'auto', halign: 'right' },
      },
      margin: { left: margin },
      tableWidth: pageW,
      alternateRowStyles: { fillColor: [248, 248, 248] },
    })
    y = (doc as any).lastAutoTable?.finalY + 8 || y + 30
  }

  // ═══════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════
  if (y < 250) y = 260
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(margin, y, 196, y)
  y += 6

  doc.setFontSize(7)
  doc.setTextColor(160, 160, 160)
  doc.setFont('helvetica', 'normal')
  doc.text('Generated by MeraDarzi — Best Tailor Management Software in Pakistan', margin, y)
  doc.text('meradarzi.pk', margin, y + 4)

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
