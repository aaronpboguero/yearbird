import { beforeEach, describe, expect, it } from 'vitest'
import {
  disableCalendar,
  enableCalendar,
  getDisabledCalendars,
  setDisabledCalendars,
} from './calendarVisibility'

describe('calendarVisibility (in-memory)', () => {
  beforeEach(() => {
    // Reset to empty state before each test
    setDisabledCalendars([])
  })

  it('returns empty list by default', () => {
    expect(getDisabledCalendars()).toEqual([])
  })

  it('setDisabledCalendars dedupes and trims entries', () => {
    const result = setDisabledCalendars([' primary ', '', 'primary', 'work'])
    expect(result).toEqual(['primary', 'work'])
    expect(getDisabledCalendars()).toEqual(['primary', 'work'])
  })

  it('setDisabledCalendars handles non-array input', () => {
    const result = setDisabledCalendars(null as unknown as string[])
    expect(result).toEqual([])
  })

  it('setDisabledCalendars filters out non-strings', () => {
    const result = setDisabledCalendars(['primary', 123 as unknown as string, null as unknown as string, 'work'])
    expect(result).toEqual(['primary', 'work'])
  })

  it('disableCalendar adds a calendar to the list', () => {
    expect(disableCalendar('primary')).toEqual(['primary'])
    expect(getDisabledCalendars()).toEqual(['primary'])
  })

  it('disableCalendar does not duplicate existing entries', () => {
    disableCalendar('primary')
    expect(disableCalendar('primary')).toEqual(['primary'])
    expect(getDisabledCalendars()).toEqual(['primary'])
  })

  it('enableCalendar removes a calendar from the list', () => {
    disableCalendar('primary')
    disableCalendar('work')
    expect(enableCalendar('primary')).toEqual(['work'])
    expect(getDisabledCalendars()).toEqual(['work'])
  })

  it('enableCalendar returns unchanged list if calendar not disabled', () => {
    disableCalendar('primary')
    expect(enableCalendar('missing')).toEqual(['primary'])
    expect(getDisabledCalendars()).toEqual(['primary'])
  })

  it('enableCalendar returns empty list when last calendar enabled', () => {
    disableCalendar('primary')
    expect(enableCalendar('primary')).toEqual([])
    expect(getDisabledCalendars()).toEqual([])
  })
})
