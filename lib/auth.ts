import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { prisma } from './db'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'sanpc-dms-secret-key-change-in-production'
)

export interface SessionPayload {
  userId: string
  email: string
  role: string
  name: string
}

export async function signJWT(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(SECRET)
}

export async function verifyJWT(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

// Call from Server Components or API routes (reads from cookie store).
// Always re-fetches role/name from DB so admin role changes take effect immediately.
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null
  const payload = await verifyJWT(token)
  if (!payload) return null

  // Refresh role and name from DB — JWT may be stale if admin changed the role
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true, name: true, email: true },
  })
  if (!user) return null // user was deleted — treat as logged out

  return { userId: payload.userId, email: user.email, role: user.role, name: user.name }
}

// Call from middleware or API routes where you have the request object
export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return verifyJWT(token)
}
