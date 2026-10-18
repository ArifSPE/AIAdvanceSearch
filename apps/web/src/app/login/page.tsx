import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth/auth-form'

export const metadata: Metadata = { title: 'Sign in · AI Advance Search' }

export default function LoginPage() {
  return <div className="flex justify-center py-8 sm:py-14"><AuthForm mode="login" /></div>
}