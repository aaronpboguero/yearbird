import { describe, expect, it } from 'vitest'
import { calculateWeekEventBars } from './WeekGrid'
import { getWeeksForYear, getDateKeyFromParts } from '../../utils/dateUtils'
import type { YearbirdEvent } from '../../types/calendar'

// Helper to create a minimal event for testing
const createEvent = (
  id: string,
  startDate: string,
  endDate: string,
  durationDays: number
): YearbirdEvent => ({
  id,
  title: id,
  startDate,
  endDate,
  durationDays,
  category: 'other',
  color: '#888888',
  isSingleDayTimed: false,
})

// Helper to find which column a specific date falls on in a week
const findColumnForDate = (
  weeks: ReturnType<typeof getWeeksForYear>,
  year: number,
  month: number, // 0-indexed
  day: number
): { weekIndex: number; col: number } | null => {
  for (const week of weeks) {
    const col = week.days.findIndex(
      (d) => d.year === year && d.month === month && d.day === day
    )
    if (col !== -1) {
      return { weekIndex: week.weekIndex, col }
    }
  }
  return null
}

describe('calculateWeekEventBars', () => {
  describe('date alignment regression tests', () => {
    it('places MLK Day (Jan 19-20, 2025) in correct columns', () => {
      // MLK Day 2025 is Monday Jan 20 (observed), but let's test Jan 19-20
      // Jan 19, 2025 is a Sunday (column 6), Jan 20, 2025 is a Monday (column 0)
      const events = [
        createEvent('mlk-day', '2025-01-19', '2025-01-20', 2),
      ]
      const weeks = getWeeksForYear(2025)
      const bars = calculateWeekEventBars(events, weeks)

      // Find the week containing Jan 19 (Sunday)
      const weekWithJan19 = weeks.find((w) =>
        w.days.some((d) => d.year === 2025 && d.month === 0 && d.day === 19)
      )
      expect(weekWithJan19).toBeDefined()

      // Find the week containing Jan 20 (Monday)
      const weekWithJan20 = weeks.find((w) =>
        w.days.some((d) => d.year === 2025 && d.month === 0 && d.day === 20)
      )
      expect(weekWithJan20).toBeDefined()

      // The event should span two weeks since Sun-Mon cross the week boundary
      // Week 1: Jan 13-19 (Mon-Sun), event starts on Sun (col 6)
      // Week 2: Jan 20-26 (Mon-Sun), event ends on Mon (col 0)

      if (weekWithJan19 && weekWithJan20) {
        // Verify Jan 19 is Sunday (column 6) in its week
        const jan19Col = weekWithJan19.days.findIndex(
          (d) => d.year === 2025 && d.month === 0 && d.day === 19
        )
        expect(jan19Col).toBe(6) // Sunday is column 6

        // Verify Jan 20 is Monday (column 0) in its week
        const jan20Col = weekWithJan20.days.findIndex(
          (d) => d.year === 2025 && d.month === 0 && d.day === 20
        )
        expect(jan20Col).toBe(0) // Monday is column 0

        // Get bars for week containing Jan 19
        const barsForWeek1 = bars.get(weekWithJan19.weekIndex) ?? []
        const mlkBarWeek1 = barsForWeek1.find((b) => b.event.id === 'mlk-day')

        if (weekWithJan19.weekIndex !== weekWithJan20.weekIndex) {
          // Event crosses week boundary
          expect(mlkBarWeek1).toBeDefined()
          expect(mlkBarWeek1?.startCol).toBe(6) // Starts on Sunday
          expect(mlkBarWeek1?.endCol).toBe(6) // Ends on Sunday in this week

          // Get bars for week containing Jan 20
          const barsForWeek2 = bars.get(weekWithJan20.weekIndex) ?? []
          const mlkBarWeek2 = barsForWeek2.find((b) => b.event.id === 'mlk-day')
          expect(mlkBarWeek2).toBeDefined()
          expect(mlkBarWeek2?.startCol).toBe(0) // Starts on Monday
          expect(mlkBarWeek2?.endCol).toBe(0) // Ends on Monday
        }
      }
    })

    it('places single-week event on correct days', () => {
      // Event from Wed Jan 15 to Fri Jan 17, 2025
      // Jan 13-19 week: Mon(13), Tue(14), Wed(15), Thu(16), Fri(17), Sat(18), Sun(19)
      const events = [
        createEvent('mid-week-event', '2025-01-15', '2025-01-17', 3),
      ]
      const weeks = getWeeksForYear(2025)
      const bars = calculateWeekEventBars(events, weeks)

      // Find the week containing Jan 15-17
      const targetWeek = weeks.find((w) =>
        w.days.some((d) => d.year === 2025 && d.month === 0 && d.day === 15)
      )
      expect(targetWeek).toBeDefined()

      if (targetWeek) {
        // Verify column positions
        const jan15Col = targetWeek.days.findIndex(
          (d) => d.year === 2025 && d.month === 0 && d.day === 15
        )
        const jan17Col = targetWeek.days.findIndex(
          (d) => d.year === 2025 && d.month === 0 && d.day === 17
        )
        expect(jan15Col).toBe(2) // Wednesday
        expect(jan17Col).toBe(4) // Friday

        const weekBars = bars.get(targetWeek.weekIndex) ?? []
        const eventBar = weekBars.find((b) => b.event.id === 'mid-week-event')
        expect(eventBar).toBeDefined()
        expect(eventBar?.startCol).toBe(2) // Wednesday
        expect(eventBar?.endCol).toBe(4) // Friday
      }
    })

    it('handles event starting on exact day without off-by-one error', () => {
      // Regression test: ensure events don't shift by one day
      // Create an event on Jan 20, 2025 (Monday) only
      const events = [
        createEvent('single-monday', '2025-01-20', '2025-01-21', 2),
      ]
      const weeks = getWeeksForYear(2025)
      const bars = calculateWeekEventBars(events, weeks)

      // Find the week containing Jan 20
      const targetWeek = weeks.find((w) =>
        w.days.some((d) => d.year === 2025 && d.month === 0 && d.day === 20)
      )
      expect(targetWeek).toBeDefined()

      if (targetWeek) {
        // Jan 20 should be column 0 (Monday)
        const jan20Col = targetWeek.days.findIndex(
          (d) => d.year === 2025 && d.month === 0 && d.day === 20
        )
        expect(jan20Col).toBe(0)

        // Jan 21 should be column 1 (Tuesday)
        const jan21Col = targetWeek.days.findIndex(
          (d) => d.year === 2025 && d.month === 0 && d.day === 21
        )
        expect(jan21Col).toBe(1)

        const weekBars = bars.get(targetWeek.weekIndex) ?? []
        const eventBar = weekBars.find((b) => b.event.id === 'single-monday')
        expect(eventBar).toBeDefined()
        // The bar should start on Monday (0) and end on Tuesday (1)
        expect(eventBar?.startCol).toBe(0)
        expect(eventBar?.endCol).toBe(1)
      }
    })

    it('MLK Day 2026 (Jan 19) should NOT appear on Jan 18 - timezone regression', () => {
      // This is a critical regression test for the timezone bug where
      // new Date("2026-01-19") would be parsed as UTC and shift to Jan 18 in local time
      // MLK Day 2026 is Monday Jan 19
      const events = [
        createEvent('mlk-2026', '2026-01-19', '2026-01-20', 2),
      ]
      const weeks = getWeeksForYear(2026)
      const bars = calculateWeekEventBars(events, weeks)

      // Jan 19, 2026 is a Monday
      const jan19Location = findColumnForDate(weeks, 2026, 0, 19)
      expect(jan19Location).not.toBeNull()
      expect(jan19Location?.col).toBe(0) // Monday = column 0

      // Jan 18, 2026 is a Sunday
      const jan18Location = findColumnForDate(weeks, 2026, 0, 18)
      expect(jan18Location).not.toBeNull()
      expect(jan18Location?.col).toBe(6) // Sunday = column 6

      // The bar should be in the week containing Jan 19, NOT Jan 18's week
      if (jan19Location && jan18Location) {
        // Jan 18 and Jan 19 are in different weeks (Sun vs Mon)
        expect(jan19Location.weekIndex).not.toBe(jan18Location.weekIndex)

        // The event should appear in Jan 19's week
        const barsInJan19Week = bars.get(jan19Location.weekIndex) ?? []
        const mlkBarCorrect = barsInJan19Week.find((b) => b.event.id === 'mlk-2026')
        expect(mlkBarCorrect).toBeDefined()
        expect(mlkBarCorrect?.startCol).toBe(0) // Monday

        // The event should NOT appear in Jan 18's week (the Sunday before)
        const barsInJan18Week = bars.get(jan18Location.weekIndex) ?? []
        const mlkBarWrong = barsInJan18Week.find((b) => b.event.id === 'mlk-2026')
        expect(mlkBarWrong).toBeUndefined()
      }
    })
  })
})
