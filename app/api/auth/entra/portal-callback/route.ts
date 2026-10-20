import { NextRequest, NextResponse } from 'next/server'
import { signJWT } from '@/lib/auth'
import { prisma } from '@/lib/db'

function portalError(error: string) {
  const appUrl = process.env.APP_URL || ''
  return NextResponse.redirect(
    `${appUrl}/portal/login?error=${encodeURIComponent(error)}`
  )
}

/**
 * GET /api/auth/entra/portal-callback
 * Handles Azure AD OAuth callback for the client portal.
 * New users are auto-provisioned with ORIGINATOR role (portal read access).
 * Existing users keep their existing role unchanged.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return portalError(searchParams.get('error_description') ?? error)
  }

  const storedState = request.cookies.get('oauth_state')?.value
  if (!state || state !== storedState) {
    return portalError('Invalid state — please try again.')
  }

  if (!code) {
    return portalError('No authorisation code received.')
  }

  // Exchange code for access token
  let accessToken: string
  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     process.env.AZURE_CLIENT_ID!,
          client_secret: process.env.AZURE_CLIENT_SECRET!,
          code,
          redirect_uri:  `${process.env.APP_URL}/api/auth/entra/portal-callback`,
          grant_type:    'authorization_code',
        }),
      }
    )
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      const desc: string = tokenData.error_description ?? ''
      if (/AADSTS(50020|700016|500011|650057)/.test(desc) || tokenData.error === 'invalid_grant') {
        return portalError('Access denied: please sign in with your SANPC Microsoft account.')
      }
      return portalError('Microsoft sign-in failed. Please try again.')
    }
    accessToken = tokenData.access_token
  } catch {
    return portalError('Could not reach Microsoft login servers.')
  }

  // Get user profile from Graph
  let email: string
  let name: string
  try {
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const me = await meRes.json()
    email = (me.mail || me.userPrincipalName || '').toLowerCase().trim()
    name  = me.displayName || email
    if (!email) return portalError('Could not retrieve your email from Microsoft.')
  } catch {
    return portalError('Could not retrieve your Microsoft profile.')
  }

  // Look up or auto-provision user
  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    // Portal first-time sign-in: provision as ORIGINATOR (document consumer/read access)
    user = await prisma.user.create({
      data: { name, email, role: 'ORIGINATOR', password: '' },
    })
  } else if (user.name !== name) {
    await prisma.user.update({ where: { id: user.id }, data: { name } })
  }

  const token = await signJWT({
    userId: user.id,
    email:  user.email,
    role:   user.role,
    name:   user.name,
  })

  const appUrl = process.env.APP_URL || ''
  const response = NextResponse.redirect(`${appUrl}/portal`)
  response.cookies.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 8,
  })
  response.cookies.delete('oauth_state')
  return response
}
