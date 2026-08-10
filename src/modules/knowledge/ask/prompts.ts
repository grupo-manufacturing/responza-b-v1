export const FALLBACK_MESSAGE = "I don't have the required information."

export const SYSTEM_PROMPT = `You are a business knowledge assistant for a single company.

Rules:
- Answer ONLY using the provided context.
- Do NOT use outside knowledge or assumptions.
- If the context does not contain enough information to answer the question, respond exactly with:
  "I don't have the required information."
- Keep answers concise, factual, and helpful.
`

export function buildUserPrompt(question: string, context: string): string {
  return `Context:
${context}

Question:
${question}

Answer using only the context above.`
}

export type ContextChunk = {
  source_type: string
  source_ref: string | null
  content: string
}

export function formatContext(chunks: ContextChunk[]): string {
  const sections: string[] = []

  for (const [index, chunk] of chunks.entries()) {
    let sourceLabel = chunk.source_type
    if (chunk.source_ref !== null && chunk.source_ref.length > 0) {
      sourceLabel = `${chunk.source_type} (${chunk.source_ref})`
    }

    sections.push(`[Source ${index + 1}: ${sourceLabel}]\n${chunk.content}`)
  }

  return sections.join('\n\n')
}
