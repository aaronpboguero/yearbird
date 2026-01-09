import { beforeEach, describe, expect, it } from 'vitest'
import {
  getShowTimedEvents,
  setShowTimedEvents,
  getMatchDescription,
  setMatchDescription,
} from './displaySettings'

describe('displaySettings (in-memory)', () => {
  // Reset to defaults before each test by setting to false
  beforeEach(() => {
    setShowTimedEvents(false)
    setMatchDescription(false)
  })

  describe('getShowTimedEvents', () => {
    it('returns false by default', () => {
      expect(getShowTimedEvents()).toBe(false)
    })

    it('returns true after being set to true', () => {
      setShowTimedEvents(true)
      expect(getShowTimedEvents()).toBe(true)
    })

    it('returns false after being set back to false', () => {
      setShowTimedEvents(true)
      expect(getShowTimedEvents()).toBe(true)
      setShowTimedEvents(false)
      expect(getShowTimedEvents()).toBe(false)
    })
  })

  describe('setShowTimedEvents', () => {
    it('updates the in-memory state', () => {
      expect(getShowTimedEvents()).toBe(false)
      setShowTimedEvents(true)
      expect(getShowTimedEvents()).toBe(true)
    })
  })

  describe('getMatchDescription', () => {
    it('returns false by default', () => {
      expect(getMatchDescription()).toBe(false)
    })

    it('returns true after being set to true', () => {
      setMatchDescription(true)
      expect(getMatchDescription()).toBe(true)
    })

    it('returns false after being set back to false', () => {
      setMatchDescription(true)
      expect(getMatchDescription()).toBe(true)
      setMatchDescription(false)
      expect(getMatchDescription()).toBe(false)
    })
  })

  describe('setMatchDescription', () => {
    it('updates the in-memory state', () => {
      expect(getMatchDescription()).toBe(false)
      setMatchDescription(true)
      expect(getMatchDescription()).toBe(true)
    })
  })
})
