import * as fs from 'fs';

export async function fileSize(name: string): Promise<number> {
  const stat = await fs.promises.stat(name);
  return stat.size;
}

export async function fileExists(name: string): Promise<boolean> {
  return fs.promises
    .access(name, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
}
