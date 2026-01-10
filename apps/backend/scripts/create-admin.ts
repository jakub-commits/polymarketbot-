import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin', 12);

  const user = await prisma.user.upsert({
    where: { email: 'admin@admin.com' },
    update: { passwordHash },
    create: {
      email: 'admin@admin.com',
      passwordHash,
      name: 'Administrator',
      emailVerified: true,
      isActive: true,
    },
  });

  // Delete old admin if exists
  await prisma.user.deleteMany({ where: { email: 'admin' } });

  console.log('Admin account created:', user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
