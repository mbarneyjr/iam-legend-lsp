import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TextDocuments } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { handleCompletion } from '../src/completionHandler.ts';
import type { IamServicesByPrefix } from '../src/domain/index.ts';

const makeServicesByPrefix = (): IamServicesByPrefix => ({
  s3: [{
    serviceName: 'Amazon S3',
    servicePrefix: 's3',
    url: 'https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazons3.html',
    actions: [
      {
        name: 'GetObject',
        description: 'Grants permission to retrieve objects from Amazon S3.',
        resourceTypes: ['object'],
        conditionKeys: [],
        dependentActions: [],
        documentationUrl: 'https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html'
      },
      {
        name: 'PutObject',
        description: 'Grants permission to add an object to a bucket.',
        resourceTypes: ['object'],
        conditionKeys: [],
        dependentActions: [],
        documentationUrl: 'https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html'
      }
    ]
  }],
  dynamodb: [{
    serviceName: 'Amazon DynamoDB',
    servicePrefix: 'dynamodb',
    url: 'https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazondynamodb.html',
    actions: [
      {
        name: 'GetItem',
        description: 'Returns a set of attributes for the item with the given primary key.',
        resourceTypes: ['table'],
        conditionKeys: [],
        dependentActions: [],
        documentationUrl: 'https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html'
      }
    ]
  }]
});

// Create a minimal TextDocuments mock that holds a single document
const createDocuments = (doc: TextDocument) => {
  const map = new Map<string, TextDocument>();
  map.set(doc.uri, doc);
  return { get: (uri: string) => map.get(uri) } as TextDocuments<TextDocument>;
};

describe('[completionHandler]', () => {
  it('should return empty list when not inside actions array', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'resources:\n  - arn:aws:s3');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 10 } },
      documents,
      makeServicesByPrefix()
    );

    assert.strictEqual(result.items.length, 0);
  });

  it('should return service suggestions when inside actions with no service prefix', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'actions:\n  - ');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 4 } },
      documents,
      makeServicesByPrefix()
    );

    assert.ok(result.items.length > 0);
    const labels = result.items.map(i => i.label);
    assert.ok(labels.includes('s3'));
    assert.ok(labels.includes('dynamodb'));
  });

  it('should return action suggestions when service prefix is present', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'actions:\n  - s3:');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 7 } },
      documents,
      makeServicesByPrefix()
    );

    assert.ok(result.items.length > 0);
    const labels = result.items.map(i => i.label);
    assert.ok(labels.includes('GetObject'));
    assert.ok(labels.includes('PutObject'));
  });

  it('should return empty list for unknown document URI', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'actions:\n  - s3:');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: 'file:///unknown.yaml' }, position: { line: 1, character: 7 } },
      documents,
      makeServicesByPrefix()
    );

    assert.strictEqual(result.items.length, 0);
  });
});
