import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the logger module so we can spy on log.error across module resets
const mockLogError = vi.fn()
vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLogError,
    debug: vi.fn(),
  },
}))

type GoogleStub = {
  accounts: {
    oauth2: {
      initTokenClient: (options: {
        client_id: string
        scope: string
        callback: (response: {
          access_token: string
          expires_in: number
          scope: string
          token_type: string
          state?: string
          error?: string
        }) => void
        error_callback?: (error: { type: string }) => void
      }) => {
        requestAccessToken: (options?: { hint?: string; state?: string; prompt?: string }) => void
      }
      revoke: (token: string, done: () => void) => void
    }
  }
}

const globalWithGoogle = globalThis as typeof globalThis & { google?: GoogleStub }

const loadAuth = async () => {
  vi.resetModules()
  return await import('./auth')
}

describe('auth service', () => {
  beforeEach(() => {
    sessionStorage.clear()
    globalWithGoogle.google = undefined
    mockLogError.mockClear()
  })

  it('reports whether a client id is configured', async () => {
    const auth = await loadAuth()

    expect(auth.hasClientId()).toBe(Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID))
  })

  it('initializes token client when google is ready', async () => {
    const requestAccessToken = vi.fn()
    const initTokenClient = vi.fn(() => ({ requestAccessToken }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initTokenClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    const onSuccess = vi.fn()

    expect(auth.initializeAuth(onSuccess)).toBe(true)
    expect(initTokenClient).toHaveBeenCalled()
  })

  it('stores auth tokens', async () => {
    const auth = await loadAuth()
    const expiresAt = auth.storeAuth('test-token-123', 120)

    expect(auth.getStoredAuth()).toEqual({ accessToken: 'test-token-123', expiresAt })
  })

  it('stores granted scopes when provided', async () => {
    const auth = await loadAuth()
    const testScopes = 'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/drive.appdata'
    auth.storeAuth('test-token-123', 120, testScopes)

    expect(auth.getGrantedScopes()).toBe(testScopes)
    expect(sessionStorage.getItem('yearbird:grantedScopes')).toBe(testScopes)
  })

  it('does not store scopes when not provided', async () => {
    const auth = await loadAuth()
    auth.storeAuth('test-token-123', 120)

    expect(auth.getGrantedScopes()).toBeNull()
    expect(sessionStorage.getItem('yearbird:grantedScopes')).toBeNull()
  })

  it('hasDriveScope returns true when drive.appdata scope is granted', async () => {
    const auth = await loadAuth()
    const testScopes = 'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/drive.appdata'
    auth.storeAuth('test-token-123', 120, testScopes)

    expect(auth.hasDriveScope()).toBe(true)
  })

  it('hasDriveScope returns false when only calendar scope is granted', async () => {
    const auth = await loadAuth()
    const testScopes = 'https://www.googleapis.com/auth/calendar.events.readonly'
    auth.storeAuth('test-token-123', 120, testScopes)

    expect(auth.hasDriveScope()).toBe(false)
  })

  it('hasDriveScope returns false when no scopes are stored', async () => {
    const auth = await loadAuth()
    auth.storeAuth('test-token-123', 120)

    expect(auth.hasDriveScope()).toBe(false)
  })

  it('clears expired tokens', async () => {
    const auth = await loadAuth()
    const expiresAt = Date.now() - 1000

    sessionStorage.setItem('yearbird:accessToken', 'token')
    sessionStorage.setItem('yearbird:expiresAt', expiresAt.toString())

    expect(auth.getStoredAuth()).toBeNull()
    expect(sessionStorage.getItem('yearbird:accessToken')).toBeNull()
  })

  it('signs in using the token client', async () => {
    const requestAccessToken = vi.fn()
    const initTokenClient = vi.fn(() => ({ requestAccessToken }))
    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initTokenClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})
    await auth.signIn()

    expect(requestAccessToken).toHaveBeenCalled()
  })

  it('focuses an existing sign-in popup instead of opening a new one', async () => {
    const popup = { closed: false, focus: vi.fn() } as unknown as Window
    const originalOpen = window.open
    window.open = vi.fn(() => popup)
    const requestAccessToken = vi.fn(() => {
      window.open('https://accounts.google.com', 'yearbird-google-auth')
    })
    const initTokenClient = vi.fn(() => ({ requestAccessToken }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initTokenClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})

    await auth.signIn()
    window.open('https://accounts.google.com', 'yearbird-google-auth')
    expect(auth.hasOpenSignInPopup()).toBe(true)

    await auth.signIn()

    expect(popup.focus).toHaveBeenCalled()
    window.open = originalOpen
  })

  it('revokes token on sign out', async () => {
    const revoke = vi.fn((_token: string, done: () => void) => done())
    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn(() => ({ requestAccessToken: vi.fn() })),
          revoke,
        },
      },
    }

    const auth = await loadAuth()

    sessionStorage.setItem('yearbird:accessToken', 'token')
    sessionStorage.setItem('yearbird:expiresAt', String(Date.now() + 60_000))

    auth.signOut()

    expect(revoke).toHaveBeenCalled()
    expect(sessionStorage.getItem('yearbird:accessToken')).toBeNull()
  })

  it('clears stored auth explicitly including scopes', async () => {
    const auth = await loadAuth()

    sessionStorage.setItem('yearbird:accessToken', 'token')
    sessionStorage.setItem('yearbird:expiresAt', String(Date.now() + 60_000))
    sessionStorage.setItem('yearbird:grantedScopes', 'https://www.googleapis.com/auth/calendar.events.readonly')

    auth.clearStoredAuth()

    expect(sessionStorage.getItem('yearbird:accessToken')).toBeNull()
    expect(sessionStorage.getItem('yearbird:grantedScopes')).toBeNull()
  })

  it('signIn returns unavailable when not initialized', async () => {
    globalWithGoogle.google = undefined

    const auth = await loadAuth()
    const result = await auth.signIn()

    expect(result).toBe('unavailable')
  })

  it('getGrantedScopes handles sessionStorage errors gracefully', async () => {
    const auth = await loadAuth()

    const originalGetItem = sessionStorage.getItem
    sessionStorage.getItem = vi.fn(() => {
      throw new Error('Storage access denied')
    })

    const result = auth.getGrantedScopes()

    expect(result).toBeNull()
    sessionStorage.getItem = originalGetItem
  })

  it('clearSignInPopup clears state correctly', async () => {
    const popup = { closed: false, focus: vi.fn() } as unknown as Window
    const originalOpen = window.open
    window.open = vi.fn(() => popup)
    const requestAccessToken = vi.fn(() => {
      window.open('https://accounts.google.com', 'yearbird-google-auth')
    })
    const initTokenClient = vi.fn(() => ({ requestAccessToken }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initTokenClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})
    await auth.signIn()

    expect(auth.hasOpenSignInPopup()).toBe(true)

    auth.clearSignInPopup()

    expect(auth.hasOpenSignInPopup()).toBe(false)

    window.open = originalOpen
  })

  it('hasOpenSignInPopup returns false when popup has been closed', async () => {
    const popup = { closed: false, focus: vi.fn() } as unknown as Window & { closed: boolean }
    const originalOpen = window.open
    window.open = vi.fn(() => popup)
    const requestAccessToken = vi.fn(() => {
      window.open('https://accounts.google.com', 'yearbird-google-auth')
    })
    const initTokenClient = vi.fn(() => ({ requestAccessToken }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initTokenClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})
    await auth.signIn()

    expect(auth.hasOpenSignInPopup()).toBe(true)

    popup.closed = true

    expect(auth.hasOpenSignInPopup()).toBe(false)

    window.open = originalOpen
  })

  it('treats popup as closed when COOP blocks access to closed property', async () => {
    const popup = {
      get closed(): boolean {
        throw new DOMException('Blocked by COOP', 'SecurityError')
      },
      focus: vi.fn(),
    } as unknown as Window

    const originalOpen = window.open
    window.open = vi.fn(() => popup)
    const requestAccessToken = vi.fn(() => {
      window.open('https://accounts.google.com', 'yearbird-google-auth')
    })
    const initTokenClient = vi.fn(() => ({ requestAccessToken }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initTokenClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})
    await auth.signIn()

    expect(auth.hasOpenSignInPopup()).toBe(false)

    window.open = originalOpen
  })

  describe('Implicit flow state handling', () => {
    it('accepts auth when callback does not return state parameter', async () => {
      let capturedCallback: ((response: any) => void) | null = null
      const requestAccessToken = vi.fn()
      const initTokenClient = vi.fn(
        (options: { callback: (response: any) => void }) => {
          capturedCallback = options.callback
          return { requestAccessToken }
        }
      )

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initTokenClient,
            revoke: vi.fn(),
          },
        },
      }

      const auth = await loadAuth()
      const onSuccess = vi.fn()
      const onError = vi.fn()
      auth.initializeAuth(onSuccess, onError)

      await auth.signIn()

      expect(capturedCallback).not.toBeNull()
      capturedCallback!({
        access_token: 'test-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
        token_type: 'Bearer',
        state: undefined
      })

      expect(onSuccess).toHaveBeenCalledWith({
        access_token: 'test-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
        token_type: 'Bearer'
      })
      expect(onError).not.toHaveBeenCalled()
    })

    it('rejects auth when callback returns mismatched state', async () => {
      let capturedCallback: ((response: any) => void) | null = null
      const requestAccessToken = vi.fn()
      const initTokenClient = vi.fn(
        (options: { callback: (response: any) => void }) => {
          capturedCallback = options.callback
          return { requestAccessToken }
        }
      )

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initTokenClient,
            revoke: vi.fn(),
          },
        },
      }

      const auth = await loadAuth()
      const onSuccess = vi.fn()
      const onError = vi.fn()
      auth.initializeAuth(onSuccess, onError)

      await auth.signIn()

      expect(capturedCallback).not.toBeNull()
      capturedCallback!({
        access_token: 'test-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
        token_type: 'Bearer',
        state: 'attacker-controlled-state'
      })

      expect(onError).toHaveBeenCalledWith('state_mismatch')
      expect(onSuccess).not.toHaveBeenCalled()
      expect(mockLogError).toHaveBeenCalledWith('Auth state mismatch - possible CSRF attack')
    })
  })

  describe('requestDriveScope', () => {
    it('returns true when drive scope is granted successfully', async () => {
      let capturedCallback: ((response: any) => void) | null = null
      const requestAccessToken = vi.fn()
      const initTokenClient = vi.fn(
        (options: { callback: (response: any) => void }) => {
          capturedCallback = options.callback
          return { requestAccessToken }
        }
      )

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initTokenClient,
            revoke: vi.fn(),
          },
        },
      }

      const auth = await loadAuth()
      const driveScopePromise = auth.requestDriveScope()

      expect(capturedCallback).not.toBeNull()
      capturedCallback!({
        access_token: 'new-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/drive.appdata',
        token_type: 'Bearer',
        state: undefined // Simulating no state returned or matching state
      })

      const result = await driveScopePromise
      expect(result).toBe(true)
    })
  })
})
