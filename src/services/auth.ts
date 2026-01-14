import { clearEventCaches } from './cache'
export interface TokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
}
import { generateState } from '../utils/pkce'
import { log } from '../utils/logger'

/** Google OAuth client ID from environment */
export const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

/** OAuth scope for read-only calendar access */
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly'

/** OAuth scope for app-private Google Drive storage */
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'

/** Combined scopes for calendar + cloud sync */
export const ALL_SCOPES = `${CALENDAR_SCOPE} ${DRIVE_APPDATA_SCOPE}`

/** @deprecated Use CALENDAR_SCOPE instead */
export const SCOPES = CALENDAR_SCOPE

/**
 * Token storage keys.
 *
 * We use sessionStorage instead of localStorage for OAuth tokens because:
 * 1. **XSS mitigation**: sessionStorage is cleared when the tab closes, limiting
 *    the exposure window if an attacker injects malicious JavaScript.
 * 2. **Session isolation**: Each tab gets its own token, preventing cross-tab
 *    interference and making the security model simpler.
 * 3. **Automatic cleanup**: No stale tokens left behind after browser restart.
 *
 * Trade-off: Users must re-authenticate when opening a new tab. This is acceptable
 * for a calendar viewer where re-auth is quick (Google often has active session).
 */
const ACCESS_TOKEN_KEY = 'yearbird:accessToken'
const EXPIRES_AT_KEY = 'yearbird:expiresAt'
const GRANTED_SCOPES_KEY = 'yearbird:grantedScopes'

// Timing constants
const POPUP_DETECTION_TIMEOUT_MS = 1000
const VERIFIER_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

/**
 * PKCE verifier storage with request ID correlation.
 * Using a Map prevents race conditions when multiple auth flows are initiated.
 * Each entry has an expiry time to prevent memory leaks from abandoned flows.
 */
interface VerifierEntry {
  verifier: string
  state: string
  expiresAt: number
}
const pendingVerifiers = new Map<string, VerifierEntry>()

// Track the current pending auth flow's state (for correlating callback)
let currentAuthState: string | null = null

let tokenClient: google.accounts.oauth2.TokenClient | null = null
let successHandler: ((response: TokenResponse) => void) | null = null
let errorHandler: ((error: string) => void) | null = null
let signInPopup: Window | null = null
let hasPatchedOpen = false
let isAuthPopupPending = false
let pendingPopupResetTimeout: number | null = null

type SignInStatus = 'opened' | 'focused' | 'unavailable'

const isGoogleReady = () => typeof google !== 'undefined' && Boolean(google.accounts?.oauth2)
const POPUP_URL_HINT = 'accounts.google.com'

// Re-export PKCE functions for backward compatibility
export { generateCodeChallenge } from '../utils/pkce'

/**
 * Store a pending verifier with expiration.
 * @internal
 */
function storePendingVerifier(state: string, verifier: string): void {
  // Clean up expired entries
  const now = Date.now()
  for (const [key, entry] of pendingVerifiers.entries()) {
    if (now >= entry.expiresAt) {
      pendingVerifiers.delete(key)
    }
  }

  pendingVerifiers.set(state, {
    verifier,
    state,
    expiresAt: now + VERIFIER_EXPIRY_MS,
  })
}

/**
 * Retrieve and consume a pending verifier by state.
 * @internal
 */
function consumePendingVerifier(state: string): string | null {
  const entry = pendingVerifiers.get(state)
  if (!entry) {
    return null
  }

  pendingVerifiers.delete(state)

  // Check if expired
  if (Date.now() >= entry.expiresAt) {
    return null
  }

  return entry.verifier
}

// ============================================================================
// Popup Tracking
// ============================================================================

/**
 * Monkey-patches `window.open` to capture references to Google OAuth popups.
 *
 * ## Why This Exists
 *
 * Google Identity Services (GIS) creates OAuth consent popups internally via
 * `codeClient.requestCode()`. The GIS library does not expose any API
 * to obtain a reference to this popup window. Without that reference, we cannot:
 *
 * 1. **Detect if the popup is still open** - Users may click "Sign In" multiple
 *    times, and we need to focus the existing popup rather than spawn duplicates.
 * 2. **Focus an existing popup** - When the user clicks sign-in again while a
 *    popup is already open, we want to bring it to the front for better UX.
 * 3. **Track popup lifecycle** - Know when the popup closes (user completed or
 *    cancelled auth) to update UI state accordingly.
 *
 * @internal
 */
