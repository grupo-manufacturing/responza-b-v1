export function cleanText(text: string): string {
  if (text.length === 0) {
    return ''
  }

  let cleaned = text.replace(/\x00/g, '')
  cleaned = cleaned.replace(/[ \t]+/g, ' ')
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
  return cleaned.trim()
}
