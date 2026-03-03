import { Prisma } from '@prisma/client';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  Revenue,
} from './definitions';
import { prisma } from './prisma';
import { formatCurrency } from './utils';

function toDateString(value: Date | string): string {
  return value instanceof Date ? value.toISOString().split('T')[0] : value;
}

export async function fetchRevenue() {
  try {
    const data = await prisma.revenue.findMany();
    const monthOrder = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const sortedData: Revenue[] = data.sort(
      (a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month),
    );

    return sortedData;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    const data = await prisma.invoice.findMany({
      select: {
        id: true,
        amount: true,
        customer: {
          select: {
            name: true,
            imageUrl: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
      take: 5,
    });

    const latestInvoices = data.map((invoice) => ({
      id: invoice.id,
      name: invoice.customer.name,
      image_url: invoice.customer.imageUrl,
      email: invoice.customer.email,
      amount: formatCurrency(invoice.amount),
    }));

    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  try {
    const [numberOfInvoices, numberOfCustomers, statusGrouped] =
      await prisma.$transaction([
        prisma.invoice.count(),
        prisma.customer.count(),
        prisma.invoice.groupBy({
          by: ['status'],
          _sum: {
            amount: true,
          },
        }),
      ]);

    const paid = statusGrouped.find((row) => row.status === 'paid')?._sum.amount ?? 0;
    const pending =
      statusGrouped.find((row) => row.status === 'pending')?._sum.amount ?? 0;

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices: formatCurrency(paid),
      totalPendingInvoices: formatCurrency(pending),
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const likeQuery = `%${query}%`;
    const invoices = await prisma.$queryRaw<InvoicesTable[]>(Prisma.sql`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        invoices.customer_id,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${likeQuery} OR
        customers.email ILIKE ${likeQuery} OR
        invoices.amount::text ILIKE ${likeQuery} OR
        invoices.date::text ILIKE ${likeQuery} OR
        invoices.status ILIKE ${likeQuery}
      ORDER BY invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `);

    return invoices.map((invoice) => ({
      ...invoice,
      date: toDateString(invoice.date),
    }));
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const likeQuery = `%${query}%`;
    const data = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${likeQuery} OR
        customers.email ILIKE ${likeQuery} OR
        invoices.amount::text ILIKE ${likeQuery} OR
        invoices.date::text ILIKE ${likeQuery} OR
        invoices.status ILIKE ${likeQuery}
    `);

    const totalPages = Math.ceil((data[0]?.count ?? 0) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        amount: true,
        status: true,
      },
    });

    if (!invoice) {
      return undefined;
    }

    const formattedInvoice: InvoiceForm = {
      id: invoice.id,
      customer_id: invoice.customerId,
      amount: invoice.amount / 100,
      status: invoice.status as InvoiceForm['status'],
    };

    return formattedInvoice;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return customers as CustomerField[];
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const likeQuery = `%${query}%`;
    const data = await prisma.$queryRaw<CustomersTableType[]>(Prisma.sql`
      SELECT
        customers.id,
        customers.name,
        customers.email,
        customers.image_url,
        COUNT(invoices.id)::int AS total_invoices,
        COALESCE(SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END), 0)::int AS total_pending,
        COALESCE(SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END), 0)::int AS total_paid
      FROM customers
      LEFT JOIN invoices ON customers.id = invoices.customer_id
      WHERE
        customers.name ILIKE ${likeQuery} OR
        customers.email ILIKE ${likeQuery}
      GROUP BY customers.id, customers.name, customers.email, customers.image_url
      ORDER BY customers.name ASC
    `);

    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}