const ensureOpenPatched = () => {
  if (hasPatchedOpen || typeof window === 'undefined' || typeof window.open !== 'function') {
    return
  }

  // Set flag BEFORE patching to prevent race condition where concurrent calls
  // could both pass the check and double-patch window.open
  hasPatchedOpen = true

  const originalOpen = window.open
  window.open = (...args) => {
    const popup = originalOpen.apply(window, args as Parameters<typeof window.open>)
    const url = args[0]
    const urlString = typeof url === 'string' ? url : url?.toString()
    if (isAuthPopupPending || urlString?.includes(POPUP_URL_HINT)) {
      signInPopup = popup
      isAuthPopupPending = false
      if (pendingPopupResetTimeout !== null) {
        window.clearTimeout(pendingPopupResetTimeout)
        pendingPopupResetTimeout = null
      }
    }
    return popup
  }
}

/**
 * Safely checks if a popup window is closed, handling COOP restrictions.
 *
 * Google's OAuth popup sets `Cross-Origin-Opener-Policy: same-origin` which
 * prevents cross-origin access to window properties. When checking `.closed`
 * on such a popup, Chrome logs a warning and may return an unreliable value.
 *
 * This function wraps the check in a try-catch and falls back to assuming
 * the popup IS closed when access is blocked. This prioritizes keeping the
 * sign-in flow working (user can open a new popup) over preventing occasional
 * duplicate popups. A stuck UI is worse than a duplicate popup.
 *
 * @param popup - The popup window reference to check
 * @returns true if the popup is closed or its state is unknown, false if open
 */
const isPopupClosed = (popup: Window | null): boolean => {
  if (!popup) {
    return true
  }
  try {
    // This may trigger COOP warning in console, but we handle it gracefully
    return popup.closed
  } catch {
    // COOP policy blocked access. Assume popup is closed to avoid a stuck UI.
    //
    // Tradeoff analysis:
    // - If popup is actually closed and we return false (assume open):
    //   User cannot sign in again → stuck UI (bad)
    // - If popup is actually open and we return true (assume closed):
    //   User might get a duplicate popup → minor annoyance (acceptable)
    //
    // A stuck UI is the worse outcome, so we assume closed.
    return true
  }
}

const getOpenPopup = () => {
  if (!signInPopup) {
    return null
  }
  if (isPopupClosed(signInPopup)) {
    signInPopup = null
    return null
  }
  return signInPopup
}

export function hasOpenSignInPopup() {
  return Boolean(getOpenPopup())
}

export function clearSignInPopup() {
  signInPopup = null
  isAuthPopupPending = false
  currentAuthState = null
  if (pendingPopupResetTimeout !== null) {
    window.clearTimeout(pendingPopupResetTimeout)
    pendingPopupResetTimeout = null
  }
}

export function hasClientId() {
  return Boolean(CLIENT_ID)
}

// ============================================================================
// Auth Initialization
// ============================================================================

/**
 * Initialize the Google OAuth token client for implicit flow.
 *
 * @param onSuccess - Callback when token is received
 * @param onError - Callback when auth fails
 * @returns true if initialization succeeded
 */
export function initializeAuth(
  onSuccess: (response: TokenResponse) => void,
  onError?: (error: string) => void,
) {
  successHandler = onSuccess
  errorHandler = onError ?? null

  if (tokenClient) {
    return true
  }
  if (!CLIENT_ID) {
    log.warn('Missing VITE_GOOGLE_CLIENT_ID')
    return false
  }
  if (!isGoogleReady()) {
    return false
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: ALL_SCOPES,
    callback: (response: google.accounts.oauth2.TokenResponse) => {
      if (response.error) {
        log.error('Auth error:', response.error)
        currentAuthState = null
        errorHandler?.(response.error)
        return
      }

      // Validate state parameter for CSRF protection
      const returnedState = response.state
      if (returnedState && currentAuthState && returnedState !== currentAuthState) {
        log.error('Auth state mismatch - possible CSRF attack')
        currentAuthState = null
        errorHandler?.('state_mismatch')
        return
      }

      if (returnedState || currentAuthState) {
        consumePendingVerifier(returnedState ?? currentAuthState!)
      }

      currentAuthState = null
      successHandler?.({
        access_token: response.access_token,
        expires_in: response.expires_in,
        scope: response.scope,
        token_type: response.token_type,
      })
    },
    error_callback: (error: google.accounts.oauth2.TokenError) => {
      log.error('Auth error callback:', error)
      currentAuthState = null
      errorHandler?.(error.type)
    },
  })

  return true
}

// ============================================================================
// Sign In / Sign Out
// ============================================================================

/**
 * Initiate sign-in flow using implicit flow.
 */
