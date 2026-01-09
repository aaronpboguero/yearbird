/**
 * Unified Categories Service (In-Memory)
 *
 * Manages all categories (both default and user-created) in memory.
 * Populated from cloud sync if enabled, otherwise starts with defaults.
 */

import { DEFAULT_CATEGORIES, UNCATEGORIZED_CATEGORY } from '../config/categories'
import type { Category, CategoryInput, CategoryMatchMode, CategoryResult } from '../types/categories'

const CUSTOM_CATEGORY_PREFIX = 'custom-'
const DEFAULT_MATCH_MODE: CategoryMatchMode = 'any'
const MAX_LABEL_LENGTH = 32

// In-memory storage - initialized with defaults
let categories: Category[] = initializeDefaults()

// Subscription mechanism for external state changes (e.g., cloud sync)
type CategoriesListener = (categories: Category[]) => void
const listeners = new Set<CategoriesListener>()

/**
 * Subscribe to category changes from external sources (e.g., cloud sync).
 * Returns an unsubscribe function.
 */
export function subscribeToCategories(listener: CategoriesListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Notify all listeners of category changes.
 */
function notifyListeners(): void {
  const currentCategories = [...categories]
  for (const listener of listeners) {
    listener(currentCategories)
  }
}

const createCategoryId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${CUSTOM_CATEGORY_PREFIX}${crypto.randomUUID()}`
  }
  return `${CUSTOM_CATEGORY_PREFIX}${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const normalizeLabel = (label: string) => label.trim()

const normalizeMatchMode = (mode: CategoryMatchMode | null | undefined): CategoryMatchMode =>
  mode === 'all' ? 'all' : DEFAULT_MATCH_MODE

const normalizeKeywords = (keywords: string[]): string[] => {
  const cleaned: string[] = []
  const seen = new Set<string>()

  for (const keyword of keywords) {
    const trimmed = keyword.trim()
    if (!trimmed) {
      continue
    }
    const normalized = trimmed.toLowerCase()
    if (seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    cleaned.push(trimmed)
  }

  return cleaned
}

const isValidColor = (color: string): boolean => /^#[0-9a-fA-F]{6}$/.test(color)

/**
 * Sanitize and validate a list of categories.
 */
const sanitizeCategories = (cats: Category[]): Category[] => {
  const deduped = new Map<string, Category>()

  for (const entry of cats) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    if (typeof entry.id !== 'string' || !entry.id) {
      continue
    }

    const label = normalizeLabel(entry.label || '')
    const keywords = normalizeKeywords(Array.isArray(entry.keywords) ? entry.keywords : [])
    if (!label || !isValidColor(entry.color)) {
      continue
    }

    const matchMode = normalizeMatchMode(entry.matchMode)
    const createdAt = Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now()
    const updatedAt = Number.isFinite(entry.updatedAt) ? entry.updatedAt : createdAt

    const candidate: Category = {
      id: entry.id,
      label,
      color: entry.color,
      keywords,
      matchMode,
      createdAt,
      updatedAt,
      isDefault: entry.isDefault ?? false,
    }

    // Dedupe by lowercase label - keep the one with later updatedAt
    const normalizedLabel = label.toLowerCase()
    const existing = deduped.get(normalizedLabel)
    if (!existing || candidate.updatedAt > existing.updatedAt) {
      deduped.set(normalizedLabel, candidate)
    }
  }

  return Array.from(deduped.values())
}

/**
 * Initialize with default categories.
 */
function initializeDefaults(): Category[] {
  const now = Date.now()
  return DEFAULT_CATEGORIES.map((cat) => ({
    ...cat,
    createdAt: now,
    updatedAt: now,
  }))
}

/**
 * Get all user categories (excludes uncategorized).
 */
export function getCategories(): Category[] {
  return [...categories]
}

/**
 * Set all categories (used by cloud sync to populate state).
 */
export function setCategories(newCategories: Category[]): void {
  categories = sanitizeCategories(newCategories)
  notifyListeners()
}

/**
 * Build a category from input with validation.
 */
const buildCategory = (
  input: CategoryInput,
  existing: Category[],
  id?: string
): CategoryResult => {
  const label = normalizeLabel(input.label)
  if (!label) {
    return { category: null, error: 'Name is required.' }
  }
  if (label.length > MAX_LABEL_LENGTH) {
    return { category: null, error: `Name must be ${MAX_LABEL_LENGTH} characters or fewer.` }
  }

  const keywords = normalizeKeywords(input.keywords)
  if (keywords.length === 0) {
    return { category: null, error: 'Add at least one keyword.' }
  }

  if (!isValidColor(input.color)) {
    return { category: null, error: 'Pick a valid color.' }
  }

  // Check for duplicate labels (excluding current category if editing)
  const normalizedLabel = label.toLowerCase()
  const duplicate = existing.find(
    (entry) => entry.id !== id && entry.label.toLowerCase() === normalizedLabel
  )
  if (duplicate) {
    return { category: null, error: 'A category with this name already exists.' }
  }

  // Cannot use 'uncategorized' as a name
  if (normalizedLabel === 'uncategorized') {
    return { category: null, error: 'This name is reserved.' }
  }

  const now = Date.now()
  const matchMode = normalizeMatchMode(input.matchMode)
  const existingCat = id ? existing.find((entry) => entry.id === id) : null

  const category: Category = {
    id: id ?? createCategoryId(),
    label,
    color: input.color,
    keywords,
    matchMode,
    createdAt: existingCat?.createdAt ?? now,
    updatedAt: now,
    isDefault: existingCat?.isDefault ?? false,
  }

  return { category, error: null }
}

/**
 * Add a new category.
 */
export function addCategory(input: CategoryInput): CategoryResult {
  const result = buildCategory(input, categories)
  if (!result.category) {
    return result
  }

  categories = [...categories, result.category]
  return result
}

/**
 * Update an existing category.
 */
export function updateCategory(id: string, input: CategoryInput): CategoryResult {
  const current = categories.find((entry) => entry.id === id)
  if (!current) {
    return { category: null, error: 'Category not found.' }
  }

  const result = buildCategory(input, categories, id)
  if (!result.category) {
    return result
  }

  categories = categories.map((entry) => (entry.id === id ? result.category! : entry))
  return result
}

/**
 * Remove a category by ID.
 */
export function removeCategory(id: string): void {
  categories = categories.filter((entry) => entry.id !== id)
}

/**
 * Reset all categories to defaults.
 */
export function resetToDefaults(): Category[] {
  categories = initializeDefaults()
  return [...categories]
}

/**
 * Restore a specific default category that was removed.
 */
export function restoreDefault(id: string): CategoryResult {
  const defaultCat = DEFAULT_CATEGORIES.find((cat) => cat.id === id)
  if (!defaultCat) {
    return { category: null, error: 'Not a default category.' }
  }

  // Check if already exists
  if (categories.some((cat) => cat.id === id)) {
    return { category: null, error: 'Category already exists.' }
  }

  // Check for label collision
  const normalizedLabel = defaultCat.label.toLowerCase()
  if (categories.some((cat) => cat.label.toLowerCase() === normalizedLabel)) {
    return { category: null, error: 'A category with this name already exists.' }
  }

  const now = Date.now()
  const category: Category = {
    ...defaultCat,
    createdAt: now,
    updatedAt: now,
  }

  categories = [...categories, category]
  return { category, error: null }
}

/**
 * Get list of default categories that have been removed.
 */
export function getRemovedDefaults(): Category[] {
  const existingIds = new Set(categories.map((cat) => cat.id))
  const now = Date.now()

  return DEFAULT_CATEGORIES.filter((cat) => !existingIds.has(cat.id)).map((cat) => ({
    ...cat,
    createdAt: now,
    updatedAt: now,
  }))
}

/**
 * Export the uncategorized constant for use elsewhere.
 */
export { UNCATEGORIZED_CATEGORY }
