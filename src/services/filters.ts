/**
 * Event Filters Service (In-Memory)
 *
 * Stores hidden event patterns in memory only.
 * Populated from cloud sync if enabled, otherwise starts empty.
 */

export interface EventFilter {
  id: string
  pattern: string
  createdAt: number
}

// In-memory storage
let filters: EventFilter[] = []

const createFilterId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * Get all event filters.
 */
export function getFilters(): EventFilter[] {
  return [...filters]
}

/**
 * Set all filters (used by cloud sync to populate state).
 */
export function setFilters(newFilters: EventFilter[]): void {
  filters = newFilters
    .filter(
      (f) =>
        f &&
        typeof f.id === 'string' &&
        typeof f.pattern === 'string' &&
        typeof f.createdAt === 'number'
    )
    .map((f) => ({ ...f, pattern: f.pattern.trim() }))
    .filter((f) => f.pattern.length > 0)
}

/**
 * Add a new filter pattern.
 */
export function addFilter(pattern: string): EventFilter | null {
  const trimmed = pattern.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed.toLowerCase()
  const existing = filters.find(
    (filter) => filter.pattern.trim().toLowerCase() === normalized
  )
  if (existing) {
    return existing
  }

  const newFilter: EventFilter = {
    id: createFilterId(),
    pattern: trimmed,
    createdAt: Date.now(),
  }

  filters = [...filters, newFilter]
  return newFilter
}

/**
 * Remove a filter by ID.
 */
export function removeFilter(id: string): void {
  filters = filters.filter((filter) => filter.id !== id)
}

/**
 * Clear all filters.
 */
export function clearFilters(): void {
  filters = []
}

/**
 * Check if an event title matches any filter.
 */
export function isEventFiltered(eventTitle: string, filterList: EventFilter[]): boolean {
  const lowerTitle = eventTitle.toLowerCase()
  return filterList.some((filter) => {
    const pattern = filter.pattern.trim()
    if (!pattern) {
      return false
    }
    return lowerTitle.includes(pattern.toLowerCase())
  })
}
