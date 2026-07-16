import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
  if (m) process.env[m[1]] = m[2]
}

const GRAPH = 'https://graph.microsoft.com/v1.0'

async function run() {
  // 1. Get delegated token via ROPC
  console.log('1. Getting Graph token (ROPC / mail sender)...')
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'password',
        client_id:     process.env.AZURE_CLIENT_ID,
        client_secret: process.env.AZURE_CLIENT_SECRET,
        username:      process.env.MAIL_SENDER,
        password:      process.env.MAIL_PASSWORD,
        scope:         'https://graph.microsoft.com/Mail.Send',
      }),
    }
  )
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    console.error('Token FAILED:', JSON.stringify(tokenData, null, 2))
    process.exit(1)
  }
  console.log('   OK - token acquired')

  // 2. Send test email (to self)
  console.log(`2. Sending test email from ${process.env.MAIL_SENDER} to self...`)
  const sendRes = await fetch(`${GRAPH}/me/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject: '[SANPC DMS] Email connectivity test',
        body: {
          contentType: 'HTML',
          content: `<p style="font-family:Arial;color:#1C3557;"><strong>SANPC DMS</strong> — email test passed at ${new Date().toISOString()}</p>`,
        },
        toRecipients: [{ emailAddress: { address: process.env.MAIL_SENDER, name: 'SANPC DMS Test' } }],
        from: { emailAddress: { address: process.env.MAIL_SENDER, name: 'SANPC DMS' } },
      },
      saveToSentItems: false,
    }),
  })

  if (!sendRes.ok) {
    const txt = await sendRes.text().catch(() => '')
    console.error('Send FAILED:', sendRes.status, txt)
    process.exit(1)
  }

  console.log('   OK - email sent (check inbox of', process.env.MAIL_SENDER, ')')
  console.log('\nEmail sending: WORKING')
}

run().catch((err) => { console.error('Error:', err); process.exit(1) })
