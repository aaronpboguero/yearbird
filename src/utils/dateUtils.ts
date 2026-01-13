export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function getDaysInMonth(year: number, month: number): number {
  if (month === 1 && isLeapYear(year)) {
    return 29
  }
  return DAYS_IN_MONTH[month]
}

export function isWeekend(year: number, month: number, day: number): boolean {
  const date = new Date(year, month, day)
  const dayOfWeek = date.getDay()
  return dayOfWeek === 0 || dayOfWeek === 6
}

export function isToday(
  year: number,
  month: number,
  day: number,
  today: Date = new Date()
): boolean {
  return (
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day
  )
}

export function isPastDate(
  year: number,
  month: number,
  day: number,
  today: Date = new Date()
): boolean {
  const todayYear = today.getFullYear()
  if (year !== todayYear) {
    return year < todayYear
  }

  const todayMonth = today.getMonth()
  if (month !== todayMonth) {
    return month < todayMonth
  }

  return day < today.getDate()
}

export function parseDateValue(value: string): Date | null {
  if (!value) {
    return null
  }

  if (value.length === 10) {
    const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10))
    if (!year || !month || !day) {
      return null
    }

    const date = new Date(year, month - 1, day)
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null
    }

    return date
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}

/**
 * Formats a date as YYYY-MM-DD string for use as a map key.
 * @param date - Date object to format
 * @returns String in YYYY-MM-DD format
 */
export function getDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formats year, month, day as YYYY-MM-DD string for use as a map key.
 * @param year - Full year (e.g., 2025)
 * @param month - 1-indexed month (1-12)
 * @param day - Day of month (1-31)
 * @returns String in YYYY-MM-DD format
 */
export function getDateKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Adds days to a date, handling month/year boundaries correctly.
 * Uses UTC to avoid DST issues.
 * @param date - Starting date
 * @param days - Number of days to add (negative to subtract)
 * @returns New date with days added
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  // Normalize to midnight to avoid DST edge cases
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Gets the Monday-first day index (0=Mon, 6=Sun) from a date.
 * JavaScript's getDay() returns 0=Sun, so we convert.
 */
export function getMondayDayIndex(date: Date): number {
  const jsDay = date.getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

/**
 * Represents a single day in the week grid.
 */
export interface WeekDay {
  year: number
  month: number // 0-indexed
  day: number
  dateKey: string
  isWeekend: boolean
  isInTargetYear: boolean
}

/**
 * Represents a week row in the week grid.
 */
export interface WeekData {
  weekIndex: number
  days: WeekDay[]
  /** Month label to show, if this week contains the first day of a month within target year */
  monthLabel: string | null
}

/**
 * Gets the Monday of the week containing the given date.
 */
export function getMondayOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayIndex = getMondayDayIndex(result)
  result.setDate(result.getDate() - dayIndex)
  return result
}

/**
 * Generates all weeks for a given year in the weekend-aligned format.
 * Starts from the Monday of the week containing Jan 1, ends with the week containing Dec 31.
 * Each week runs Mon-Sun.
 */
export function getWeeksForYear(year: number): WeekData[] {
  const weeks: WeekData[] = []

  // Find the Monday of the week containing Jan 1
  const jan1 = new Date(year, 0, 1)
  let currentMonday = getMondayOfWeek(jan1)

  // Find the last day we need to cover (Dec 31)
  const dec31 = new Date(year, 11, 31)

  let weekIndex = 0
  let lastMonthLabelShown = -1

  while (currentMonday <= dec31) {
    const days: WeekDay[] = []
    let monthLabelForWeek: string | null = null

    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(currentMonday, i)
      const dayYear = dayDate.getFullYear()
      const dayMonth = dayDate.getMonth()
      const dayDay = dayDate.getDate()
      const isInTargetYear = dayYear === year

      // Check if this day is the 1st of a month in the target year
      // and we haven't shown this month's label yet
      if (isInTargetYear && dayDay === 1 && dayMonth > lastMonthLabelShown) {
        monthLabelForWeek = MONTHS[dayMonth]
        lastMonthLabelShown = dayMonth
      }

      days.push({
        year: dayYear,
        month: dayMonth,
        day: dayDay,
        dateKey: getDateKeyFromParts(dayYear, dayMonth + 1, dayDay),
        isWeekend: i >= 5, // Sat=5, Sun=6 in Mon-first
        isInTargetYear,
      })
    }

    weeks.push({
      weekIndex,
      days,
      monthLabel: monthLabelForWeek,
    })

    weekIndex++
    currentMonday = addDays(currentMonday, 7)
  }

  return weeks
}
