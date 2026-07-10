import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

/**
 * GET /api/auth/entra/login
 * Redirects the user to the Microsoft Entra ID (Azure AD) OAuth login page.
 * After authentication, Microsoft redirects back to /api/auth/entra/callback.
 */
export async function GET() {
  const state = randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    client_id:     process.env.AZURE_CLIENT_ID!,
    response_type: 'code',
    redirect_uri:  `${process.env.APP_URL}/api/auth/entra/callback`,
    scope:         'openid profile email User.Read',
    state,
    response_mode: 'query',
  })

  const authUrl =
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/authorize?${params}`

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   600, // 10 minutes
  })
  return res
}
