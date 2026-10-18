import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth/auth-form'

export const metadata: Metadata = { title: 'Create account · AI Advance Search' }

export default function RegisterPage() {
  return <div className="flex justify-center py-8 sm:py-14"><AuthForm mode="register" /></div>
}