export async function signIn(): Promise<SignInStatus> {
  if (!tokenClient && successHandler) {
    initializeAuth(successHandler, errorHandler ?? undefined)
  }
  if (!tokenClient) {
    log.warn('Google Identity Services not ready')
    return 'unavailable'
  }

  const existingPopup = getOpenPopup()
  if (existingPopup) {
    existingPopup.focus()
    return 'focused'
  }

  ensureOpenPatched()
  if (typeof window !== 'undefined') {
    isAuthPopupPending = true
    if (pendingPopupResetTimeout !== null) {
      window.clearTimeout(pendingPopupResetTimeout)
    }
    pendingPopupResetTimeout = window.setTimeout(() => {
      isAuthPopupPending = false
      pendingPopupResetTimeout = null
    }, POPUP_DETECTION_TIMEOUT_MS)
  }

  // Generate state for CSRF protection
  const state = generateState()

  // Store state for later retrieval
  storePendingVerifier(state, 'implicit_flow')
  currentAuthState = state

  // Request access token
  tokenClient.requestAccessToken({
    hint: '', // Allow account selection
    state, // CSRF protection
  })

  return 'opened'
}

export function signOut() {
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  if (token && typeof google !== 'undefined' && google.accounts?.oauth2) {
    google.accounts.oauth2.revoke(token, () => {
      log.info('Token revoked')
    })
  }
  clearStoredAuth()
}

// ============================================================================
// Token Storage
// ============================================================================

export function getStoredAuth(): { accessToken: string; expiresAt: number } | null {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  const expiresAtRaw = sessionStorage.getItem(EXPIRES_AT_KEY)

  if (!accessToken || !expiresAtRaw) {
    return null
  }

  const expiresAt = Number.parseInt(expiresAtRaw, 10)
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
    clearStoredAuth()
    return null
  }

  return { accessToken, expiresAt }
}

export function storeAuth(token: string, expiresIn: number, scopes?: string) {
  // Validate token data to prevent storing invalid/malicious tokens
  if (!token || typeof token !== 'string' || token.length < 10) {
    throw new Error('Invalid access token')
  }
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('Invalid token expiration')
  }

  const expiresAt = Date.now() + expiresIn * 1000
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
  sessionStorage.setItem(EXPIRES_AT_KEY, expiresAt.toString())
  if (scopes) {
    sessionStorage.setItem(GRANTED_SCOPES_KEY, scopes)
  }
  return expiresAt
}

export function clearStoredAuth() {
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(EXPIRES_AT_KEY)
    sessionStorage.removeItem(GRANTED_SCOPES_KEY)
  } catch (error) {
    log.debug('Storage access error clearing auth:', error)
  }

  clearEventCaches()
}

/**
 * Get the granted scopes from the last OAuth response.
 * Returns null if no scopes are stored.
 */
export function getGrantedScopes(): string | null {
  try {
    return sessionStorage.getItem(GRANTED_SCOPES_KEY)
  } catch (error) {
    log.debug('Storage access error reading scopes:', error)
    return null
  }
}

/**
 * Check if the user has granted the Drive appdata scope.
 */
export function hasDriveScope(): boolean {
  const scopes = getGrantedScopes()
  if (!scopes) {
    return false
  }
  return scopes.includes(DRIVE_APPDATA_SCOPE)
}

/**
 * Request additional Drive scope for cloud sync.
 * This will show a consent popup to the user.
 * Returns a promise that resolves to true if consent was granted.
 */
export async function requestDriveScope(): Promise<boolean> {
  if (!CLIENT_ID) {
    log.warn('Missing VITE_GOOGLE_CLIENT_ID')
    return false
  }

  if (!isGoogleReady()) {
    log.warn('Google Identity Services not ready')
    return false
  }

  return new Promise((resolve) => {
    const state = generateState()

    // Store state for this request
    storePendingVerifier(state, 'implicit_flow')

    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: ALL_SCOPES,
      callback: (response: google.accounts.oauth2.TokenResponse) => {
        if (response.error) {
          log.error('Drive scope request failed:', response.error)
          resolve(false)
          return
        }

        // Validate state
        if (response.state !== state) {
          log.error('Drive scope request state mismatch')
          resolve(false)
          return
        }

        consumePendingVerifier(state)

        try {
          // Store the new token with updated scopes
          storeAuth(response.access_token, response.expires_in, response.scope)

          // Notify the main auth handler if set
          if (successHandler) {
            successHandler({
              access_token: response.access_token,
              expires_in: response.expires_in,
              scope: response.scope,
              token_type: response.token_type,
            })
          }

          // Check if Drive scope was actually granted
          const granted = response.scope.includes(DRIVE_APPDATA_SCOPE)
          resolve(granted)
        } catch (error) {
          log.error('Token exchange failed during Drive scope request:', error)
          resolve(false)
        }
      },
      error_callback: (error: google.accounts.oauth2.TokenError) => {
        log.error('Drive scope request error:', error)
        resolve(false)
      },
    })

    // Request with consent prompt to ensure the user sees the new scope
    ensureOpenPatched()
    client.requestAccessToken({ prompt: 'consent', state })
  })
}

if (typeof window !== 'undefined') {
  ensureOpenPatched()
}
