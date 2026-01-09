import { DEFAULT_CATEGORY } from '../config/categories'
import { UNCATEGORIZED_CATEGORY } from '../services/categories'
import type { Category, CategoryConfig, CategoryMatchMode } from '../types/categories'
import type { EventCategory } from '../types/calendar'

const DEFAULT_MATCH_MODE: CategoryMatchMode = 'any'

/**
 * Convert a Category to CategoryConfig for display and matching.
 */
const toCategoryConfig = (category: Category): CategoryConfig => ({
  category: category.id,
  color: category.color,
  keywords: category.keywords,
  label: category.label,
  matchMode: category.matchMode,
})

/**
 * Sort categories alphabetically by label.
 */
const sortCategories = (categories: Category[]): Category[] =>
  [...categories].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  )

/**
 * Get all categories for display (legend, etc.), including uncategorized at the end.
 */
export function getAllCategories(categories: Category[] = []): CategoryConfig[] {
  const sorted = sortCategories(categories).map(toCategoryConfig)
  return [...sorted, toCategoryConfig(UNCATEGORIZED_CATEGORY)]
}

/**
 * Get categories for event matching (excludes uncategorized).
 * Categories are sorted alphabetically by label for consistent priority.
 */
export function getCategoryMatchList(categories: Category[] = []): CategoryConfig[] {
  return sortCategories(categories).map(toCategoryConfig)
}

/**
 * Check if a title matches the keywords based on the match mode.
 */
const matchesKeywords = (
  lowerTitle: string,
  keywords: string[],
  matchMode: CategoryMatchMode
): boolean => {
  if (keywords.length === 0) {
    return false
  }

  if (matchMode === 'all') {
    return keywords.every((keyword) => lowerTitle.includes(keyword.toLowerCase()))
  }

  return keywords.some((keyword) => lowerTitle.includes(keyword.toLowerCase()))
}

/**
 * Categorize an event by its title.
 * Returns the first matching category or uncategorized.
 */
export function categorizeEvent(
  title: string,
  categories: CategoryConfig[] = []
): { category: EventCategory; color: string } {
  const lowerTitle = title.toLowerCase()

  for (const config of categories) {
    const matchMode = config.matchMode ?? DEFAULT_MATCH_MODE
    if (matchesKeywords(lowerTitle, config.keywords, matchMode)) {
      return {
        category: config.category,
        color: config.color,
      }
    }
  }

  return {
    category: DEFAULT_CATEGORY.category,
    color: DEFAULT_CATEGORY.color,
  }
}

/**
 * Get the configuration for a specific category by ID.
 */
export function getCategoryConfig(
  category: EventCategory,
  categories: CategoryConfig[] = []
): CategoryConfig {
  return categories.find((config) => config.category === category) ?? DEFAULT_CATEGORY
}
