const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidCpf, isValidEmail } = require('../src/validation');

test('valida email e CPF no servidor', () => {
  assert.equal(isValidEmail('cliente@example.com'), true);
  assert.equal(isValidEmail('invalido'), false);
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('111.111.111-11'), false);
});
