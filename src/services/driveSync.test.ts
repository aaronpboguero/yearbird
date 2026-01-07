import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock auth module before importing driveSync
vi.mock('./auth', () => ({
  getStoredAuth: vi.fn(() => ({
    accessToken: 'test-token',
    expiresAt: Date.now() + 3600000,
  })),
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Now import driveSync functions
import {
  findConfigFile,
  readCloudConfig,
  writeCloudConfig,
  deleteCloudConfig,
  checkDriveAccess,
} from './driveSync'
import type { CloudConfig } from '../types/cloudConfig'

describe('driveSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('findConfigFile', () => {
    it('returns file when found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      const result = await findConfigFile()

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('file-123')
    })

    it('returns null when no file exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      const result = await findConfigFile()

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })

    it('returns error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: { message: 'Access denied' } }),
      })

      const result = await findConfigFile()

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(403)
    })
  })

  describe('readCloudConfig', () => {
    it('returns null when no config file exists', async () => {
      // Mock findConfigFile returning no files
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })

    it('returns validated config when file exists', async () => {
      const validConfig: CloudConfig = {
        version: 1,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        disabledBuiltInCategories: [],
        customCategories: [],
      }

      // Mock findConfigFile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      // Mock file download
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(validConfig),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.version).toBe(1)
      expect(result.data?.deviceId).toBe('test-device')
    })

    it('returns error for invalid config structure', async () => {
      // Mock findConfigFile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      // Mock file download with invalid data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ invalid: 'data', version: 999 }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(400)
      expect(result.error?.message).toContain('Invalid')
    })
  })

  describe('writeCloudConfig', () => {
    const validConfig: CloudConfig = {
      version: 1,
      updatedAt: Date.now(),
      deviceId: 'test-device',
      filters: [],
      disabledCalendars: [],
      disabledBuiltInCategories: [],
      customCategories: [],
    }

    it('creates new file when none exists', async () => {
      // Mock findConfigFile - no existing file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      // Mock file creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'new-file-id', name: 'yearbird-config.json' }),
      })

      const result = await writeCloudConfig(validConfig)

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('new-file-id')

      // Verify POST was called for creation
      expect(mockFetch).toHaveBeenCalledTimes(2)
      const createCall = mockFetch.mock.calls[1]
      expect(createCall[0]).toContain('uploadType=multipart')
      expect(createCall[1].method).toBe('POST')
    })

    it('updates existing file', async () => {
      // Mock findConfigFile - existing file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'existing-file-id', name: 'yearbird-config.json' }],
        }),
      })

      // Mock file update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'existing-file-id', name: 'yearbird-config.json' }),
      })

      const result = await writeCloudConfig(validConfig)

      expect(result.success).toBe(true)

      // Verify PATCH was called for update
      expect(mockFetch).toHaveBeenCalledTimes(2)
      const updateCall = mockFetch.mock.calls[1]
      expect(updateCall[0]).toContain('existing-file-id')
      expect(updateCall[1].method).toBe('PATCH')
    })
  })

  describe('deleteCloudConfig', () => {
    it('deletes existing file', async () => {
      // Mock findConfigFile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-to-delete', name: 'yearbird-config.json' }],
        }),
      })

      // Mock delete
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      })

      const result = await deleteCloudConfig()

      expect(result.success).toBe(true)

      // Verify DELETE was called
      const deleteCall = mockFetch.mock.calls[1]
      expect(deleteCall[0]).toContain('file-to-delete')
      expect(deleteCall[1].method).toBe('DELETE')
    })

    it('succeeds when no file exists', async () => {
      // Mock findConfigFile - no file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      const result = await deleteCloudConfig()

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only findConfigFile called
    })
  })

  describe('checkDriveAccess', () => {
    it('returns true when API is accessible', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      const result = await checkDriveAccess()

      expect(result).toBe(true)
    })

    it('returns false on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: { message: 'Token expired' } }),
      })

      const result = await checkDriveAccess()

      expect(result).toBe(false)
    })

    it('returns false when offline', async () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

      const result = await checkDriveAccess()

      expect(result).toBe(false)

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })
  })

  describe('retry logic', () => {
    it('retries on 5xx errors', async () => {
      // First call fails with 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: { message: 'Server error' } }),
      })

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      const result = await findConfigFile()

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    }, 10000) // Increase timeout for retry delays

    it('does not retry on 4xx errors (except 429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: { message: 'Access denied' } }),
      })

      const result = await findConfigFile()

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(403)
      expect(mockFetch).toHaveBeenCalledTimes(1) // No retry
    })

    it('retries on 429 rate limit errors', async () => {
      // First call fails with 429
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () => Promise.resolve({ error: { message: 'Rate limit exceeded' } }),
      })

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      const result = await findConfigFile()

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    }, 10000)

    it('retries on network errors', async () => {
      // First call throws network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      const result = await findConfigFile()

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    }, 10000)

    it('fails after max retries', async () => {
      // All calls fail with 500
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: { message: 'Server error' } }),
      })

      const result = await findConfigFile()

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(500)
      // Should have retried 3 times (1 initial + 3 retries = 4 total calls)
      expect(mockFetch).toHaveBeenCalledTimes(4)
    }, 30000) // Increase timeout for multiple retries
  })

  describe('validation edge cases in readCloudConfig', () => {
    it('rejects config with wrong version', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 2, // Wrong version
          updatedAt: Date.now(),
          deviceId: 'test-device',
          filters: [],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(400)
    })

    it('rejects config with non-object data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve('invalid string data'),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(400)
    })

    it('rejects config with invalid updatedAt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: 'not-a-number',
          deviceId: 'test-device',
          filters: [],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(false)
    })

    it('rejects config with overly long deviceId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'a'.repeat(1001), // Too long
          filters: [],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(false)
    })

    it('rejects config with non-array filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: 'not-an-array',
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(false)
    })

    it('rejects config with too many filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: new Array(501).fill({ id: '1', pattern: 'test', createdAt: 1000 }),
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(false)
    })

    it('filters out invalid filter objects', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: [
            { id: '1', pattern: 'valid', createdAt: 1000 },
            { id: 123, pattern: 'invalid-id-type', createdAt: 1000 }, // Invalid: id is number
            null, // Invalid: null
            { pattern: 'missing-id', createdAt: 1000 }, // Invalid: missing id
            { id: '2', pattern: 'missing-createdAt' }, // Invalid: missing createdAt
          ],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.filters).toHaveLength(1)
      expect(result.data?.filters[0].pattern).toBe('valid')
    })

    it('filters out invalid disabledCalendars entries', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: [],
          disabledCalendars: ['valid-cal', 123, null, 'a'.repeat(1001)],
          disabledBuiltInCategories: [],
          customCategories: [],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.disabledCalendars).toHaveLength(1)
      expect(result.data?.disabledCalendars[0]).toBe('valid-cal')
    })

    it('filters out invalid disabledBuiltInCategories entries', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: [],
          disabledCalendars: [],
          disabledBuiltInCategories: ['work', 'invalid-category', 'birthdays'],
          customCategories: [],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.disabledBuiltInCategories).toHaveLength(2)
      expect(result.data?.disabledBuiltInCategories).toContain('work')
      expect(result.data?.disabledBuiltInCategories).toContain('birthdays')
    })

    it('filters out invalid customCategories entries', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: [],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [
            {
              id: 'custom-1',
              label: 'Valid',
              color: '#ff0000',
              keywords: ['test'],
              matchMode: 'any',
              createdAt: 1000,
              updatedAt: 1000,
            },
            null, // Invalid
            { id: 'custom-2' }, // Missing fields
            {
              id: 'custom-3',
              label: 'Invalid matchMode',
              color: '#ff0000',
              keywords: ['test'],
              matchMode: 'invalid',
              createdAt: 1000,
              updatedAt: 1000,
            },
          ],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.customCategories).toHaveLength(1)
      expect(result.data?.customCategories[0].label).toBe('Valid')
    })

    it('rejects customCategories with too long color', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: [],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [
            {
              id: 'custom-1',
              label: 'Long Color',
              color: 'a'.repeat(21), // Too long
              keywords: ['test'],
              matchMode: 'any',
              createdAt: 1000,
              updatedAt: 1000,
            },
          ],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.customCategories).toHaveLength(0)
    })

    it('rejects customCategories with too many keywords', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: [],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [
            {
              id: 'custom-1',
              label: 'Many Keywords',
              color: '#ff0000',
              keywords: new Array(501).fill('keyword'), // Too many
              matchMode: 'any',
              createdAt: 1000,
              updatedAt: 1000,
            },
          ],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.customCategories).toHaveLength(0)
    })

    it('rejects customCategories with non-string keyword', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: [],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [
            {
              id: 'custom-1',
              label: 'Non-string keyword',
              color: '#ff0000',
              keywords: ['valid', 123, null], // Non-string keywords
              matchMode: 'any',
              createdAt: 1000,
              updatedAt: 1000,
            },
          ],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.customCategories).toHaveLength(0)
    })

    it('accepts valid customCategories with matchMode all', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: [],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [
            {
              id: 'custom-1',
              label: 'Match All',
              color: '#ff0000',
              keywords: ['test'],
              matchMode: 'all',
              createdAt: 1000,
              updatedAt: 1000,
            },
          ],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.customCategories).toHaveLength(1)
      expect(result.data?.customCategories[0].matchMode).toBe('all')
    })
  })

  describe('writeCloudConfig edge cases', () => {
    it('returns error when not authenticated', async () => {
      const { getStoredAuth } = await import('./auth')
      vi.mocked(getStoredAuth).mockReturnValueOnce(null)

      const config: CloudConfig = {
        version: 1,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        disabledBuiltInCategories: [],
        customCategories: [],
      }

      const result = await writeCloudConfig(config)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(401)
    })

    it('handles create file failure', async () => {
      // findConfigFile returns no existing file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      // createConfigFile fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: { message: 'Create failed' } }),
      })

      const config: CloudConfig = {
        version: 1,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        disabledBuiltInCategories: [],
        customCategories: [],
      }

      const result = await writeCloudConfig(config)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(500)
    })

    it('handles update file failure', async () => {
      // findConfigFile returns existing file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'existing-file', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      // updateConfigFile fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: { message: 'Update failed' } }),
      })

      const config: CloudConfig = {
        version: 1,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        disabledBuiltInCategories: [],
        customCategories: [],
      }

      const result = await writeCloudConfig(config)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(403)
    })

    it('handles network error during create', async () => {
      // findConfigFile returns no existing file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      // createConfigFile throws network error
      mockFetch.mockRejectedValueOnce(new Error('Network failure'))

      const config: CloudConfig = {
        version: 1,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        disabledBuiltInCategories: [],
        customCategories: [],
      }

      const result = await writeCloudConfig(config)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(0)
      expect(result.error?.message).toBe('Network failure')
    })

    it('handles network error during update', async () => {
      // findConfigFile returns existing file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'existing-file', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      // updateConfigFile throws network error
      mockFetch.mockRejectedValueOnce(new Error('Update network failure'))

      const config: CloudConfig = {
        version: 1,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        disabledBuiltInCategories: [],
        customCategories: [],
      }

      const result = await writeCloudConfig(config)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(0)
      expect(result.error?.message).toBe('Update network failure')
    })
  })

  describe('deleteCloudConfig edge cases', () => {
    it('handles findConfigFile failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: { message: 'Token expired' } }),
      })

      const result = await deleteCloudConfig()

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(401)
    })

    it('handles delete API failure', async () => {
      // findConfigFile succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-to-delete', name: 'yearbird-config.json' }],
        }),
      })

      // delete fails with 403 (non-retryable error)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: { message: 'Delete failed' } }),
      })

      const result = await deleteCloudConfig()

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(403)
    })
  })

  describe('checkDriveAccess edge cases', () => {
    it('returns false when not authenticated', async () => {
      const { getStoredAuth } = await import('./auth')
      vi.mocked(getStoredAuth).mockReturnValueOnce(null)

      const result = await checkDriveAccess()

      expect(result).toBe(false)
    })
  })

  describe('driveRequest with 204 No Content', () => {
    it('handles 204 response correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json' }],
        }),
      })

      // Delete returns 204
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      })

      const result = await deleteCloudConfig()

      expect(result.success).toBe(true)
    })
  })

  describe('validation: non-finite updatedAt', () => {
    it('rejects config with Infinity updatedAt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Infinity,
          deviceId: 'test',
          filters: [],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(false)
    })
  })

  describe('validation: filter edge cases', () => {
    it('rejects filter with non-finite createdAt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: [
            { id: '1', pattern: 'valid', createdAt: 1000 },
            { id: '2', pattern: 'invalid', createdAt: NaN },
          ],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.filters).toHaveLength(1)
    })

    it('rejects filter with too long pattern', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: [
            { id: '1', pattern: 'a'.repeat(1001), createdAt: 1000 },
          ],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.filters).toHaveLength(0)
    })
  })

  describe('validation: customCategory edge cases', () => {
    it('rejects customCategory with non-finite createdAt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: [],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [
            {
              id: 'custom-1',
              label: 'Invalid',
              color: '#ff0000',
              keywords: ['test'],
              matchMode: 'any',
              createdAt: NaN,
              updatedAt: 1000,
            },
          ],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.customCategories).toHaveLength(0)
    })

    it('rejects customCategory with non-finite updatedAt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: [],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [
            {
              id: 'custom-1',
              label: 'Invalid',
              color: '#ff0000',
              keywords: ['test'],
              matchMode: 'any',
              createdAt: 1000,
              updatedAt: Infinity,
            },
          ],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.customCategories).toHaveLength(0)
    })

    it('rejects customCategory with too long keyword', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'test',
          filters: [],
          disabledCalendars: [],
          disabledBuiltInCategories: [],
          customCategories: [
            {
              id: 'custom-1',
              label: 'Long Keyword',
              color: '#ff0000',
              keywords: ['a'.repeat(1001)],
              matchMode: 'any',
              createdAt: 1000,
              updatedAt: 1000,
            },
          ],
        }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.customCategories).toHaveLength(0)
    })
  })
})
