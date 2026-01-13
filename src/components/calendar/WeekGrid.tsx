import { useEffect, useMemo, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import clsx from 'clsx'
import {
  MONTHS,
  WEEKDAYS,
  getWeeksForYear,
  isPastDate,
  isToday,
  getDateKeyFromParts,
  parseDateValue,
  type WeekData,
  type WeekDay,
} from '../../utils/dateUtils'
import { buildGoogleCalendarCreateUrl, buildGoogleCalendarDayUrl } from '../../utils/googleCalendar'
import type { CategoryConfig } from '../../types/categories'
import type { YearbirdEvent } from '../../types/calendar'
import { useTooltip, type TooltipSource } from '../../hooks/useTooltip'
import { EventTooltip } from './EventTooltip'
import { DaySummaryPopover } from './DaySummaryPopover'
import { calculateWeekEventBars, type WeekEventBar } from './weekGridUtils'

interface WeekGridProps {
  year: number
  events: YearbirdEvent[]
  /** Timed events by date (YYYY-MM-DD) for showing in day popover */
  timedEventsByDate?: Map<string, YearbirdEvent[]>
  today: Date
  onHideEvent?: (title: string) => void
  categories: CategoryConfig[]
  /** Called when the grid has finished initial render */
  onReady?: () => void
}

/**
 * Builds a map of all-day and multi-day events by date key.
 */
const buildAllDayEventMap = (
  events: YearbirdEvent[],
  _year: number,
  categoryPriority: Map<string, number>
) => {
  const map = new Map<string, YearbirdEvent[]>()
  const sortedEvents = [...events].sort((a, b) => {
    const priorityA = categoryPriority.get(a.category) ?? Number.MAX_SAFE_INTEGER
    const priorityB = categoryPriority.get(b.category) ?? Number.MAX_SAFE_INTEGER
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    if (a.durationDays !== b.durationDays) {
      return b.durationDays - a.durationDays
    }
    if (a.startDate !== b.startDate) {
      return a.startDate.localeCompare(b.startDate)
    }
    return a.title.localeCompare(b.title)
  })

  for (const event of sortedEvents) {
    if (event.isSingleDayTimed) {
      continue
    }

    // Use parseDateValue to avoid timezone issues with new Date()
    const start = parseDateValue(event.startDate)
    const end = parseDateValue(event.endDate)
    if (!start || !end) {
      continue
    }

    const current = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    while (current <= end) {
      // Include days from adjacent years that appear in our weeks
      const key = getDateKeyFromParts(current.getFullYear(), current.getMonth() + 1, current.getDate())
      const existing = map.get(key)
      if (existing) {
        existing.push(event)
      } else {
        map.set(key, [event])
      }
      current.setDate(current.getDate() + 1)
    }
  }

  return map
}

/**
 * Builds a map of single-day events by date key.
 */
const buildSingleDayEventMap = (
  events: YearbirdEvent[],
  _year: number,
  categoryPriority: Map<string, number>
) => {
  const map = new Map<string, YearbirdEvent[]>()
  const sortedEvents = [...events].sort((a, b) => {
    const priorityA = categoryPriority.get(a.category) ?? Number.MAX_SAFE_INTEGER
    const priorityB = categoryPriority.get(b.category) ?? Number.MAX_SAFE_INTEGER
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    if (a.durationDays !== b.durationDays) {
      return b.durationDays - a.durationDays
    }
    if (a.startDate !== b.startDate) {
      return a.startDate.localeCompare(b.startDate)
    }
    return a.title.localeCompare(b.title)
  })

  for (const event of sortedEvents) {
    if (event.durationDays > 1) {
      continue
    }

    // Use parseDateValue to avoid timezone issues with new Date()
    const start = parseDateValue(event.startDate)
    if (!start) {
      continue
    }

    const key = getDateKeyFromParts(start.getFullYear(), start.getMonth() + 1, start.getDate())
    const existing = map.get(key)
    if (existing) {
      existing.push(event)
    } else {
      map.set(key, [event])
    }
  }

  return map
}

export function WeekGrid({
  year,
  events,
  timedEventsByDate,
  today,
  onHideEvent,
  categories,
  onReady,
}: WeekGridProps) {
  const { tooltip, tooltipRef, showTooltip, hideTooltip } = useTooltip()

  // Call onReady after initial render
  useEffect(() => {
    onReady?.()
  }, [onReady])

  const categoryPriority = useMemo(
    () => new Map(categories.map((category, index) => [category.category, index])),
    [categories]
  )

  const weeks = useMemo(() => getWeeksForYear(year), [year])

  const singleDayEventsByDate = useMemo(
    () => buildSingleDayEventMap(events, year, categoryPriority),
    [events, year, categoryPriority]
  )

  const allDayEventsByDate = useMemo(
    () => buildAllDayEventMap(events, year, categoryPriority),
    [events, year, categoryPriority]
  )

  const weekEventBars = useMemo(
    () => calculateWeekEventBars(events, weeks),
    [events, weeks]
  )

  return (
    <div className="flex min-h-full w-full flex-col">
      {/* Week day header (Mon-Sun) */}
      <WeekDayHeader />

      {/* Week rows with visible separators */}
      <div className="flex flex-col gap-px flex-none bg-zinc-200/70">
        {weeks.map((week) => (
          <WeekRow
            key={week.weekIndex}
            week={week}
            year={year}
            today={today}
            singleDayEventsByDate={singleDayEventsByDate}
            allDayEventsByDate={allDayEventsByDate}
            timedEventsByDate={timedEventsByDate}
            categories={categories}
            eventBars={weekEventBars.get(week.weekIndex) ?? []}
            onEventHover={showTooltip}
          />
        ))}
      </div>

      {tooltip.event ? (
        <EventTooltip
          ref={tooltipRef}
          event={tooltip.event}
          position={tooltip.position}
          categories={categories}
          onHideEvent={
            onHideEvent
              ? (title) => {
                  onHideEvent(title)
                  hideTooltip()
                }
              : undefined
          }
          autoFocus={tooltip.source === 'focus'}
        />
      ) : null}
    </div>
  )
}

function WeekDayHeader() {
  return (
    <div className="sticky top-0 z-20 flex flex-none border-b border-zinc-200/70 bg-white/95 backdrop-blur">
      <div className="flex-none bg-white/95" style={{ width: 'var(--tv-month-column)' }} />
      <div
        className="grid flex-1 grid-cols-7 bg-zinc-200/70"
        style={{ gap: 'var(--tv-grid-gap)' }}
      >
        {WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className={clsx(
              'flex items-center justify-center px-0.5 font-medium md:py-1',
              index >= 5 ? 'bg-amber-50/80 text-amber-700/70' : 'bg-white text-zinc-400'
            )}
            style={{
              height: 'var(--tv-day-header-height)',
              fontSize: 'var(--tv-day-header)',
            }}
          >
            <span className="hidden md:inline">{day}</span>
            <span className="md:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface WeekRowProps {
  week: WeekData
  year: number
  today: Date
  singleDayEventsByDate: Map<string, YearbirdEvent[]>
  allDayEventsByDate: Map<string, YearbirdEvent[]>
  timedEventsByDate?: Map<string, YearbirdEvent[]>
  categories: CategoryConfig[]
  eventBars: WeekEventBar[]
  onEventHover?: (event: YearbirdEvent, position: { x: number; y: number }, source?: TooltipSource) => void
}

function WeekRow({
  week,
  year,
  today,
  singleDayEventsByDate,
  allDayEventsByDate,
  timedEventsByDate,
  categories,
  eventBars,
  onEventHover,
}: WeekRowProps) {
  // Calculate row height based on number of event bar rows
  const barRowCount = eventBars.length > 0 ? Math.max(...eventBars.map((b) => b.row + 1)) : 0
  const baseHeight = 3.5 // rem
  const barHeight = 1.25 // rem per bar row
  const minHeight = baseHeight + barRowCount * barHeight

  const rowStyle: CSSProperties = {
    minHeight: `${minHeight}rem`,
  }

  return (
    <div className="flex min-h-0" style={rowStyle}>
      {/* Month label column */}
      <div
        className="flex flex-none items-center justify-end bg-white pr-2"
        style={{ width: 'var(--tv-month-column)' }}
      >
        {week.monthLabel ? (
          <span
            className="font-semibold text-zinc-500"
            style={{ fontSize: 'var(--tv-month-label)' }}
          >
            {week.monthLabel}
          </span>
        ) : null}
      </div>

      {/* Day cells with event bars overlay */}
      <div className="relative flex-1">
        {/* Grid of day cells */}
        <div
          className="grid h-full grid-cols-7"
          style={{ gap: '1px', backgroundColor: 'rgb(228 228 231 / 0.5)' }}
        >
          {week.days.map((day) => (
            <WeekDayCell
              key={day.dateKey}
              day={day}
              year={year}
              today={today}
              singleDayEvents={singleDayEventsByDate.get(day.dateKey) ?? []}
              allDayEvents={allDayEventsByDate.get(day.dateKey) ?? []}
              timedEvents={timedEventsByDate?.get(day.dateKey) ?? []}
              allEventsByDate={allDayEventsByDate}
              allTimedEventsByDate={timedEventsByDate}
              categories={categories}
              onEventClick={(event, position) => onEventHover?.(event, position, 'pointer')}
            />
          ))}
        </div>

        {/* Event bars overlay */}
        {eventBars.length > 0 && (
          <WeekEventBars
            bars={eventBars}
            onEventClick={(event, position) => onEventHover?.(event, position, 'pointer')}
          />
        )}
      </div>
    </div>
  )
}

interface WeekEventBarsProps {
  bars: WeekEventBar[]
  onEventClick?: (event: YearbirdEvent, position: { x: number; y: number }) => void
}

const BAR_HEIGHT = 20 // px
const BAR_GAP = 2 // px
const BAR_TOP_OFFSET = 18 // px - space for day number

function WeekEventBars({ bars, onEventClick }: WeekEventBarsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10" style={{ top: BAR_TOP_OFFSET }}>
      {bars.map((bar) => {
        const left = (bar.startCol / 7) * 100
        const width = ((bar.endCol - bar.startCol + 1) / 7) * 100
        const top = bar.row * (BAR_HEIGHT + BAR_GAP)

        const handleClick = (e: MouseEvent<HTMLDivElement>) => {
          onEventClick?.(bar.event, { x: e.clientX, y: e.clientY })
        }

        const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const rect = e.currentTarget.getBoundingClientRect()
            onEventClick?.(bar.event, { x: rect.left + rect.width / 2, y: rect.top + rect.height })
          }
        }

        return (
          <div
            key={`${bar.event.id}-${bar.weekIndex}`}
            className="pointer-events-auto absolute"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              top: `${top}px`,
              height: `${BAR_HEIGHT}px`,
              paddingLeft: '2px',
              paddingRight: '2px',
            }}
          >
            <div
              className={clsx(
                'flex h-full w-full cursor-pointer items-center truncate rounded-sm px-1.5',
                'text-[11px] font-medium text-white',
                'transition hover:brightness-110',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/80'
              )}
              style={{ backgroundColor: bar.event.color }}
              role="button"
              tabIndex={0}
              aria-label={bar.event.title}
              onClick={handleClick}
              onKeyDown={handleKeyDown}
            >
              <span className="truncate">{bar.event.title}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface WeekDayCellProps {
  day: WeekDay
  year: number
  today: Date
  singleDayEvents: YearbirdEvent[]
  allDayEvents: YearbirdEvent[]
  timedEvents: YearbirdEvent[]
  allEventsByDate?: Map<string, YearbirdEvent[]>
  allTimedEventsByDate?: Map<string, YearbirdEvent[]>
  categories: CategoryConfig[]
  onEventClick?: (event: YearbirdEvent, position: { x: number; y: number }) => void
}

function WeekDayCell({
  day,
  year,
  today,
  singleDayEvents,
  allDayEvents,
  timedEvents,
  allEventsByDate,
  allTimedEventsByDate,
  categories,
  onEventClick,
}: WeekDayCellProps) {
  const isTodayDate = isToday(day.year, day.month, day.day, today)
  const isPast = isPastDate(day.year, day.month, day.day, today)
  const createUrl = buildGoogleCalendarCreateUrl(day.year, day.month, day.day)
  const dayUrl = buildGoogleCalendarDayUrl(day.year, day.month, day.day)
  const hasEvents = singleDayEvents.length > 0
  const hasTimedEvents = timedEvents.length > 0
  const hasAllDayEvents = allDayEvents.length > 0
  const hasAnyEvents = hasEvents || hasAllDayEvents || hasTimedEvents

  // Event dots
  const cellContent = singleDayEvents.length > 0 ? (
    <div
      className="pointer-events-none absolute bottom-1 left-1 flex items-center gap-1"
      aria-hidden="true"
    >
      {singleDayEvents.slice(0, 3).map((event) => (
        <span
          key={`${day.dateKey}-${event.id}`}
          className="h-1.5 w-1.5 rounded-sm"
          style={{ backgroundColor: event.color }}
          data-color={event.color}
        />
      ))}
      {singleDayEvents.length > 3 ? (
        <span className="text-[8px] font-semibold text-zinc-400">+</span>
      ) : null}
    </div>
  ) : null

  // Day number in top-left
  const dayNumber = (
    <span
      className={clsx(
        'absolute left-1 top-0.5 text-[10px] font-medium',
        day.isInTargetYear
          ? day.isWeekend
            ? 'text-amber-700/60'
            : 'text-zinc-400'
          : 'text-zinc-300'
      )}
    >
      {day.day}
    </span>
  )

  const cellClassName = clsx(
    'relative block h-full w-full cursor-pointer border border-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500',
    day.isWeekend ? 'bg-amber-50/50' : 'bg-white',
    !day.isInTargetYear && 'opacity-40',
    day.isInTargetYear && isPast && 'opacity-60',
    isTodayDate && 'border-sky-500/80 today-ring'
  )

  // With events: use popover
  if (hasAnyEvents) {
    const date = new Date(day.year, day.month, day.day)
    const totalEvents = allDayEvents.length + timedEvents.length
    const ariaLabel = `View ${totalEvents} event${totalEvents === 1 ? '' : 's'} on ${MONTHS[day.month]} ${day.day}, ${day.year}`

    return (
      <div className="group relative h-full w-full">
        <DaySummaryPopover
          date={date}
          events={allDayEvents}
          timedEvents={timedEvents}
          allEventsByDate={allEventsByDate}
          timedEventsByDate={allTimedEventsByDate}
          year={year}
          categories={categories}
          googleCalendarCreateUrl={createUrl}
          googleCalendarDayUrl={dayUrl}
          onEventClick={onEventClick}
        >
          <div
            className={cellClassName}
            data-date={day.dateKey}
            role="button"
            tabIndex={0}
            aria-label={ariaLabel}
            aria-current={isTodayDate ? 'date' : undefined}
          >
            {dayNumber}
            {cellContent}
          </div>
        </DaySummaryPopover>
      </div>
    )
  }

  // No events: direct link to create
  const ariaLabel = `Create event on ${MONTHS[day.month]} ${day.day}, ${day.year}`
  return (
    <div className="group relative h-full w-full">
      <a
        className={cellClassName}
        data-date={day.dateKey}
        href={createUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        aria-current={isTodayDate ? 'date' : undefined}
      >
        {dayNumber}
      </a>
    </div>
  )
}
