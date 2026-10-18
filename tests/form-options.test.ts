import test from 'node:test';
import assert from 'node:assert/strict';
import { formOptions, optionValue } from '../lib/form-options.ts';
test('appointment choices are project scoped and unique by submitted resident ID', () => {
  const options = [
    {value:'owner', label:'Owner · 101', projectId:'nest'},
    {value:'owner', label:'Owner · 101', projectId:'skylark'},
    {value:'owner', label:'Owner · 102', projectId:'nest'},
    {value:'tenant', label:'Tenant · 103', projectId:'skylark'},
  ];
  assert.deepEqual(formOptions(options, 'nest'), [options[0]]);
  assert.deepEqual(formOptions(options, 'skylark'), [options[1], options[3]]);
  assert.deepEqual(formOptions(options, ''), []);
  assert.equal(optionValue(formOptions(options, 'unknown')[0]), '');
});
test('ordinary select choices keep their order without duplicates', () => {
  assert.deepEqual(formOptions(['president','vice_president','president']), ['president','vice_president']);
});
