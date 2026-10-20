import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

/**
 * GET /api/auth/entra/portal-login
 * Initiates Azure AD OAuth flow for the client portal.
 * Callback returns to /api/auth/entra/portal-callback → /portal
 */
export async function GET() {
  const state = randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    client_id:     process.env.AZURE_CLIENT_ID!,
    response_type: 'code',
    redirect_uri:  `${process.env.APP_URL}/api/auth/entra/portal-callback`,
    scope:         'openid profile email User.Read',
    state,
    response_mode: 'query',
    prompt:        'select_account',
  })

  const authUrl =
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/authorize?${params}`

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   600,
  })
  return res
}
