import type { AgentSettingsRecord } from './agent.repository.js'

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (match === null) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  return hours * 60 + minutes
}

function getZonedMinutes(now: Date, timeZone: string): number | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const hour = Number(parts.find((part) => part.type === 'hour')?.value)
    const minute = Number(parts.find((part) => part.type === 'minute')?.value)

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null
    }

    return hour * 60 + minute
  } catch {
    return null
  }
}

export function isWithinBusinessHours(
  settings: Pick<
    AgentSettingsRecord,
    | 'business_hours_enabled'
    | 'business_hours_timezone'
    | 'business_hours_start'
    | 'business_hours_end'
  >,
  now: Date = new Date(),
): boolean {
  if (!settings.business_hours_enabled) {
    return true
  }

  const currentMinutes = getZonedMinutes(now, settings.business_hours_timezone)
  const startMinutes = parseTimeToMinutes(settings.business_hours_start)
  const endMinutes = parseTimeToMinutes(settings.business_hours_end)

  if (currentMinutes === null || startMinutes === null || endMinutes === null) {
    return true
  }

  if (startMinutes === endMinutes) {
    return true
  }

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes
}
