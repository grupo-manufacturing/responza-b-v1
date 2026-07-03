import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

import { logger } from '../../../shared/logger.js'
import { normalizeMimeType } from '../../media/media.constants.js'

const LEGACY_OFFICE_MIME_TYPES = new Set([
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })

  try {
    const result = await parser.getText()
    return typeof result.text === 'string' ? result.text : ''
  } finally {
    await parser.destroy()
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

function extractPlainText(buffer: Buffer): string {
  return buffer.toString('utf8')
}

function extractSpreadsheetText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const lines: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (sheet === undefined) {
      continue
    }

    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    })

    if (rows.length === 0) {
      continue
    }

    lines.push(`Sheet: ${sheetName}`)

    for (const row of rows) {
      const cells = row
        .map((cell) => String(cell ?? '').trim())
        .filter((cell) => cell.length > 0)

      if (cells.length > 0) {
        lines.push(cells.join(' | '))
      }
    }

    lines.push('')
  }

  return lines.join('\n').trim()
}

export async function extractCatalogueText(input: {
  buffer: Buffer
  mimeType: string
  filename: string
}): Promise<string | null> {
  const mimeType = normalizeMimeType(input.mimeType)

  try {
    if (mimeType === 'application/pdf') {
      return (await extractPdfText(input.buffer)).trim()
    }

    if (mimeType === 'text/plain') {
      return extractPlainText(input.buffer).trim()
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return (await extractDocxText(input.buffer)).trim()
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      return extractSpreadsheetText(input.buffer)
    }

    if (LEGACY_OFFICE_MIME_TYPES.has(mimeType)) {
      logger.warn('[catalogue] Legacy Office format is not supported for text extraction', {
        filename: input.filename,
        mimeType,
      })
      return null
    }

    logger.warn('[catalogue] Unsupported catalogue mime type for extraction', {
      filename: input.filename,
      mimeType,
    })
    return null
  } catch (error: unknown) {
    logger.warn('[catalogue] Failed to extract catalogue text', {
      filename: input.filename,
      mimeType,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
