import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupBy } from './domain/utility/index.ts';
import type { IamService, IamServicesByPrefix } from './domain/index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const getIamServicesByPrefix = async () => {
  const directory = resolve(__dirname, 'data', 'iam-services');
  const files = await readdir(directory);
  const readFiles = files.map(
    file => readFile(resolve(directory, file), 'utf8')
      .then((data) => {
        const parsed = JSON.parse(data);
        parsed.resourceTypes ??= [];
        return parsed as IamService;
      })
  );

  const services = await Promise.all(readFiles);
  const servicesByPrefix = groupBy(services, 'servicePrefix');
  return servicesByPrefix as IamServicesByPrefix;
};
