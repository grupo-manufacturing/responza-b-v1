import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import * as XLSX from 'xlsx'

import { logger } from '../../../shared/logger.js'

export async function extractTextFromBuffer(input: {
  buffer: Buffer
  mimeType: string
  filename: string
}): Promise<string> {
  const { buffer, mimeType, filename } = input

  if (mimeType === 'text/plain') {
    return buffer.toString('utf8').trim()
  }

  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: buffer })
    try {
      const result = await parser.getText()
      return result.text.trim()
    } finally {
      await parser.destroy()
    }
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value.trim()
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetTexts = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName]
      if (sheet === undefined) {
        return ''
      }

      return XLSX.utils.sheet_to_csv(sheet).trim()
    }).filter((value) => value.length > 0)

    return sheetTexts.join('\n\n').trim()
  }

  logger.warn('[knowledge] Unsupported catalogue mime type for extraction', {
    filename,
    mimeType,
  })

  return ''
}
