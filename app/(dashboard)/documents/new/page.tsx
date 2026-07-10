import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Card from '@/components/ui/Card'
import UploadForm from '@/components/documents/UploadForm'

export default async function NewDocumentPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'DOCUMENT_MANAGER' && session.role !== 'ADMIN') redirect('/documents')

  const users = await prisma.user.findMany({
    where: { role: { in: ['REVIEWER', 'APPROVER', 'ADMIN'] } },
    select: { id: true, name: true, email: true, role: true, departmentRole: true },
    orderBy: { name: 'asc' },
  })

  const usersForForm = users.map((u) => ({ ...u, role: u.role as string, departmentRole: u.departmentRole ?? undefined }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1C3557' }}>New Document</h1>
        <p className="text-sm text-gray-500 mt-1">Upload a document and configure its review workflow.</p>
      </div>
      <Card>
        <UploadForm users={usersForForm} />
      </Card>
    </div>
  )
}
