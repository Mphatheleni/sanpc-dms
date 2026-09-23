import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

const GRAPH = 'https://graph.microsoft.com/v1.0'

async function getToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    },
  )
  const data = await res.json()
  if (!data.access_token) throw new Error(JSON.stringify(data))
  return data.access_token
}

/**
 * GET /api/users/search?q=...
 * Searches Azure AD for organisation members matching the query.
 * Cross-references with the local DB to return existing role info.
 * Returns: { id, name, email, role, inDB }[]
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  try {
    const token = await getToken()

    const params = new URLSearchParams({
      '$search': `"displayName:${q}"`,
      '$select': 'displayName,mail,userPrincipalName,jobTitle',
      '$top': '15',
    })

    const res = await fetch(`${GRAPH}/users?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ConsistencyLevel: 'eventual',
      },
    })

    if (!res.ok) {
      console.error('[users/search] Graph error:', res.status, await res.text())
      return NextResponse.json([])
    }

    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adUsers: { name: string; email: string }[] = (data.value ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((u: any) => ({
        name: (u.displayName as string) ?? '',
        email: ((u.mail || u.userPrincipalName) as string ?? '').toLowerCase().trim(),
      }))
      .filter((u: { name: string; email: string }) => !!u.email && !!u.name)

    if (adUsers.length === 0) return NextResponse.json([])

    // Cross-reference with DB to get existing roles
    const emails = adUsers.map((u) => u.email)
    const dbUsers = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true, role: true },
    })
    const dbByEmail = new Map(dbUsers.map((u) => [u.email, u]))

    const results = adUsers.map((u) => {
      const db = dbByEmail.get(u.email)
      return {
        id: db?.id ?? '',
        name: u.name,
        email: u.email,
        role: db?.role ?? 'REVIEWER',
        inDB: !!db,
      }
    })

    return NextResponse.json(results)
  } catch (err) {
    console.error('[users/search] error:', err)
    return NextResponse.json([])
  }
}
