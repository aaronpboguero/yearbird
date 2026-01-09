import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCategories } from './useCategories'
import * as syncManager from '../services/syncManager'
import { resetToDefaults, setCategories } from '../services/categories'

vi.mock('../services/syncManager', () => ({
  scheduleSyncToCloud: vi.fn(),
}))

describe('useCategories', () => {
  beforeEach(() => {
    // Reset in-memory state before each test
    resetToDefaults()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with default categories', () => {
    const { result } = renderHook(() => useCategories())

    expect(result.current.categories).toHaveLength(5)
    expect(result.current.categories.map((c) => c.id)).toEqual([
      'birthdays',
      'family',
      'holidays',
      'races',
      'work',
    ])
  })

  it('includes uncategorized in allCategories', () => {
    const { result } = renderHook(() => useCategories())

    expect(result.current.allCategories).toHaveLength(6)
    expect(result.current.allCategories.at(-1)?.id).toBe('uncategorized')
  })

  it('adds a category and triggers sync', () => {
    const { result } = renderHook(() => useCategories())

    act(() => {
      result.current.addCategory({
        label: 'Test',
        color: '#112233',
        keywords: ['test'],
        matchMode: 'any',
      })
    })

    expect(result.current.categories).toHaveLength(6)
    expect(result.current.categories.at(-1)?.label).toBe('Test')
    expect(syncManager.scheduleSyncToCloud).toHaveBeenCalledTimes(1)
  })

  it('updates a category and triggers sync', () => {
    const { result } = renderHook(() => useCategories())

    act(() => {
      result.current.updateCategory('work', {
        label: 'My Work',
        color: '#FF0000',
        keywords: ['meeting'],
        matchMode: 'all',
      })
    })

    const updated = result.current.categories.find((c) => c.id === 'work')
    expect(updated?.label).toBe('My Work')
    expect(updated?.color).toBe('#FF0000')
    expect(syncManager.scheduleSyncToCloud).toHaveBeenCalledTimes(1)
  })

  it('removes a category and triggers sync', () => {
    const { result } = renderHook(() => useCategories())

    act(() => {
      result.current.removeCategory('work')
    })

    expect(result.current.categories.find((c) => c.id === 'work')).toBeUndefined()
    expect(syncManager.scheduleSyncToCloud).toHaveBeenCalledTimes(1)
  })

  it('tracks removed defaults', () => {
    const { result } = renderHook(() => useCategories())

    expect(result.current.removedDefaults).toHaveLength(0)

    act(() => {
      result.current.removeCategory('work')
      result.current.removeCategory('races')
    })

    expect(result.current.removedDefaults).toHaveLength(2)
    expect(result.current.removedDefaults.map((c) => c.id)).toContain('work')
    expect(result.current.removedDefaults.map((c) => c.id)).toContain('races')
  })

  it('restores a default and triggers sync', () => {
    const { result } = renderHook(() => useCategories())

    act(() => {
      result.current.removeCategory('work')
    })

    expect(result.current.removedDefaults).toHaveLength(1)

    act(() => {
      result.current.restoreDefault('work')
    })

    expect(result.current.categories.find((c) => c.id === 'work')).toBeDefined()
    expect(result.current.removedDefaults).toHaveLength(0)
    expect(syncManager.scheduleSyncToCloud).toHaveBeenCalledTimes(2) // remove + restore
  })

  it('resets to defaults and triggers sync', () => {
    const { result } = renderHook(() => useCategories())

    // Add custom and remove some defaults
    act(() => {
      result.current.addCategory({
        label: 'Custom',
        color: '#111111',
        keywords: ['custom'],
        matchMode: 'any',
      })
      result.current.removeCategory('work')
    })

    expect(result.current.categories).toHaveLength(5) // 4 defaults + 1 custom

    act(() => {
      result.current.resetToDefaults()
    })

    expect(result.current.categories).toHaveLength(5)
    expect(result.current.categories.map((c) => c.id)).toEqual([
      'birthdays',
      'family',
      'holidays',
      'races',
      'work',
    ])
    expect(result.current.categories.find((c) => c.label === 'Custom')).toBeUndefined()
  })

  it('does not trigger sync on validation errors', () => {
    const { result } = renderHook(() => useCategories())

    act(() => {
      result.current.addCategory({
        label: '',
        color: '#112233',
        keywords: ['test'],
        matchMode: 'any',
      })
    })

    expect(syncManager.scheduleSyncToCloud).not.toHaveBeenCalled()
  })

  it('updates when categories are set externally (e.g., cloud sync)', () => {
    const { result } = renderHook(() => useCategories())

    expect(result.current.categories).toHaveLength(5)

    // Simulate cloud sync updating categories
    const now = Date.now()
    act(() => {
      setCategories([
        {
          id: 'custom-from-cloud',
          label: 'From Cloud',
          color: '#AABBCC',
          keywords: ['cloud'],
          matchMode: 'any',
          createdAt: now,
          updatedAt: now,
          isDefault: false,
        },
      ])
    })

    // Hook should have received the update
    expect(result.current.categories).toHaveLength(1)
    expect(result.current.categories[0].label).toBe('From Cloud')
  })

  it('can edit categories after external update', () => {
    const { result } = renderHook(() => useCategories())

    // Simulate cloud sync updating categories with a default
    const now = Date.now()
    act(() => {
      setCategories([
        {
          id: 'birthdays',
          label: 'Birthdays',
          color: '#F59E0B',
          keywords: ['birthday'],
          matchMode: 'any',
          createdAt: now,
          updatedAt: now,
          isDefault: true,
        },
      ])
    })

    expect(result.current.categories).toHaveLength(1)

    // Now try to edit the category
    act(() => {
      result.current.updateCategory('birthdays', {
        label: 'My Birthdays',
        color: '#FF0000',
        keywords: ['bday'],
        matchMode: 'any',
      })
    })

    // Should have updated successfully
    expect(result.current.categories[0].label).toBe('My Birthdays')
    expect(result.current.categories[0].color).toBe('#FF0000')
    expect(syncManager.scheduleSyncToCloud).toHaveBeenCalled()
  })
})
