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
    ],
    resourceTypes: [
      { name: 'bucket', arn: 'arn:aws:s3:::${BucketName}', conditionKeys: [] },
      { name: 'object', arn: 'arn:aws:s3:::${BucketName}/${ObjectKey}', conditionKeys: [] }
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
    ],
    resourceTypes: [
      { name: 'table', arn: 'arn:aws:dynamodb:${Region}:${Account}:table/${TableName}', conditionKeys: [] }
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
  it('should return empty list when not inside actions or resource array', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Effect: Allow\n  something');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 5 } },
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

  it('should return partition suggestions for arn:', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Resource:\n  - arn:');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 8 } },
      documents,
      makeServicesByPrefix()
    );

    const labels = result.items.map(i => i.label);
    assert.ok(labels.includes('aws'));
    assert.ok(labels.includes('aws-cn'));
    assert.ok(labels.includes('aws-us-gov'));
    assert.strictEqual(result.items.length, 3);
  });

  it('should return service suggestions for arn:aws:', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Resource:\n  - arn:aws:');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 12 } },
      documents,
      makeServicesByPrefix()
    );

    const labels = result.items.map(i => i.label);
    assert.ok(labels.includes('s3'));
    assert.ok(labels.includes('dynamodb'));
  });

  it('should filter service suggestions by typed text', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Resource:\n  - arn:aws:dyn');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 15 } },
      documents,
      makeServicesByPrefix()
    );

    const labels = result.items.map(i => i.label);
    assert.ok(labels.includes('dynamodb'));
    assert.ok(!labels.includes('s3'));
  });

  it('should return region suggestions for arn:aws:s3:', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Resource:\n  - arn:aws:s3:');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 15 } },
      documents,
      makeServicesByPrefix()
    );

    const labels = result.items.map(i => i.label);
    assert.ok(labels.includes('us-east-1'));
    assert.ok(!labels.includes('(empty)'));
  });

  it('should return account suggestions for arn:aws:s3::', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Resource:\n  - arn:aws:s3::');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 16 } },
      documents,
      makeServicesByPrefix()
    );

    const labels = result.items.map(i => i.label);
    assert.ok(labels.includes('AccountId'));
    assert.strictEqual(result.items.length, 1);
  });

  it('should return resource type suffixes for arn:aws:s3:::', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Resource:\n  - arn:aws:s3:::');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 17 } },
      documents,
      makeServicesByPrefix()
    );

    assert.ok(result.items.length > 0);
    const labels = result.items.map(i => i.label);
    assert.ok(labels.some(l => l.includes('BucketName')));
  });

  it('should return empty list when no word is typed in Resource array', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Resource:\n  - ');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 4 } },
      documents,
      makeServicesByPrefix()
    );

    assert.strictEqual(result.items.length, 0);
  });

  it('should filter partition suggestions by typed text', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Resource:\n  - arn:aw');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 10 } },
      documents,
      makeServicesByPrefix()
    );

    const labels = result.items.map(i => i.label);
    assert.ok(labels.includes('aws'));
    assert.ok(labels.includes('aws-cn'));
    assert.ok(labels.includes('aws-us-gov'));
  });

  it('should filter region suggestions by typed text', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Resource:\n  - arn:aws:s3:eu');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 17 } },
      documents,
      makeServicesByPrefix()
    );

    const labels = result.items.map(i => i.label);
    assert.ok(labels.every(l => l.startsWith('eu-')));
    assert.ok(labels.includes('eu-west-1'));
    assert.ok(!labels.includes('us-east-1'));
  });

  it('should return resource suffixes with ${} in labels', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Resource:\n  - arn:aws:s3:::');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 17 } },
      documents,
      makeServicesByPrefix()
    );

    const labels = result.items.map(i => i.label);
    assert.ok(labels.includes('${BucketName}'));
    assert.ok(labels.includes('${BucketName}/${ObjectKey}'));
  });

  it('should return empty resource suffixes for unknown service', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1, 'Resource:\n  - arn:aws:unknown:::');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 1, character: 22 } },
      documents,
      makeServicesByPrefix()
    );

    assert.strictEqual(result.items.length, 0);
  });

  it('should work inside Resource array after a comment', () => {
    const doc = TextDocument.create('file:///test.yaml', 'yaml', 1,
      'Resource:\n  - arn:aws:s3:::bucket\n  # todo\n  - arn:');
    const documents = createDocuments(doc);

    const result = handleCompletion(
      { textDocument: { uri: doc.uri }, position: { line: 3, character: 8 } },
      documents,
      makeServicesByPrefix()
    );

    const labels = result.items.map(i => i.label);
    assert.ok(labels.includes('aws'));
  });

});
