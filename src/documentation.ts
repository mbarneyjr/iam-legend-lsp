import type { IamService, IamAction, IamResourceType } from "./domain/index.ts";

const mdEOL = '\n\n';

export const createServiceDocs = ({ serviceName, url }: IamService) =>
  `${serviceName} [IAM Reference](${url})`;

export const createActionDocs = (action: IamAction) => {
  const lines = [];
  lines.push(
    action.documentationUrl
      ? `**[${action.name}](${action.documentationUrl})**`
      : `**${action.name}**`
  );

  lines.push(`${action.description}`);

  if (action.resourceTypes && action.resourceTypes.length) {
    lines.push('Resource Types:');
    lines.push(action.resourceTypes.map(x => '- ' + x).join('\n'));
  }

  if (action.conditionKeys && action.conditionKeys.length) {
    lines.push('Condition Keys:');
    lines.push(action.conditionKeys.map(x => '- ' + x).join('\n'));
  }

  if (action.dependentActions && action.dependentActions.length) {
    lines.push('Dependent Actions:');
    lines.push(action.dependentActions.map(x => '- ' + x).join('\n'));
  }

  return lines.join(mdEOL);
};

const createServiceActionDocs = ({ serviceName }: IamService, actions: IamAction[]) => {
  const lines = [];
  lines.push(`**${serviceName}**`);
  lines.push(actions.map(x => createShortActionDocs(x)).join(mdEOL));

  return lines.join(mdEOL);
};

const createShortActionDocs = ({ name, documentationUrl, description }: IamAction) => {
  const lines = [];
  lines.push(
    documentationUrl
      ? `**[${name}](${documentationUrl})**`
      : `**${name}**`
  );

  lines.push(`${description}`);

  return lines.join(mdEOL);
};

export const createResourceTypeDocs = (resourceType: IamResourceType) => {
  const lines = [];
  lines.push(`**${resourceType.name}**`);
  lines.push(`ARN: \`${resourceType.arn}\``);

  if (resourceType.conditionKeys.length > 0) {
    lines.push('Condition Keys:');
    lines.push(resourceType.conditionKeys.map(x => '- ' + x).join('\n'));
  }

  return lines.join(mdEOL);
};

export const createServicesActionDocs = (items: { service: IamService; actions: IamAction[]; }[]) => {
  if (items.length === 0) {
    return 'No matching actions';
  }

  if (items.length === 1 && items[0].actions.length === 1) {
    return items.map(({ service, actions }) => createServiceActionDocs(service, actions)).join(mdEOL);
  }

  return `Matches multiple actions:\n` + items.map(({ service, actions }) => createServiceActionDocs(service, actions)).join('\n\n---\n\n');
};
