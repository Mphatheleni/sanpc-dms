/**
 * Google Cloud Storage helpers using the GCS JSON REST API.
 * Authentication is automatic on Cloud Run / Firebase App Hosting
 * via the instance metadata server — no service account keys needed.
 *
 * Required env var: GOOGLE_CLOUD_BUCKET
 *   e.g. "sanpc-dms.appspot.com" (your Firebase Storage bucket)
 */

const BUCKET = process.env.GOOGLE_CLOUD_BUCKET

export function isGCSConfigured(): boolean {
  return !!BUCKET
}

async function getToken(): Promise<string> {
  const res = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' } }
  )
  if (!res.ok) throw new Error(`GCS metadata server error: ${res.status}`)
  const data = await res.json()
  return data.access_token
}

export async function uploadToGCS(
  objectName: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const token = await getToken()
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(BUCKET!)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: buffer as any,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GCS upload failed (${res.status}): ${text}`)
  }
  console.log(`[gcs] uploaded: ${objectName} → ${BUCKET}`)
}

export async function downloadFromGCS(
  objectName: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const token = await getToken()
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BUCKET!)}/o/${encodeURIComponent(objectName)}?alt=media`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`GCS download failed (${res.status})`)
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer, contentType }
}
