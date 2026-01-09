export interface GoogleCalendarEvent {
  id: string
  summary?: string
  description?: string
  location?: string
  start: {
    date?: string
    dateTime?: string
    timeZone?: string
  }
  end: {
    date?: string
    dateTime?: string
    timeZone?: string
  }
  status: 'confirmed' | 'tentative' | 'cancelled'
  htmlLink: string
}

export interface CalendarEventsResponse {
  items?: GoogleCalendarEvent[]
  nextPageToken?: string
}

export interface GoogleCalendarListEntry {
  id: string
  summary?: string
  primary?: boolean
  accessRole?: 'freeBusyReader' | 'reader' | 'writer' | 'owner'
  backgroundColor?: string
  foregroundColor?: string
}

export interface CalendarListResponse {
  items?: GoogleCalendarListEntry[]
  nextPageToken?: string
}

/**
 * Category identifiers - now unified as simple strings.
 * Default categories use simple IDs like 'work', 'birthdays'.
 * User-created categories use 'custom-{uuid}' format.
 */
export type EventCategory = string

// Legacy type aliases for backward compatibility during migration
export type BuiltInCategory = string
export type CustomCategoryId = string

export interface YearbirdEvent {
  id: string
  title: string
  description?: string
  location?: string
  startDate: string
  endDate: string
  isAllDay: boolean
  isMultiDay: boolean
  durationDays: number
  googleLink: string
  category: EventCategory
  color: string
  calendarId?: string
  calendarName?: string
  calendarColor?: string
}
