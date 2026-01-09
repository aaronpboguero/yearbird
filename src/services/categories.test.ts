import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addCategory,
  getCategories,
  getRemovedDefaults,
  removeCategory,
  resetToDefaults,
  restoreDefault,
  setCategories,
  subscribeToCategories,
  updateCategory,
} from './categories'

describe('categories service', () => {
  beforeEach(() => {
    // Reset in-memory state before each test
    resetToDefaults()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getCategories', () => {
    it('returns default categories on fresh install', () => {
      const categories = getCategories()
      expect(categories).toHaveLength(5)
      expect(categories.map((c) => c.id)).toEqual([
        'birthdays',
        'family',
        'holidays',
        'races',
        'work',
      ])
      expect(categories[0]).toMatchObject({
        id: 'birthdays',
        label: 'Birthdays',
        color: '#F59E0B',
        keywords: ['birthday', 'bday', 'b-day'],
        matchMode: 'any',
        isDefault: true,
      })
    })

  })

  describe('setCategories', () => {
    it('replaces all categories', () => {
      const now = Date.now()
      setCategories([
        {
          id: 'custom-1',
          label: 'Custom Category',
          color: '#112233',
          keywords: ['test'],
          matchMode: 'any',
          createdAt: now,
          updatedAt: now,
          isDefault: false,
        },
      ])

      const categories = getCategories()
      expect(categories).toHaveLength(1)
      expect(categories[0].label).toBe('Custom Category')
    })

    it('sanitizes and deduplicates categories by label', () => {
      const now = Date.now()
      setCategories([
        {
          id: 'test-1',
          label: 'Test',
          color: '#112233',
          keywords: ['test'],
          matchMode: 'any',
          createdAt: now,
          updatedAt: now,
          isDefault: false,
        },
        {
          id: 'test-2',
          label: 'test', // Same label, different case - should be deduplicated
          color: '#445566',
          keywords: ['other'],
          matchMode: 'any',
          createdAt: now,
          updatedAt: now + 1, // Newer, so this one wins
          isDefault: false,
        },
      ])

      const categories = getCategories()
      expect(categories).toHaveLength(1)
      expect(categories[0].id).toBe('test-2') // Newer one wins
    })

    it('notifies subscribers when categories change', () => {
      const listener = vi.fn()
      subscribeToCategories(listener)

      const now = Date.now()
      setCategories([
        {
          id: 'new-cat',
          label: 'New',
          color: '#112233',
          keywords: ['new'],
          matchMode: 'any',
          createdAt: now,
          updatedAt: now,
          isDefault: false,
        },
      ])

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'new-cat', label: 'New' }),
        ])
      )
    })
  })

  describe('subscribeToCategories', () => {
    it('returns unsubscribe function', () => {
      const listener = vi.fn()
      const unsubscribe = subscribeToCategories(listener)

      // Trigger a change
      const now = Date.now()
      setCategories([
        {
          id: 'cat-1',
          label: 'Cat',
          color: '#112233',
          keywords: ['cat'],
          matchMode: 'any',
          createdAt: now,
          updatedAt: now,
          isDefault: false,
        },
      ])

      expect(listener).toHaveBeenCalledTimes(1)

      // Unsubscribe
      unsubscribe()

      // Trigger another change
      setCategories([
        {
          id: 'cat-2',
          label: 'Cat2',
          color: '#445566',
          keywords: ['cat2'],
          matchMode: 'any',
          createdAt: now,
          updatedAt: now,
          isDefault: false,
        },
      ])

      // Listener should not have been called again
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('addCategory', () => {
    it('creates a new category with generated ID', () => {
      const result = addCategory({
        label: 'Test Category',
        color: '#112233',
        keywords: ['test', 'category'],
        matchMode: 'any',
      })

      expect(result.error).toBeNull()
      expect(result.category).toMatchObject({
        label: 'Test Category',
        color: '#112233',
        keywords: ['test', 'category'],
        matchMode: 'any',
        isDefault: false,
      })
      expect(result.category!.id).toMatch(/^custom-/)
    })

    it('trims and normalizes label', () => {
      const result = addCategory({
        label: '  Trimmed  ',
        color: '#112233',
        keywords: ['test'],
        matchMode: 'any',
      })

      expect(result.category?.label).toBe('Trimmed')
    })

    it('deduplicates keywords', () => {
      const result = addCategory({
        label: 'Test',
        color: '#112233',
        keywords: ['test', 'TEST', 'Test', 'unique'],
        matchMode: 'any',
      })

      expect(result.category?.keywords).toEqual(['test', 'unique'])
    })

    it('rejects empty label', () => {
      const result = addCategory({
        label: '   ',
        color: '#112233',
        keywords: ['test'],
        matchMode: 'any',
      })

      expect(result.error).toBe('Name is required.')
      expect(result.category).toBeNull()
    })

    it('rejects label over 32 characters', () => {
      const result = addCategory({
        label: 'A'.repeat(33),
        color: '#112233',
        keywords: ['test'],
        matchMode: 'any',
      })

      expect(result.error).toBe('Name must be 32 characters or fewer.')
    })

    it('rejects empty keywords', () => {
      const result = addCategory({
        label: 'Test',
        color: '#112233',
        keywords: [],
        matchMode: 'any',
      })

      expect(result.error).toBe('Add at least one keyword.')
    })

    it('rejects invalid color', () => {
      const result = addCategory({
        label: 'Test',
        color: 'red',
        keywords: ['test'],
        matchMode: 'any',
      })

      expect(result.error).toBe('Pick a valid color.')
    })

    it('rejects duplicate labels (case-insensitive)', () => {
      addCategory({
        label: 'Test',
        color: '#112233',
        keywords: ['test'],
        matchMode: 'any',
      })

      const result = addCategory({
        label: 'TEST',
        color: '#445566',
        keywords: ['other'],
        matchMode: 'any',
      })

      expect(result.error).toBe('A category with this name already exists.')
    })

    it('rejects "uncategorized" as a name', () => {
      const result = addCategory({
        label: 'Uncategorized',
        color: '#112233',
        keywords: ['test'],
        matchMode: 'any',
      })

      expect(result.error).toBe('This name is reserved.')
    })
  })

  describe('updateCategory', () => {
    it('updates an existing category', () => {
      const addResult = addCategory({
        label: 'Original',
        color: '#111111',
        keywords: ['original'],
        matchMode: 'any',
      })
      const id = addResult.category!.id

      vi.advanceTimersByTime(1000)

      const updateResult = updateCategory(id, {
        label: 'Updated',
        color: '#222222',
        keywords: ['updated'],
        matchMode: 'all',
      })

      expect(updateResult.error).toBeNull()
      expect(updateResult.category).toMatchObject({
        id,
        label: 'Updated',
        color: '#222222',
        keywords: ['updated'],
        matchMode: 'all',
      })
      expect(updateResult.category!.updatedAt).toBeGreaterThan(updateResult.category!.createdAt)
    })

    it('preserves createdAt on update', () => {
      const addResult = addCategory({
        label: 'Test',
        color: '#111111',
        keywords: ['test'],
        matchMode: 'any',
      })
      const createdAt = addResult.category!.createdAt

      vi.advanceTimersByTime(5000)

      const updateResult = updateCategory(addResult.category!.id, {
        label: 'Updated',
        color: '#222222',
        keywords: ['updated'],
        matchMode: 'any',
      })

      expect(updateResult.category!.createdAt).toBe(createdAt)
    })

    it('returns error for non-existent category', () => {
      const result = updateCategory('nonexistent', {
        label: 'Test',
        color: '#111111',
        keywords: ['test'],
        matchMode: 'any',
      })

      expect(result.error).toBe('Category not found.')
    })

    it('allows updating default categories', () => {
      // Verify default categories are loaded first
      getCategories()

      const result = updateCategory('work', {
        label: 'My Work',
        color: '#FF0000',
        keywords: ['meeting', 'standup'],
        matchMode: 'all',
      })

      expect(result.error).toBeNull()
      expect(result.category).toMatchObject({
        id: 'work',
        label: 'My Work',
        color: '#FF0000',
        isDefault: true,
      })
    })
  })

  describe('removeCategory', () => {
    it('removes a category', () => {
      const result = addCategory({
        label: 'ToRemove',
        color: '#111111',
        keywords: ['remove'],
        matchMode: 'any',
      })

      removeCategory(result.category!.id)

      const categories = getCategories()
      expect(categories.find((c) => c.id === result.category!.id)).toBeUndefined()
    })

    it('can remove default categories', () => {
      getCategories() // Initialize
      removeCategory('work')

      const categories = getCategories()
      expect(categories.find((c) => c.id === 'work')).toBeUndefined()
    })
  })

  describe('resetToDefaults', () => {
    it('restores all default categories', () => {
      // Add custom and remove some defaults
      addCategory({
        label: 'Custom',
        color: '#111111',
        keywords: ['custom'],
        matchMode: 'any',
      })
      removeCategory('work')
      removeCategory('races')

      const before = getCategories()
      expect(before.map((c) => c.id)).not.toContain('work')

      const after = resetToDefaults()
      expect(after).toHaveLength(5)
      expect(after.map((c) => c.id)).toEqual([
        'birthdays',
        'family',
        'holidays',
        'races',
        'work',
      ])
      // Custom category should be gone
      expect(after.find((c) => c.label === 'Custom')).toBeUndefined()
    })
  })

  describe('restoreDefault', () => {
    it('restores a single removed default', () => {
      getCategories()
      removeCategory('work')

      const result = restoreDefault('work')
      expect(result.error).toBeNull()
      expect(result.category).toMatchObject({
        id: 'work',
        label: 'Work',
        isDefault: true,
      })

      const categories = getCategories()
      expect(categories.find((c) => c.id === 'work')).toBeDefined()
    })

    it('returns error for non-default ID', () => {
      const result = restoreDefault('custom-123')
      expect(result.error).toBe('Not a default category.')
    })

    it('returns error if category already exists', () => {
      getCategories()
      const result = restoreDefault('work')
      expect(result.error).toBe('Category already exists.')
    })

    it('returns error if label conflicts with existing category', () => {
      getCategories()
      removeCategory('work')

      // Add a custom category with the same label
      addCategory({
        label: 'Work',
        color: '#111111',
        keywords: ['custom-work'],
        matchMode: 'any',
      })

      const result = restoreDefault('work')
      expect(result.error).toBe('A category with this name already exists.')
    })
  })

  describe('getRemovedDefaults', () => {
    it('returns empty array when all defaults present', () => {
      getCategories()
      const removed = getRemovedDefaults()
      expect(removed).toHaveLength(0)
    })

    it('returns removed defaults', () => {
      getCategories()
      removeCategory('work')
      removeCategory('races')

      const removed = getRemovedDefaults()
      expect(removed).toHaveLength(2)
      expect(removed.map((c) => c.id)).toContain('work')
      expect(removed.map((c) => c.id)).toContain('races')
    })
  })
})
