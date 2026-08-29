/** Client-side Excel (xlsx) and print-to-PDF helpers. */

export async function downloadAoaAsXlsx(
  rows: (string | number)[][],
  filename: string,
  opts?: { sheetName?: string; cols?: { wch: number }[] },
) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (opts?.cols) ws['!cols'] = opts.cols;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts?.sheetName || 'Data');
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/** Open a print dialog for HTML content (user can Save as PDF). */
export function printHtmlAsPdf(html: string) {
  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('Popup diblokir. Izinkan popup untuk unduh PDF.');
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 400);
}
