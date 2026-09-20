jest.mock('../prisma', () => ({ uSUARIOS: { create: jest.fn(), update: jest.fn() } }));
const prisma = require('../prisma');
const { criar, atualizar } = require('../controllers/usuariosController');
const { verifyPassword } = require('../utils/passwords');
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

test('cadastro grava Argon2id sem devolver senha', async () => {
  prisma.uSUARIOS.create.mockResolvedValue({ id: 1n, nome: 'Teste' });
  const res = response();
  await criar({ body: { nome: 'Teste', email: 'teste@example.com', username: 'teste', senha: 'Senha123!' } }, res);
  expect(res.status).toHaveBeenCalledWith(201);
  const args = prisma.uSUARIOS.create.mock.calls[0][0];
  expect(args.data.senha_hash).toMatch(/^\$argon2id\$/);
  expect(await verifyPassword('Senha123!', args.data.senha_hash)).toBe(true);
  expect(args.select.senha_hash).toBeUndefined();
});

test('troca de senha grava Argon2id', async () => {
  prisma.uSUARIOS.update.mockResolvedValue({ id: 1n });
  const res = response();
  await atualizar({ params: { id: '1' }, body: { senha: 'NovaSenha123!' } }, res);
  const args = prisma.uSUARIOS.update.mock.calls[0][0];
  expect(args.data.senha_hash).toMatch(/^\$argon2id\$/);
  expect(await verifyPassword('NovaSenha123!', args.data.senha_hash)).toBe(true);
});
