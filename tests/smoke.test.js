const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidCpf, isValidEmail } = require('../src/validation');
const { sanitizeProfileUpdate, validateProfileUpdate } = require('../src/server');

test('valida email e CPF no servidor', () => {
  assert.equal(isValidEmail('cliente@example.com'), true);
  assert.equal(isValidEmail('invalido'), false);
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('111.111.111-11'), false);
});

test('permite alterar apenas telefone e endereço no perfil', () => {
  const profile = sanitizeProfileUpdate({
    name: 'Nome',
    email: 'a@b.com',
    phone: '(11) 99999-8888',
    cpf: '111.111.111-11',
    birthDate: '2000-01-01',
    address: { cep: '01000-000', street: 'Rua A', number: '123' },
  });

  assert.deepEqual(profile, {
    phone: '(11) 99999-8888',
    address: { cep: '01000-000', street: 'Rua A', number: '123' },
  });
});

test('valida perfil com as mesmas regras de entrada do cadastro', () => {
  assert.equal(
    validateProfileUpdate({
      phone: '(11) 99999-8888',
      birthDate: '2000-01-01',
      address: { cep: '01000-000', state: 'sp' },
    }),
    null,
  );
  assert.match(
    validateProfileUpdate({
      phone: '123',
      birthDate: '2000-01-01',
      address: {},
    }),
    /Telefone invalido/,
  );
  assert.match(
    validateProfileUpdate({
      phone: '(11) 99999-8888',
      birthDate: '2000-01-01',
      address: { cep: '123' },
    }),
    /CEP invalido/,
  );
});
