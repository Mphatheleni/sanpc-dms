import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'sanpc-dms-secret-key-change-in-production'
)

export interface ReviewTokenPayload {
  documentId: string
  reviewId: string
  reviewerId: string
  isApprover: boolean
}

export async function signReviewToken(payload: ReviewTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('14d')
    .sign(SECRET)
}

export async function verifyReviewToken(token: string): Promise<ReviewTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as ReviewTokenPayload
  } catch {
    return null
  }
}
