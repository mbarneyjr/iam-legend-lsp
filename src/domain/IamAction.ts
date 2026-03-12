export type IamAction = {
  name: string;
  description: string;
  resourceTypes: string[];
  conditionKeys: string[];
  dependentActions: string[];
  documentationUrl: string;
};
