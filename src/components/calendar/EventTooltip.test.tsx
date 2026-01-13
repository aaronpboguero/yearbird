import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCategories } from '../../services/categories'
import { getAllCategories } from '../../utils/categorize'
import { EventTooltip } from './EventTooltip'

const baseEvent = {
  id: 'event:1',
  title: 'Team Offsite',
  startDate: '2025-04-10',
  endDate: '2025-04-12',
  isAllDay: true,
  isMultiDay: true,
  durationDays: 3,
  googleLink: 'https://calendar.google.com',
  calendarId: 'primary',
  calendarName: 'Team Calendar',
  calendarColor: '#38BDF8',
  category: 'work',
  color: '#8B5CF6',
} as const

class ResizeObserverMock {
  private callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe() {
    this.callback([], this)
    this.callback([
      {
        contentRect: { width: 200, height: 120 } as DOMRectReadOnly,
      } as ResizeObserverEntry,
    ], this)
  }

  disconnect() {}
}

class ResizeObserverNoopMock {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// Helper to get categories initialized with defaults
const getCategoriesWithDefaults = () => getAllCategories(getCategories())

describe('EventTooltip', () => {
  it('renders event details and link', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    Object.defineProperty(window, 'innerWidth', { value: 320, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 240, configurable: true })

    render(
      <EventTooltip
        event={{
          ...baseEvent,
          location: 'Boulder, CO',
        }}
        position={{ x: 1000, y: 1000 }}
        categories={getCategoriesWithDefaults()}
      />
    )

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(screen.getByRole('tooltip', { name: /team offsite details/i })).toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Team Offsite')).toBeInTheDocument()
    expect(screen.getByText('Team Calendar')).toBeInTheDocument()
    expect(screen.getByText('Thu, Apr 10 – Sat, Apr 12 (3 days)')).toBeInTheDocument()
    expect(screen.getByText('Boulder, CO')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open in Google Calendar' })).toHaveAttribute(
      'href',
      'https://calendar.google.com'
    )
  })

  it('handles missing optional fields and invalid dates', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    Object.defineProperty(window, 'innerWidth', { value: 320, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 240, configurable: true })

    render(
      <EventTooltip
        event={{
          ...baseEvent,
          id: 'event-2',
          startDate: 'invalid',
          endDate: 'invalid',
          durationDays: 1,
          googleLink: '',
        }}
        position={{ x: 16, y: 16 }}
        categories={getCategoriesWithDefaults()}
      />
    )

    expect(screen.getByText('Date unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open in Google Calendar' })).toBeNull()
  })

  it('falls back to the raw position when size is unknown', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverNoopMock)
    Object.defineProperty(window, 'innerWidth', { value: 320, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 240, configurable: true })

    render(
      <EventTooltip
        event={baseEvent}
        position={{ x: 20, y: 30 }}
        categories={getCategoriesWithDefaults()}
      />
    )

    const tooltip = screen.getByRole('tooltip', { name: /team offsite details/i })
    expect(tooltip.style.left).toBe('32px')
    expect(tooltip.style.top).toBe('42px')
  })

  it('fires hide action when requested', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverNoopMock)
    const onHideEvent = vi.fn()

    render(
      <EventTooltip
        event={baseEvent}
        position={{ x: 20, y: 30 }}
        categories={getCategoriesWithDefaults()}
        onHideEvent={onHideEvent}
      />
    )

    screen.getByRole('button', { name: /hide events like team offsite/i }).click()
    expect(onHideEvent).toHaveBeenCalledWith('Team Offsite')
  })

  it('has z-index higher than DaySummaryPopover (z-50) - regression test', () => {
    // DaySummaryPopover uses z-50, EventTooltip must be higher so it appears on top
    // when clicking an event within the day popover
    vi.stubGlobal('ResizeObserver', ResizeObserverNoopMock)

    render(
      <EventTooltip
        event={baseEvent}
        position={{ x: 20, y: 30 }}
        categories={getCategoriesWithDefaults()}
      />
    )

    const tooltip = screen.getByRole('tooltip', { name: /team offsite details/i })
    // z-[60] in Tailwind compiles to z-index: 60
    expect(tooltip.className).toMatch(/z-\[60\]/)
  })

  describe('viewport edge positioning - regression tests', () => {
    // Custom mock that reports a larger tooltip size for positioning tests
    class ResizeObserverLargeMock {
      private callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }

      observe() {
        // Simulate a tooltip that's 300x250 px
        this.callback([
          {
            contentRect: { width: 300, height: 250 } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ], this)
      }

      disconnect() {}
    }

    it('flips to appear above click point when near bottom edge', () => {
      vi.stubGlobal('ResizeObserver', ResizeObserverLargeMock)
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })

      render(
        <EventTooltip
          event={baseEvent}
          position={{ x: 100, y: 500 }} // Near bottom (600 - 500 = 100px, not enough for 250px tooltip)
          categories={getCategoriesWithDefaults()}
        />
      )

      const tooltip = screen.getByRole('tooltip', { name: /team offsite details/i })
      const top = parseInt(tooltip.style.top, 10)
      // Should position above click point (500 - 250 - 12 = 238)
      expect(top).toBeLessThan(500)
    })

    it('flips to appear left of click point when near right edge', () => {
      vi.stubGlobal('ResizeObserver', ResizeObserverLargeMock)
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })

      render(
        <EventTooltip
          event={baseEvent}
          position={{ x: 700, y: 100 }} // Near right edge (800 - 700 = 100px, not enough for 300px tooltip)
          categories={getCategoriesWithDefaults()}
        />
      )

      const tooltip = screen.getByRole('tooltip', { name: /team offsite details/i })
      const left = parseInt(tooltip.style.left, 10)
      // Should position left of click point (700 - 300 - 12 = 388)
      expect(left).toBeLessThan(700)
    })

    it('positions correctly when there is enough space below and right', () => {
      vi.stubGlobal('ResizeObserver', ResizeObserverLargeMock)
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })

      render(
        <EventTooltip
          event={baseEvent}
          position={{ x: 100, y: 100 }} // Plenty of space in all directions
          categories={getCategoriesWithDefaults()}
        />
      )

      const tooltip = screen.getByRole('tooltip', { name: /team offsite details/i })
      const left = parseInt(tooltip.style.left, 10)
      const top = parseInt(tooltip.style.top, 10)
      // Should position to the right and below (100 + 12 = 112)
      expect(left).toBe(112)
      expect(top).toBe(112)
    })

    it('handles corner case when near both bottom and right edges', () => {
      vi.stubGlobal('ResizeObserver', ResizeObserverLargeMock)
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })

      render(
        <EventTooltip
          event={baseEvent}
          position={{ x: 700, y: 500 }} // Near bottom-right corner
          categories={getCategoriesWithDefaults()}
        />
      )

      const tooltip = screen.getByRole('tooltip', { name: /team offsite details/i })
      const left = parseInt(tooltip.style.left, 10)
      const top = parseInt(tooltip.style.top, 10)
      // Should flip to left and above
      expect(left).toBeLessThan(700)
      expect(top).toBeLessThan(500)
    })
  })

  describe('event details display - regression tests', () => {
    it('displays description when provided', () => {
      vi.stubGlobal('ResizeObserver', ResizeObserverNoopMock)

      render(
        <EventTooltip
          event={{
            ...baseEvent,
            description: 'This is a team building event with activities.',
          }}
          position={{ x: 20, y: 30 }}
          categories={getCategoriesWithDefaults()}
        />
      )

      expect(screen.getByText('This is a team building event with activities.')).toBeInTheDocument()
    })

    it('truncates long descriptions to 200 characters', () => {
      vi.stubGlobal('ResizeObserver', ResizeObserverNoopMock)

      const longDescription = 'A'.repeat(250)
      render(
        <EventTooltip
          event={{
            ...baseEvent,
            description: longDescription,
          }}
          position={{ x: 20, y: 30 }}
          categories={getCategoriesWithDefaults()}
        />
      )

      // Should show truncated text with ellipsis
      const truncated = screen.getByText(/^A+…$/)
      expect(truncated.textContent?.length).toBeLessThanOrEqual(201) // 200 chars + ellipsis
    })

    it('displays time range for timed events', () => {
      vi.stubGlobal('ResizeObserver', ResizeObserverNoopMock)

      render(
        <EventTooltip
          event={{
            ...baseEvent,
            isAllDay: false,
            startTime: '14:30',
            endTime: '16:00',
          }}
          position={{ x: 20, y: 30 }}
          categories={getCategoriesWithDefaults()}
        />
      )

      expect(screen.getByText('2:30 PM – 4:00 PM')).toBeInTheDocument()
    })

    it('displays "All day" for all-day events', () => {
      vi.stubGlobal('ResizeObserver', ResizeObserverNoopMock)

      render(
        <EventTooltip
          event={{
            ...baseEvent,
            isAllDay: true,
          }}
          position={{ x: 20, y: 30 }}
          categories={getCategoriesWithDefaults()}
        />
      )

      expect(screen.getByText('All day')).toBeInTheDocument()
    })

    it('displays location when provided', () => {
      vi.stubGlobal('ResizeObserver', ResizeObserverNoopMock)

      render(
        <EventTooltip
          event={{
            ...baseEvent,
            location: '1234 Main Street, Denver, CO 80202',
          }}
          position={{ x: 20, y: 30 }}
          categories={getCategoriesWithDefaults()}
        />
      )

      expect(screen.getByText('1234 Main Street, Denver, CO 80202')).toBeInTheDocument()
    })

    it('includes weekday in date format', () => {
      vi.stubGlobal('ResizeObserver', ResizeObserverNoopMock)

      render(
        <EventTooltip
          event={{
            ...baseEvent,
            startDate: '2025-01-20', // Monday
            endDate: '2025-01-20',
            durationDays: 1,
          }}
          position={{ x: 20, y: 30 }}
          categories={getCategoriesWithDefaults()}
        />
      )

      // Should show weekday (Mon, Jan 20)
      expect(screen.getByText('Mon, Jan 20')).toBeInTheDocument()
    })
  })
})
