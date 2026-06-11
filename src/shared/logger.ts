export const logger = {
  info(message: string): void {
    process.stdout.write(`${message}\n`)
  },
  warn(message: string, context?: Record<string, unknown>): void {
    const suffix = context !== undefined ? ` ${JSON.stringify(context)}` : ''
    process.stderr.write(`${message}${suffix}\n`)
  },
  error(error: unknown): void {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  },
}
