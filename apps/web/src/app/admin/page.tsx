import type { Metadata } from 'next'
import { AdministrationPanel } from '@/components/admin/administration-panel'

export const metadata: Metadata = { title: 'Administration · AI Advance Search' }

export default function AdminPage() {
  return <AdministrationPanel />
}