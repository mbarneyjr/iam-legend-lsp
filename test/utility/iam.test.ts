import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getServiceFromServiceAction, normalize } from '../../src/domain/utility/index.ts';

describe('[iam]', () => {
  describe('[getServiceFromServiceAction]', () => {
    it('should return service from serviceAction string', () => {
      const serviceAction = 'dynamodb:PutItem';
      const expected = 'dynamodb';
      const actual = getServiceFromServiceAction(serviceAction);

      assert.strictEqual(actual, expected);
    });

    it('should return full input string if no action', () => {
      const serviceAction = 'dynamodb';
      const expected = 'dynamodb';
      const actual = getServiceFromServiceAction(serviceAction);

      assert.strictEqual(actual, expected);
    });
  });

  describe('[normalize]', () => {
    it('should normalize service/action', () => {
      const input = '     "dynamodb:GetItem"';
      const expected = 'dynamodb:GetItem';

      const actual = normalize(input);
      assert.strictEqual(actual, expected);
    });
  });
});
