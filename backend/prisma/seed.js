const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('teste', 10);
  await prisma.uSUARIOS.upsert({
    where: { email: 'teste@teste.com' },
    update: {},
    create: {
      nome: 'Administrador Master',
      email: 'teste@teste.com',
      username: 'admin',
      senha_hash: hash,
      perfil: 'ADMIN',
      status: 'ATIVO',
    },
  });
  console.log('Seed concluído: usuário teste@teste.com criado com perfil ADMIN.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
