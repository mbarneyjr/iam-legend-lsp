import type { IamAction } from "./IamAction.ts";
import type { IamResourceType } from "./IamResourceType.ts";

export type IamService = {
  serviceName: string;
  servicePrefix: string;
  url: string;
  actions: IamAction[];
  resourceTypes: IamResourceType[];
};

export type IamServicesByPrefix = Record<ServicePrefix, IamService[]>;

type ServicePrefix = string;
