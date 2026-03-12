import { describe, it } from 'node:test';
import assert from 'node:assert';
import { groupBy } from '../../src/domain/utility/index.ts';

describe('[groupBy]', () => {
  it('should group an array of objects by the given key', () => {
    const arr = [{
      a: '123',
      b: '456'
    }, {
      a: '123',
      b: '789'
    }, {
      a: '456',
      b: '123'
    }];

    const actual = groupBy(arr, 'a');

    assert.strictEqual((actual['123'] as unknown[]).length, 2);
    assert.strictEqual((actual['456'] as unknown[]).length, 1);
  });

  it('should return an empty object if the array is empty', () => {
    const arr: Record<string, any>[] = [];
    const actual = groupBy(arr, 'a');

    assert.strictEqual(Object.keys(actual).length, 0);
  });

  it('should throw if the given key is not present in all objects', () => {
    const arr = [{
      a: '123',
      b: '456',
      c: '789'
    }, {
      a: '123',
      b: '789'
    }];

    assert.throws(() => groupBy(arr, 'c'));
  });
});
