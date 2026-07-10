import LoginForm from './LoginForm'

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams
  return <LoginForm entraError={error} />
}
