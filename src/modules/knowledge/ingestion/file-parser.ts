import pdfParse from 'pdf-parse'
import * as XLSX from 'xlsx'

import { downloadMessageMedia } from '../../../shared/storage/index.js'
import type { CatalogueFileType } from '../knowledge.constants.js'
import { cleanText } from './text-cleaner.js'

export async function parsePdf(fileBytes: Buffer): Promise<string> {
  const result = await pdfParse(fileBytes)
  return cleanText(result.text)
}

export function parseCsv(fileBytes: Buffer): string {
  const workbook = XLSX.read(fileBytes, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (sheetName === undefined) {
    return ''
  }

  return cleanText(XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName] ?? {}))
}

export function parseXlsx(fileBytes: Buffer): string {
  const workbook = XLSX.read(fileBytes, { type: 'buffer' })
  const sections: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (sheet === undefined) {
      continue
    }

    sections.push(`## Sheet: ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet)}`)
  }

  return cleanText(sections.join('\n\n'))
}

export async function parseCatalogueFile(
  storagePath: string,
  fileType: CatalogueFileType,
): Promise<string> {
  const fileBytes = await downloadMessageMedia(storagePath)

  if (fileType === 'pdf') {
    return parsePdf(fileBytes)
  }

  if (fileType === 'csv') {
    return parseCsv(fileBytes)
  }

  if (fileType === 'xlsx') {
    return parseXlsx(fileBytes)
  }

  throw new Error(`Unsupported file type: ${fileType}`)
}
