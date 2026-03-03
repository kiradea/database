import bcrypt from 'bcrypt';
import { customers, invoices, revenue, users } from '../lib/placeholder-data';
import { prisma } from '../lib/prisma';

export async function GET() {
  try {
    await prisma.$transaction(async (tx) => {
      const usersData = await Promise.all(
        users.map(async (user) => ({
          ...user,
          password: await bcrypt.hash(user.password, 10),
        })),
      );

      await tx.user.createMany({
        data: usersData,
        skipDuplicates: true,
      });

      await tx.customer.createMany({
        data: customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          email: customer.email,
          imageUrl: customer.image_url,
        })),
        skipDuplicates: true,
      });

      await tx.invoice.createMany({
        data: invoices.map((invoice) => ({
          customerId: invoice.customer_id,
          amount: invoice.amount,
          status: invoice.status,
          date: new Date(invoice.date),
        })),
      });

      await tx.revenue.createMany({
        data: revenue,
        skipDuplicates: true,
      });
    });

    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
