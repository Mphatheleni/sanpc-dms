import { prisma } from '@/lib/db'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  const users = await prisma.user.findMany({
    select: { email: true, name: true, role: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return <LoginForm demoUsers={users} />
}
