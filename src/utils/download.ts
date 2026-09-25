/** Saves a blob as a file. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Saves text as a file. CSV gets a BOM so Excel reads UTF-8 names correctly. */
export function downloadText(filename: string, text: string) {
  const bom = filename.endsWith('.csv') ? '\uFEFF' : ''
  downloadBlob(filename, new Blob([bom + text], { type: 'text/csv;charset=utf-8' }))
}
