import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createServiceDocs, createActionDocs, createServicesActionDocs } from '../src/documentation.ts';
import type { IamAction } from '../src/domain/IamAction.ts';
import type { IamService } from '../src/domain/IamService.ts';

const makeAction = (overrides: Partial<IamAction> = {}): IamAction => ({
  name: 'GetItem',
  description: 'Returns a set of attributes for the item with the given primary key.',
  resourceTypes: [],
  conditionKeys: [],
  dependentActions: [],
  documentationUrl: 'https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html',
  ...overrides
});

const makeService = (overrides: Partial<IamService> = {}): IamService => ({
  serviceName: 'Amazon DynamoDB',
  servicePrefix: 'dynamodb',
  url: 'https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazondynamodb.html',
  actions: [makeAction()],
  ...overrides
});

describe('[documentation]', () => {
  describe('[createServiceDocs]', () => {
    it('should return markdown string with service name and link', () => {
      const result = createServiceDocs(makeService());
      assert.ok(result.includes('Amazon DynamoDB'));
      assert.ok(result.includes('[IAM Reference]'));
      assert.ok(result.includes('https://docs.aws.amazon.com'));
    });
  });

  describe('[createActionDocs]', () => {
    it('should include action name as bold link when documentationUrl present', () => {
      const result = createActionDocs(makeAction());
      assert.ok(result.includes('**[GetItem]'));
      assert.ok(result.includes(makeAction().documentationUrl));
    });

    it('should include action name as bold text when no documentationUrl', () => {
      const result = createActionDocs(makeAction({ documentationUrl: '' }));
      assert.ok(result.includes('**GetItem**'));
      assert.ok(!result.includes('[GetItem]'));
    });

    it('should include description', () => {
      const result = createActionDocs(makeAction());
      assert.ok(result.includes('Returns a set of attributes'));
    });

    it('should include resource types when present', () => {
      const result = createActionDocs(makeAction({ resourceTypes: ['table', 'index'] }));
      assert.ok(result.includes('Resource Types:'));
      assert.ok(result.includes('- table'));
      assert.ok(result.includes('- index'));
    });

    it('should include condition keys when present', () => {
      const result = createActionDocs(makeAction({ conditionKeys: ['dynamodb:LeadingKeys'] }));
      assert.ok(result.includes('Condition Keys:'));
      assert.ok(result.includes('- dynamodb:LeadingKeys'));
    });

    it('should include dependent actions when present', () => {
      const result = createActionDocs(makeAction({ dependentActions: ['kms:Decrypt'] }));
      assert.ok(result.includes('Dependent Actions:'));
      assert.ok(result.includes('- kms:Decrypt'));
    });
  });

  describe('[createServicesActionDocs]', () => {
    it('should return "No matching actions" for empty items', () => {
      const result = createServicesActionDocs([]);
      assert.strictEqual(result, 'No matching actions');
    });

    it('should return single service action docs for one match', () => {
      const service = makeService();
      const result = createServicesActionDocs([{ service, actions: [makeAction()] }]);
      assert.ok(result.includes('Amazon DynamoDB'));
      assert.ok(result.includes('GetItem'));
    });

    it('should include "Matches multiple actions" for multiple matches', () => {
      const service = makeService();
      const result = createServicesActionDocs([
        { service, actions: [makeAction(), makeAction({ name: 'PutItem' })] }
      ]);
      assert.ok(result.includes('Matches multiple actions'));
    });
  });
});
