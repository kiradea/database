import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { customers, invoices, revenue, users } from '../app/lib/placeholder-data';

const prisma = new PrismaClient();

async function main() {
  const usersData = await Promise.all(
    users.map(async (user) => ({
      ...user,
      password: await bcrypt.hash(user.password, 10),
    })),
  );

  await prisma.user.createMany({
    data: usersData,
    skipDuplicates: true,
  });

  await prisma.customer.createMany({
    data: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      imageUrl: customer.image_url,
    })),
    skipDuplicates: true,
  });

  await prisma.invoice.createMany({
    data: invoices.map((invoice) => ({
      customerId: invoice.customer_id,
      amount: invoice.amount,
      status: invoice.status,
      date: new Date(invoice.date),
    })),
  });

  await prisma.revenue.createMany({
    data: revenue,
    skipDuplicates: true,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seeding error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
