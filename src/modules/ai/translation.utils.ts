export function isTranslatableMessageContent(content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.length === 0) {
    return false
  }

  if (trimmed.startsWith('(non-text:')) {
    return false
  }

  if (trimmed.startsWith('(attachment:')) {
    return false
  }

  return true
}
