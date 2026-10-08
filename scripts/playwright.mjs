// Loads Playwright from the local project or from the global npm prefix (it is not a dependency).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

export async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return createRequire(join(globalRoot, 'noop.js'))('playwright');
  }
}
