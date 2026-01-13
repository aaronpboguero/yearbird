import { parseDateValue, type WeekData } from '../../utils/dateUtils'
import type { YearbirdEvent } from '../../types/calendar'

/** Event bar for week view - spans columns 0-6 (Mon-Sun) */
export interface WeekEventBar {
  event: YearbirdEvent
  weekIndex: number
  startCol: number // 0-6
  endCol: number // 0-6
  row: number
}

/** Compare two dates by year, month, day only (ignoring time) */
const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/** Compare dates by day only: returns true if a < b */
const isDayLess = (a: Date, b: Date): boolean => {
  if (a.getFullYear() !== b.getFullYear()) return a.getFullYear() < b.getFullYear()
  if (a.getMonth() !== b.getMonth()) return a.getMonth() < b.getMonth()
  return a.getDate() < b.getDate()
}

/**
 * Calculate event bars for each week. Multi-day events get bars that span
 * the appropriate columns (0-6 for Mon-Sun) within each week.
 */
export const calculateWeekEventBars = (
  events: YearbirdEvent[],
  weeks: WeekData[]
): Map<number, WeekEventBar[]> => {
  const barsByWeek = new Map<number, WeekEventBar[]>()

  // Only process multi-day events
  const multiDayEvents = events.filter((e) => e.durationDays > 1)

  for (const event of multiDayEvents) {
    const startDate = parseDateValue(event.startDate)
    const endDate = parseDateValue(event.endDate)

    if (!startDate || !endDate) continue
    if (isDayLess(endDate, startDate)) continue

    // For each week, check if this event overlaps
    for (const week of weeks) {
      const weekStart = new Date(week.days[0].year, week.days[0].month, week.days[0].day)
      const weekEnd = new Date(week.days[6].year, week.days[6].month, week.days[6].day)

      // Check if event overlaps this week (using day-only comparison)
      if (isDayLess(endDate, weekStart) || isDayLess(weekEnd, startDate)) continue

      // Calculate which columns (0-6) the event spans in this week
      const effectiveStart = isDayLess(startDate, weekStart) ? weekStart : startDate
      const effectiveEnd = isDayLess(weekEnd, endDate) ? weekEnd : endDate

      // Find column indices by matching year/month/day
      let startCol = 0
      let endCol = 6
      for (let i = 0; i < 7; i++) {
        const day = week.days[i]
        const dayDate = new Date(day.year, day.month, day.day)
        if (isSameDay(dayDate, effectiveStart)) startCol = i
        if (isSameDay(dayDate, effectiveEnd)) endCol = i
      }

      const existing = barsByWeek.get(week.weekIndex) ?? []
      existing.push({
        event,
        weekIndex: week.weekIndex,
        startCol,
        endCol,
        row: 0, // Will be calculated in stacking pass
      })
      barsByWeek.set(week.weekIndex, existing)
    }
  }

  // Calculate stacking rows for each week
  for (const [_weekIndex, bars] of barsByWeek) {
    // Sort by start column, then by duration (longer first)
    bars.sort((a, b) => {
      if (a.startCol !== b.startCol) return a.startCol - b.startCol
      return b.endCol - b.startCol - (a.endCol - a.startCol)
    })

    const rowEndCols: number[] = []
    for (const bar of bars) {
      const availableRow = rowEndCols.findIndex((endCol) => endCol < bar.startCol)
      const assignedRow = availableRow === -1 ? rowEndCols.length : availableRow
      bar.row = assignedRow
      rowEndCols[assignedRow] = bar.endCol
    }
  }

  return barsByWeek
}
