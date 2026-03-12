import type { IamAction } from "./IamAction.ts";

export type IamService = {
  serviceName: string;
  servicePrefix: string;
  url: string;
  actions: IamAction[];
};

export type IamServicesByPrefix = Record<ServicePrefix, IamService[]>;

type ServicePrefix = string;
