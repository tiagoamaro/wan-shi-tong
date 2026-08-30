const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Ajv2020 = require('ajv/dist/2020');

const root = path.join(__dirname, '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema/library.schema.json'), 'utf8'));
const validate = new Ajv2020({ allErrors: true }).compile(schema);

test('library.json conforms to the library schema', () => {
  const library = JSON.parse(fs.readFileSync(path.join(root, 'library.json'), 'utf8'));

  assert.equal(validate(library), true, JSON.stringify(validate.errors));
});

test('library schema rejects incomplete and unknown fields', () => {
  assert.equal(validate([{ kind: 'book' }]), false);
  assert.equal(validate([{ kind: 'book', title: 'Dune', unexpected: true }]), false);
});
