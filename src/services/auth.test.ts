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

// Mock the token exchange service
const mockExchangeCodeForToken = vi.fn()
vi.mock('./tokenExchange', () => ({
  exchangeCodeForToken: mockExchangeCodeForToken,
}))

type GoogleStub = {
  accounts: {
    oauth2: {
      initCodeClient: (options: {
        client_id: string
        scope: string
        ux_mode: string
        redirect_uri: string
        callback: (response: { code: string; error?: string }) => void
        error_callback?: (error: { type: string }) => void
      }) => {
        requestCode: (options?: { hint?: string; state?: string; prompt?: string }) => void
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
    mockExchangeCodeForToken.mockReset()
  })

  it('reports whether a client id is configured', async () => {
    const auth = await loadAuth()

    expect(auth.hasClientId()).toBe(Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID))
  })

  it('initializes code client when google is ready', async () => {
    const requestCode = vi.fn()
    const initCodeClient = vi.fn(() => ({ requestCode }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initCodeClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    const onSuccess = vi.fn()

    expect(auth.initializeAuth(onSuccess)).toBe(true)
    expect(initCodeClient).toHaveBeenCalled()
  })

  it('stores auth tokens', async () => {
    const auth = await loadAuth()
    const expiresAt = auth.storeAuth('test-token-123', 120)

    expect(auth.getStoredAuth()).toEqual({ accessToken: 'test-token-123', expiresAt })
  })

  it('stores granted scopes when provided', async () => {
    const auth = await loadAuth()
    const testScopes = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.appdata'
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
    const testScopes = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.appdata'
    auth.storeAuth('test-token-123', 120, testScopes)

    expect(auth.hasDriveScope()).toBe(true)
  })

  it('hasDriveScope returns false when only calendar scope is granted', async () => {
    const auth = await loadAuth()
    const testScopes = 'https://www.googleapis.com/auth/calendar.readonly'
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

  it('signs in using the code client', async () => {
    const requestCode = vi.fn()
    const initCodeClient = vi.fn(() => ({ requestCode }))
    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initCodeClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})
    await auth.signIn()

    expect(requestCode).toHaveBeenCalled()
  })

  it('focuses an existing sign-in popup instead of opening a new one', async () => {
    const popup = { closed: false, focus: vi.fn() } as unknown as Window
    const originalOpen = window.open
    window.open = vi.fn(() => popup)
    const requestCode = vi.fn(() => {
      window.open('https://accounts.google.com', 'yearbird-google-auth')
    })
    const initCodeClient = vi.fn(() => ({ requestCode }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initCodeClient,
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
          initCodeClient: vi.fn(() => ({ requestCode: vi.fn() })),
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
    sessionStorage.setItem('yearbird:grantedScopes', 'https://www.googleapis.com/auth/calendar.readonly')

    auth.clearStoredAuth()

    expect(sessionStorage.getItem('yearbird:accessToken')).toBeNull()
    expect(sessionStorage.getItem('yearbird:grantedScopes')).toBeNull()
  })

  it('signIn returns unavailable when not initialized', async () => {
    // No google stub set, so codeClient will be null
    globalWithGoogle.google = undefined

    const auth = await loadAuth()
    const result = await auth.signIn()

    expect(result).toBe('unavailable')
  })

  it('getGrantedScopes handles sessionStorage errors gracefully', async () => {
    const auth = await loadAuth()

    // Mock sessionStorage.getItem to throw an error
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
    const requestCode = vi.fn(() => {
      window.open('https://accounts.google.com', 'yearbird-google-auth')
    })
    const initCodeClient = vi.fn(() => ({ requestCode }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initCodeClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})
    await auth.signIn()

    // Popup should now be tracked
    expect(auth.hasOpenSignInPopup()).toBe(true)

    // Clear the popup state
    auth.clearSignInPopup()

    // Should no longer track the popup
    expect(auth.hasOpenSignInPopup()).toBe(false)

    window.open = originalOpen
  })

  it('hasOpenSignInPopup returns false when popup has been closed', async () => {
    const popup = { closed: false, focus: vi.fn() } as unknown as Window & { closed: boolean }
    const originalOpen = window.open
    window.open = vi.fn(() => popup)
    const requestCode = vi.fn(() => {
      window.open('https://accounts.google.com', 'yearbird-google-auth')
    })
    const initCodeClient = vi.fn(() => ({ requestCode }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initCodeClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})
    await auth.signIn()

    // Popup should be tracked
    expect(auth.hasOpenSignInPopup()).toBe(true)

    // Simulate popup being closed
    popup.closed = true

    // Should now return false
    expect(auth.hasOpenSignInPopup()).toBe(false)

    window.open = originalOpen
  })

  it('treats popup as closed when COOP blocks access to closed property', async () => {
    // Simulate COOP (Cross-Origin-Opener-Policy) blocking access to popup.closed
    // This happens when Google's OAuth popup sets COOP: same-origin
    const popup = {
      get closed(): boolean {
        throw new DOMException('Blocked by COOP', 'SecurityError')
      },
      focus: vi.fn(),
    } as unknown as Window

    const originalOpen = window.open
    window.open = vi.fn(() => popup)
    const requestCode = vi.fn(() => {
      window.open('https://accounts.google.com', 'yearbird-google-auth')
    })
    const initCodeClient = vi.fn(() => ({ requestCode }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initCodeClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})
    await auth.signIn()

    // When COOP blocks access, hasOpenSignInPopup should return false
    // (assumes closed so user can retry sign-in rather than getting stuck)
    expect(auth.hasOpenSignInPopup()).toBe(false)

    window.open = originalOpen
  })

  it('window.open patch does not capture non-auth popups', async () => {
    const popup = { closed: false, focus: vi.fn() } as unknown as Window
    const originalOpen = window.open
    window.open = vi.fn(() => popup)
    const requestCode = vi.fn(() => {
      // First, open a non-Google popup (should not be captured)
      window.open('https://example.com', 'other-popup')
    })
    const initCodeClient = vi.fn(() => ({ requestCode }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initCodeClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})
    await auth.signIn()

    // Non-Google popup should not be captured as sign-in popup
    auth.clearSignInPopup()
    expect(auth.hasOpenSignInPopup()).toBe(false)

    window.open = originalOpen
  })

  /**
   * Regression tests for GIS popup flow state handling.
   *
   * Google Identity Services (GIS) popup flow with `postmessage` redirect does NOT
   * reliably return the state parameter in the callback response. This is a known
   * GIS behavior documented at:
   * https://github.com/mjaverto/yearbird/commit/f5425a4
   *
   * These tests ensure we:
   * 1. Accept valid auth when GIS doesn't return state (common case)
   * 2. Still reject auth when state IS returned but doesn't match (CSRF protection)
   */
  describe('GIS popup flow state handling', () => {
    it('accepts auth when GIS callback does not return state parameter', async () => {
      // This is the critical regression test for the bug fixed in commit f5425a4
      // GIS popup flow often returns undefined for response.state
      let capturedCallback: ((response: { code: string; state?: string; error?: string }) => void) | null = null
      const requestCode = vi.fn()
      const initCodeClient = vi.fn(
        (options: { callback: (response: { code: string; state?: string; error?: string }) => void }) => {
          capturedCallback = options.callback
          return { requestCode }
        }
      )

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initCodeClient,
            revoke: vi.fn(),
          },
        },
      }

      // Mock successful token exchange
      mockExchangeCodeForToken.mockResolvedValue({
        access_token: 'test-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
      })

      const auth = await loadAuth()
      const onSuccess = vi.fn()
      const onError = vi.fn()
      auth.initializeAuth(onSuccess, onError)

      // Trigger sign-in which sets currentAuthState internally
      await auth.signIn()

      // Simulate GIS callback WITHOUT state parameter (common GIS behavior)
      expect(capturedCallback).not.toBeNull()
      capturedCallback!({ code: 'auth-code-from-google', state: undefined })

      // Wait for async token exchange
      await vi.waitFor(() => {
        expect(onSuccess).toHaveBeenCalled()
      })

      // Should NOT trigger error - this was the bug
      expect(onError).not.toHaveBeenCalled()
      expect(mockLogError).not.toHaveBeenCalledWith('Auth state mismatch - possible CSRF attack')
    })

    it('rejects auth when GIS callback returns mismatched state', async () => {
      // When state IS returned, we should still validate it for CSRF protection
      let capturedCallback: ((response: { code: string; state?: string; error?: string }) => void) | null = null
      const requestCode = vi.fn()
      const initCodeClient = vi.fn(
        (options: { callback: (response: { code: string; state?: string; error?: string }) => void }) => {
          capturedCallback = options.callback
          return { requestCode }
        }
      )

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initCodeClient,
            revoke: vi.fn(),
          },
        },
      }

      const auth = await loadAuth()
      const onSuccess = vi.fn()
      const onError = vi.fn()
      auth.initializeAuth(onSuccess, onError)

      // Trigger sign-in which sets currentAuthState internally
      await auth.signIn()

      // Simulate GIS callback WITH wrong state (CSRF attack attempt)
      expect(capturedCallback).not.toBeNull()
      capturedCallback!({ code: 'auth-code', state: 'attacker-controlled-state' })

      // Should reject with state mismatch error
      expect(onError).toHaveBeenCalledWith('state_mismatch')
      expect(onSuccess).not.toHaveBeenCalled()
      expect(mockLogError).toHaveBeenCalledWith('Auth state mismatch - possible CSRF attack')
    })

    it('accepts auth when GIS callback returns matching state', async () => {
      // When state IS returned and matches, auth should succeed
      let capturedCallback: ((response: { code: string; state?: string; error?: string }) => void) | null = null
      const requestCode = vi.fn()
      const initCodeClient = vi.fn(
        (options: { callback: (response: { code: string; state?: string; error?: string }) => void }) => {
          capturedCallback = options.callback
          return { requestCode }
        }
      )

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initCodeClient,
            revoke: vi.fn(),
          },
        },
      }

      // Mock successful token exchange
      mockExchangeCodeForToken.mockResolvedValue({
        access_token: 'test-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
      })

      const auth = await loadAuth()
      const onSuccess = vi.fn()
      const onError = vi.fn()
      auth.initializeAuth(onSuccess, onError)

      // Trigger sign-in
      await auth.signIn()

      // Capture the state that was passed to requestCode
      const requestCodeCalls = requestCode.mock.calls
      const stateFromRequest = requestCodeCalls[requestCodeCalls.length - 1][0].state

      // Simulate GIS callback WITH matching state
      expect(capturedCallback).not.toBeNull()
      capturedCallback!({ code: 'auth-code', state: stateFromRequest })

      // Wait for async token exchange
      await vi.waitFor(() => {
        expect(onSuccess).toHaveBeenCalled()
      })

      expect(onError).not.toHaveBeenCalled()
    })
  })

  describe('requestDriveScope', () => {
    it('returns false when CLIENT_ID is missing', async () => {
      globalWithGoogle.google = undefined

      const auth = await loadAuth()
      const result = await auth.requestDriveScope()

      expect(result).toBe(false)
    })

    it('returns false when Google is not ready', async () => {
      globalWithGoogle.google = undefined

      const auth = await loadAuth()
      const result = await auth.requestDriveScope()

      expect(result).toBe(false)
    })

    it('returns true when drive scope is granted successfully', async () => {
      let capturedCallback: ((response: { code: string; state?: string; error?: string }) => void) | null = null
      const requestCode = vi.fn()
      const initCodeClient = vi.fn(
        (options: { callback: (response: { code: string; state?: string; error?: string }) => void }) => {
          capturedCallback = options.callback
          return { requestCode }
        }
      )

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initCodeClient,
            revoke: vi.fn(),
          },
        },
      }

      // Mock successful token exchange
      mockExchangeCodeForToken.mockResolvedValue({
        access_token: 'new-test-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.appdata',
      })

      const auth = await loadAuth()
      const resultPromise = auth.requestDriveScope()

      // Capture the state from the requestCode call
      const requestCodeCalls = requestCode.mock.calls
      const stateFromRequest = requestCodeCalls[requestCodeCalls.length - 1][0].state

      // Simulate successful code response with state
      expect(capturedCallback).not.toBeNull()
      capturedCallback!({ code: 'test-code', state: stateFromRequest })

      const result = await resultPromise
      expect(result).toBe(true)
    })

    it('returns false when response contains error', async () => {
      let capturedCallback: ((response: { code: string; error?: string }) => void) | null = null
      const requestCode = vi.fn()
      const initCodeClient = vi.fn(
        (options: { callback: (response: { code: string; error?: string }) => void }) => {
          capturedCallback = options.callback
          return { requestCode }
        }
      )

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initCodeClient,
            revoke: vi.fn(),
          },
        },
      }

      const auth = await loadAuth()
      const resultPromise = auth.requestDriveScope()

      // Simulate error response
      expect(capturedCallback).not.toBeNull()
      capturedCallback!({ code: '', error: 'access_denied' })

      const result = await resultPromise
      expect(result).toBe(false)
      expect(mockLogError).toHaveBeenCalledWith('Drive scope request failed:', 'access_denied')
    })

    it('returns false when error_callback is invoked', async () => {
      let capturedErrorCallback: ((error: { type: string }) => void) | null = null
      const requestCode = vi.fn()
      const initCodeClient = vi.fn(
        (options: {
          callback: (response: { code: string; error?: string }) => void
          error_callback: (error: { type: string }) => void
        }) => {
          capturedErrorCallback = options.error_callback
          return { requestCode }
        }
      )

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initCodeClient,
            revoke: vi.fn(),
          },
        },
      }

      const auth = await loadAuth()
      const resultPromise = auth.requestDriveScope()

      // Simulate error callback (e.g., popup closed)
      expect(capturedErrorCallback).not.toBeNull()
      capturedErrorCallback!({ type: 'popup_closed' })

      const result = await resultPromise
      expect(result).toBe(false)
      expect(mockLogError).toHaveBeenCalledWith('Drive scope request error:', { type: 'popup_closed' })
    })

    it('calls successHandler when set and scope granted', async () => {
      const requestCode = vi.fn()
      const initCodeClient = vi.fn(() => {
        return { requestCode }
      })

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initCodeClient,
            revoke: vi.fn(),
          },
        },
      }

      const mockResponse = {
        access_token: 'new-test-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.appdata',
      }
      mockExchangeCodeForToken.mockResolvedValue(mockResponse)

      const auth = await loadAuth()
      const successHandler = vi.fn()
      auth.initializeAuth(successHandler)

      const resultPromise = auth.requestDriveScope()

      // Capture the state from the requestCode call
      const requestCodeCalls = requestCode.mock.calls
      const stateFromRequest = requestCodeCalls[requestCodeCalls.length - 1][0].state

      // Find the callback from requestDriveScope (the second call to initCodeClient)
      const calls = initCodeClient.mock.calls
      const driveRequestCall = calls[calls.length - 1]
      const driveCallback = driveRequestCall[0].callback as (response: {
        code: string
        state?: string
        error?: string
      }) => void
      // Pass the state back to simulate a valid OAuth callback
      driveCallback({ code: 'test-code', state: stateFromRequest })

      const result = await resultPromise
      expect(result).toBe(true)
      expect(successHandler).toHaveBeenCalledWith(mockResponse)
    })

    it('returns false when drive scope is not in response', async () => {
      const requestCode = vi.fn()
      const initCodeClient = vi.fn(() => {
        return { requestCode }
      })

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initCodeClient,
            revoke: vi.fn(),
          },
        },
      }

      // Mock response where user only granted calendar scope (declined drive)
      mockExchangeCodeForToken.mockResolvedValue({
        access_token: 'new-test-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
      })

      const auth = await loadAuth()
      const resultPromise = auth.requestDriveScope()

      // Capture the state from the requestCode call
      const requestCodeCalls = requestCode.mock.calls
      const stateFromRequest = requestCodeCalls[requestCodeCalls.length - 1][0].state

      // Find the callback from requestDriveScope
      const calls = initCodeClient.mock.calls
      const driveRequestCall = calls[calls.length - 1]
      const driveCallback = driveRequestCall[0].callback as (response: {
        code: string
        state?: string
        error?: string
      }) => void

      // Pass the state back to simulate a valid OAuth callback
      driveCallback({ code: 'test-code', state: stateFromRequest })

      const result = await resultPromise
      expect(result).toBe(false)
    })
  })
})
