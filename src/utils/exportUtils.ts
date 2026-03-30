// ============================================================
// exportUtils.ts
// Export báo cáo ra .xlsx và .pdf
// ============================================================

/** Export 1 sheet ra .xlsx */
export async function exportToXlsx(
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
): Promise<void> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

/** Export nhiều sheets ra .xlsx */
export async function exportMultiSheetXlsx(
  sheets: { name: string; headers: string[]; rows: (string | number)[][] }[],
  filename: string,
): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows])
    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  }
  XLSX.writeFile(wb, filename)
}

/** Export ra PDF dùng jsPDF + autoTable */
export async function exportToPdf(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text(title, 14, 15)
  doc.setFontSize(9)
  doc.text(`Xuất ngày: ${new Date().toLocaleDateString('vi-VN')}`, 14, 22)

  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map(String)),
    startY: 28,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  })

  doc.save(filename)
}
