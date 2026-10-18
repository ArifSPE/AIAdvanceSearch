import { inArray } from 'drizzle-orm'
import type { Database } from './client'
import {
  borrowers,
  branches,
  collateral,
  customerContacts,
  loanPayments,
  loans,
  relationshipManagers,
} from './schema/lending'

const branchIds = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
] as const
const managerIds = [
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
] as const
const borrowerIds = [
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000005',
] as const
const loanIds = [
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004',
  '40000000-0000-4000-8000-000000000005',
  '40000000-0000-4000-8000-000000000006',
] as const

function dateDaysFromNow(offset: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

function timestampDaysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export async function seedLendingData(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(customerContacts).where(inArray(customerContacts.borrowerId, borrowerIds))
    await tx.delete(loanPayments).where(inArray(loanPayments.loanId, loanIds))
    await tx.delete(collateral).where(inArray(collateral.loanId, loanIds))
    await tx.delete(loans).where(inArray(loans.id, loanIds))
    await tx.delete(borrowers).where(inArray(borrowers.id, borrowerIds))
    await tx.delete(relationshipManagers).where(inArray(relationshipManagers.id, managerIds))
    await tx.delete(branches).where(inArray(branches.id, branchIds))

    await tx.insert(branches).values([
      {
        id: branchIds[0],
        code: 'NYC-01',
        name: 'New York Commercial Banking',
        region: 'Northeast',
        city: 'New York',
        state: 'NY',
      },
      {
        id: branchIds[1],
        code: 'CHI-01',
        name: 'Chicago Commercial Banking',
        region: 'Midwest',
        city: 'Chicago',
        state: 'IL',
      },
      {
        id: branchIds[2],
        code: 'DAL-01',
        name: 'Dallas Commercial Banking',
        region: 'South',
        city: 'Dallas',
        state: 'TX',
      },
    ])

    await tx.insert(relationshipManagers).values([
      {
        id: managerIds[0],
        firstName: 'Mia',
        lastName: 'Chen',
        email: 'mia.chen@example.test',
        branchId: branchIds[0],
      },
      {
        id: managerIds[1],
        firstName: 'Jordan',
        lastName: 'Rivera',
        email: 'jordan.rivera@example.test',
        branchId: branchIds[1],
      },
      {
        id: managerIds[2],
        firstName: 'Casey',
        lastName: 'Patel',
        email: 'casey.patel@example.test',
        branchId: branchIds[2],
      },
    ])

    await tx.insert(borrowers).values([
      {
        id: borrowerIds[0],
        externalId: 'SME-10001',
        legalName: 'Aster Industrial Fabrication',
        businessType: 'Corporation',
        industry: 'Manufacturing',
        annualRevenue: '12500000.00',
        riskRating: 'Watch',
        branchId: branchIds[0],
        relationshipManagerId: managerIds[0],
      },
      {
        id: borrowerIds[1],
        externalId: 'SME-10002',
        legalName: 'Brookside Medical Group',
        businessType: 'Limited liability company',
        industry: 'Healthcare',
        annualRevenue: '8400000.00',
        riskRating: 'Low',
        branchId: branchIds[0],
        relationshipManagerId: managerIds[0],
      },
      {
        id: borrowerIds[2],
        externalId: 'SME-20001',
        legalName: 'Cedar Ridge Logistics',
        businessType: 'Corporation',
        industry: 'Transportation',
        annualRevenue: '22000000.00',
        riskRating: 'Medium',
        branchId: branchIds[1],
        relationshipManagerId: managerIds[1],
      },
      {
        id: borrowerIds[3],
        externalId: 'SME-30001',
        legalName: 'Delta Solar Partners',
        businessType: 'Partnership',
        industry: 'Renewable energy',
        annualRevenue: '9700000.00',
        riskRating: 'Watch',
        branchId: branchIds[2],
        relationshipManagerId: managerIds[2],
      },
      {
        id: borrowerIds[4],
        externalId: 'SME-20002',
        legalName: 'Elm City Food Group',
        businessType: 'Corporation',
        industry: 'Food services',
        annualRevenue: '6100000.00',
        riskRating: 'Medium',
        branchId: branchIds[1],
        relationshipManagerId: managerIds[1],
      },
    ])

    await tx.insert(loans).values([
      {
        id: loanIds[0],
        borrowerId: borrowerIds[0],
        loanNumber: 'LN-1001',
        productType: 'Term loan',
        principalAmount: '1200000.00',
        outstandingBalance: '930000.00',
        interestRate: '7.25',
        status: 'active',
        originationDate: dateDaysFromNow(-420),
        maturityDate: dateDaysFromNow(675),
        nextPaymentDate: dateDaysFromNow(15),
      },
      {
        id: loanIds[1],
        borrowerId: borrowerIds[0],
        loanNumber: 'LN-1002',
        productType: 'Equipment finance',
        principalAmount: '700000.00',
        outstandingBalance: '640000.00',
        interestRate: '6.80',
        status: 'active',
        originationDate: dateDaysFromNow(-240),
        maturityDate: dateDaysFromNow(850),
        nextPaymentDate: dateDaysFromNow(20),
      },
      {
        id: loanIds[2],
        borrowerId: borrowerIds[1],
        loanNumber: 'LN-2001',
        productType: 'Commercial real estate',
        principalAmount: '1800000.00',
        outstandingBalance: '1100000.00',
        interestRate: '6.10',
        status: 'active',
        originationDate: dateDaysFromNow(-730),
        maturityDate: dateDaysFromNow(1095),
        nextPaymentDate: dateDaysFromNow(12),
      },
      {
        id: loanIds[3],
        borrowerId: borrowerIds[2],
        loanNumber: 'LN-3001',
        productType: 'Working capital',
        principalAmount: '2500000.00',
        outstandingBalance: '2000000.00',
        interestRate: '7.00',
        status: 'active',
        originationDate: dateDaysFromNow(-500),
        maturityDate: dateDaysFromNow(595),
        nextPaymentDate: dateDaysFromNow(18),
      },
      {
        id: loanIds[4],
        borrowerId: borrowerIds[3],
        loanNumber: 'LN-4001',
        productType: 'Equipment finance',
        principalAmount: '1000000.00',
        outstandingBalance: '850000.00',
        interestRate: '7.45',
        status: 'active',
        originationDate: dateDaysFromNow(-390),
        maturityDate: dateDaysFromNow(705),
        nextPaymentDate: dateDaysFromNow(10),
      },
      {
        id: loanIds[5],
        borrowerId: borrowerIds[4],
        loanNumber: 'LN-5001',
        productType: 'Small business term loan',
        principalAmount: '600000.00',
        outstandingBalance: '580000.00',
        interestRate: '8.10',
        status: 'active',
        originationDate: dateDaysFromNow(-180),
        maturityDate: dateDaysFromNow(915),
        nextPaymentDate: dateDaysFromNow(22),
      },
    ])

    await tx.insert(loanPayments).values([
      ...[75, 45, 15].map((days, index) => ({
        id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        loanId: loanIds[0],
        paymentReference: `PMT-1001-${index + 1}`,
        dueDate: dateDaysFromNow(-days),
        amountDue: '12500.00',
        amountPaid: null,
        status: 'missed' as const,
      })),
      {
        id: '50000000-0000-4000-8000-000000000004',
        loanId: loanIds[1],
        paymentReference: 'PMT-1002-1',
        dueDate: dateDaysFromNow(-20),
        amountDue: '9000.00',
        amountPaid: null,
        status: 'missed',
      },
      ...[60, 30].map((days, index) => ({
        id: `50000000-0000-4000-8000-${String(index + 5).padStart(12, '0')}`,
        loanId: loanIds[2],
        paymentReference: `PMT-2001-${index + 1}`,
        dueDate: dateDaysFromNow(-days),
        paidDate: dateDaysFromNow(-days + 2),
        amountDue: '15000.00',
        amountPaid: '15000.00',
        status: 'paid' as const,
      })),
      ...[70, 40].map((days, index) => ({
        id: `50000000-0000-4000-8000-${String(index + 7).padStart(12, '0')}`,
        loanId: loanIds[3],
        paymentReference: `PMT-3001-${index + 1}`,
        dueDate: dateDaysFromNow(-days),
        amountDue: '18000.00',
        amountPaid: null,
        status: 'missed' as const,
      })),
      ...[80, 50, 20].map((days, index) => ({
        id: `50000000-0000-4000-8000-${String(index + 9).padStart(12, '0')}`,
        loanId: loanIds[4],
        paymentReference: `PMT-4001-${index + 1}`,
        dueDate: dateDaysFromNow(-days),
        amountDue: '11000.00',
        amountPaid: null,
        status: 'missed' as const,
      })),
      {
        id: '50000000-0000-4000-8000-000000000012',
        loanId: loanIds[5],
        paymentReference: 'PMT-5001-1',
        dueDate: dateDaysFromNow(-40),
        amountDue: '8000.00',
        amountPaid: null,
        status: 'missed',
      },
    ])

    await tx.insert(collateral).values([
      {
        id: '60000000-0000-4000-8000-000000000001',
        loanId: loanIds[0],
        referenceCode: 'COL-1001-A',
        collateralType: 'Equipment',
        description: 'Manufacturing equipment',
        appraisedValue: '700000.00',
        valuationDate: dateDaysFromNow(-45),
      },
      {
        id: '60000000-0000-4000-8000-000000000002',
        loanId: loanIds[0],
        referenceCode: 'COL-1001-B',
        collateralType: 'Commercial property',
        description: 'Industrial workshop',
        appraisedValue: '100000.00',
        valuationDate: dateDaysFromNow(-45),
      },
      {
        id: '60000000-0000-4000-8000-000000000003',
        loanId: loanIds[1],
        referenceCode: 'COL-1002-A',
        collateralType: 'Equipment',
        description: 'CNC production line',
        appraisedValue: '700000.00',
        valuationDate: dateDaysFromNow(-30),
      },
      {
        id: '60000000-0000-4000-8000-000000000004',
        loanId: loanIds[2],
        referenceCode: 'COL-2001-A',
        collateralType: 'Commercial property',
        description: 'Medical office building',
        appraisedValue: '1600000.00',
        valuationDate: dateDaysFromNow(-20),
      },
      {
        id: '60000000-0000-4000-8000-000000000005',
        loanId: loanIds[3],
        referenceCode: 'COL-3001-A',
        collateralType: 'Fleet vehicles',
        description: 'Regional logistics fleet',
        appraisedValue: '3200000.00',
        valuationDate: dateDaysFromNow(-60),
      },
      {
        id: '60000000-0000-4000-8000-000000000006',
        loanId: loanIds[4],
        referenceCode: 'COL-4001-A',
        collateralType: 'Solar equipment',
        description: 'Commercial solar installation assets',
        appraisedValue: '800000.00',
        valuationDate: dateDaysFromNow(-35),
      },
      {
        id: '60000000-0000-4000-8000-000000000007',
        loanId: loanIds[5],
        referenceCode: 'COL-5001-A',
        collateralType: 'Business equipment',
        description: 'Food production equipment',
        appraisedValue: '500000.00',
        valuationDate: dateDaysFromNow(-25),
      },
    ])

    await tx.insert(customerContacts).values([
      {
        id: '70000000-0000-4000-8000-000000000001',
        borrowerId: borrowerIds[0],
        relationshipManagerId: managerIds[0],
        contactReference: 'CONTACT-10001',
        channel: 'phone',
        contactedAt: timestampDaysAgo(45),
        outcome: 'Follow-up scheduled',
        notes: 'Discussed production expansion and upcoming repayments.',
      },
      {
        id: '70000000-0000-4000-8000-000000000002',
        borrowerId: borrowerIds[1],
        relationshipManagerId: managerIds[0],
        contactReference: 'CONTACT-10002',
        channel: 'email',
        contactedAt: timestampDaysAgo(10),
        outcome: 'Documents received',
        notes: 'Received quarterly financial statements.',
      },
      {
        id: '70000000-0000-4000-8000-000000000003',
        borrowerId: borrowerIds[2],
        relationshipManagerId: managerIds[1],
        contactReference: 'CONTACT-20001',
        channel: 'branch meeting',
        contactedAt: timestampDaysAgo(45),
        outcome: 'Review completed',
        notes: 'Reviewed seasonal cash flow and fleet collateral.',
      },
      {
        id: '70000000-0000-4000-8000-000000000004',
        borrowerId: borrowerIds[3],
        relationshipManagerId: managerIds[2],
        contactReference: 'CONTACT-30001',
        channel: 'phone',
        contactedAt: timestampDaysAgo(45),
        outcome: 'No answer',
        notes: 'Left a callback request.',
      },
    ])
  })
}