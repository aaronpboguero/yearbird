import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCalendarVisibility } from './useCalendarVisibility'
import { setDisabledCalendars } from '../services/calendarVisibility'

const calendars = [{ id: 'primary', summary: 'Personal' }]

describe('useCalendarVisibility', () => {
  beforeEach(() => {
    // Reset in-memory state before each test
    setDisabledCalendars([])
  })

  it('filters unknown calendar ids from in-memory state', () => {
    // Set up in-memory state with a mix of valid and invalid ids
    setDisabledCalendars(['primary', 'unknown'])

    const { result } = renderHook(() => useCalendarVisibility(calendars))

    // The hook should filter out 'unknown' since it's not in the calendar list
    expect(result.current.disabledCalendarIds).toEqual(['primary'])
  })

  it('keeps stored ids when calendar list is empty', () => {
    setDisabledCalendars(['primary'])

    const { result } = renderHook(() => useCalendarVisibility([]))

    // When calendar list is empty, preserve existing disabled IDs
    expect(result.current.disabledCalendarIds).toEqual(['primary'])
  })

  it('toggles visibility', () => {
    const { result } = renderHook(() => useCalendarVisibility(calendars))

    expect(result.current.visibleCalendarIds).toEqual(['primary'])

    act(() => {
      result.current.disableCalendar('primary')
    })
    expect(result.current.visibleCalendarIds).toEqual([])

    act(() => {
      result.current.enableCalendar('primary')
    })
    expect(result.current.visibleCalendarIds).toEqual(['primary'])
  })
})
