import { NextRequest, NextResponse } from 'next/server'
import { signJWT } from '@/lib/auth'
import { prisma } from '@/lib/db'

function loginRedirect(error: string) {
  return NextResponse.redirect(
    `${process.env.APP_URL}/login?error=${encodeURIComponent(error)}`
  )
}

/**
 * GET /api/auth/entra/callback
 * Microsoft redirects here after the user authenticates.
 * 1. Verifies the state cookie (CSRF protection)
 * 2. Exchanges the auth code for tokens
 * 3. Fetches the user's profile from Microsoft Graph
 * 4. Looks up the user in the DMS database by email
 * 5. Issues the same JWT session cookie the rest of the app uses
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return loginRedirect(searchParams.get('error_description') ?? error)
  }

  // CSRF check
  const storedState = request.cookies.get('oauth_state')?.value
  if (!state || state !== storedState) {
    return loginRedirect('Invalid state — please try again.')
  }

  if (!code) {
    return loginRedirect('No authorisation code received.')
  }

  // Exchange code → tokens
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
          redirect_uri:  `${process.env.APP_URL}/api/auth/entra/callback`,
          grant_type:    'authorization_code',
        }),
      }
    )
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      console.error('[entra] token exchange failed:', tokenData)
      const desc: string = tokenData.error_description ?? ''
      // AADSTS50020 / AADSTS700016 / AADSTS500011 = user from wrong tenant or personal account
      if (/AADSTS(50020|700016|500011|650057)/.test(desc) || desc.toLowerCase().includes('wrong tenant') || tokenData.error === 'invalid_grant') {
        return loginRedirect('Access denied: you must sign in with your SANPC Microsoft account (@sa-npc.co.za). Personal or external accounts are not permitted.')
      }
      return loginRedirect('Microsoft sign-in failed. Please try again or contact your IT administrator.')
    }
    accessToken = tokenData.access_token
  } catch (err) {
    console.error('[entra] token exchange error:', err)
    return loginRedirect('Could not reach Microsoft login servers.')
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
    if (!email) return loginRedirect('Could not retrieve your email from Microsoft.')
  } catch (err) {
    console.error('[entra] graph /me error:', err)
    return loginRedirect('Could not retrieve your Microsoft profile.')
  }

  // Look up or auto-provision user from Microsoft
  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    // First-time Microsoft login — create account with REVIEWER role
    // Admin can promote to any role via the Admin panel
    try {
      user = await prisma.user.create({
        data: {
          name,
          email,
          role: 'REVIEWER',
          password: '', // no password — Microsoft SSO only
        },
      })
      console.log('[entra] auto-provisioned new user:', email, 'id:', user.id)
    } catch (err) {
      console.error('[entra] failed to create user:', email, err)
      return loginRedirect('Your Microsoft account is not registered in the system. Please contact your administrator.')
    }
  } else {
    console.log('[entra] existing user logged in:', email, 'role:', user.role)
    // Keep name in sync with Microsoft profile
    if (user.name !== name) {
      await prisma.user.update({ where: { id: user.id }, data: { name } })
      console.log('[entra] updated name for:', email)
    }
  }

  // Issue the same session JWT the rest of the app uses
  const token = await signJWT({
    userId: user.id,
    email:  user.email,
    role:   user.role,
    name:   user.name,
  })

  const response = NextResponse.redirect(`${process.env.APP_URL}/dashboard`)
  response.cookies.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 8, // 8 hours
  })
  response.cookies.delete('oauth_state')
  return response
}
