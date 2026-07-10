import { prisma } from '@/lib/db'
import LoginForm from './LoginForm'

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams

  const users = await prisma.user.findMany({
    select: { email: true, name: true, role: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return <LoginForm demoUsers={users} entraError={error} />
}
