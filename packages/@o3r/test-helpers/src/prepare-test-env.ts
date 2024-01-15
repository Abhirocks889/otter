import { execSync, ExecSyncOptions } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import * as path from 'node:path';
import type { PackageJson } from 'type-fest';
import { createTestEnvironmentBlank } from './test-environments/create-test-environment-blank';
import { createWithLock, packageManagerInstall, setPackagerManagerConfig, setupGit } from './utilities/index';
import { createTestEnvironmentOtterProjectWithApp } from './test-environments/create-test-environment-otter-project';
import { O3rCliError } from '@o3r/schematics';

/**
 * - 'blank' only create yarn/npm config
 * - 'o3r-project' create a new otter project with a new application
 */
//  * - 'angular' also create a new angular app
//  * - 'angular-with-o3r-core' also preinstall o3r-core with basic preset
//  * - 'angular-monorepo' is the same as 'angular' but with a monorepo structure
//  * - 'angular-monorepo-with-o3r-core' is the same as 'angular-with-o3r-core' but with a monorepo structure
export type PrepareTestEnvType = 'blank' | 'o3r-project';

/**
 * Retrieve the version used by yarn and setup at root level
 * @param rootFolderPath: path to the folder where to take the configuration from
 * @param rootFolderPath
 */
export function getYarnVersionFromRoot(rootFolderPath: string) {
  const o3rPackageJson: PackageJson & { generatorDependencies?: Record<string, string> } =
    JSON.parse(readFileSync(path.join(rootFolderPath, 'package.json')).toString());
  return o3rPackageJson?.packageManager?.split('@')?.[1] || 'latest';
}

export interface PrepareTestEnvOptions {
  /** Type of environment to prepare */
  type?: PrepareTestEnvType;
  /** Explicitly set the yarn version for yarn environment. Else it will default to the folder package.json */
  yarnVersion?: string;
  /** Logger to use for logging */
  logger?: { error: (message: string) => void; debug?: (message: string) => void };
}

/**
 * Prepare a test environment to be used to run tests targeting a local registry
 * @param folderName
 * @param options
 */
export async function prepareTestEnv(folderName: string, options?: PrepareTestEnvOptions) {
  const type = options?.type || process.env.PREPARE_TEST_ENV_TYPE || 'o3r-project';
  const logger = options?.logger || console;
  const yarnVersionParam = options?.yarnVersion;
  const rootFolderPath = process.cwd();
  const itTestsFolderPath = path.join(rootFolderPath, '..', 'it-tests');
  const appFolderPath = path.join(itTestsFolderPath, folderName);
  const globalFolderPath = path.join(rootFolderPath, '.cache', 'test-app');
  const cacheFolderPath = path.join(globalFolderPath, 'cache');

  // const o3rCorePackageJson: PackageJson & { generatorDependencies?: Record<string, string> } =
  JSON.parse(readFileSync(path.join(rootFolderPath, 'packages', '@o3r', 'core', 'package.json')).toString());
  const yarnVersion: string = yarnVersionParam || getYarnVersionFromRoot(rootFolderPath);
  // const angularVersion = minVersion(o3rCorePackageJson.devDependencies?.['@angular-devkit/schematics'] || 'latest')?.version;
  // const materialVersion = minVersion(o3rCorePackageJson.generatorDependencies?.['@angular/material'] || angularVersion || 'latest')?.version;
  const execAppOptions: ExecSyncOptions = {
    cwd: appFolderPath,
    stdio: 'inherit',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    env: {...process.env, NODE_OPTIONS: '', CI: 'true'}
  };

  // Remove all cache entries relative to local workspaces (@o3r, @ama-sdk, @ama-terasu)
  if (!process.env.CI && existsSync(cacheFolderPath)) {
    const workspacesList = execSync('yarn workspaces:list', {stdio: 'pipe'}).toString().split('\n')
      .map((workspace) => workspace.replace('packages/', '').replace(/\//, '-'))
      .filter((workspace) => !!workspace);
    readdirSync(cacheFolderPath).forEach((fileName) => {
      if (workspacesList.some((workspace) => fileName.startsWith(workspace))) {
        const cacheFile = path.join(cacheFolderPath, fileName);
        // Not ideal solution but the tests are running in parallel, so we cannot always clean the cache
        if (Date.now() - statSync(cacheFile).birthtime.getTime() > (60 * 60 * 1000)) {
          rmSync(cacheFile);
        }
      }
    });
  }

  // Create it-tests folder
  if (!existsSync(itTestsFolderPath)) {
    logger.debug?.(`Creating it-tests folder`);
    await createWithLock(() => {
      mkdirSync(itTestsFolderPath);
      setPackagerManagerConfig({yarnVersion, globalFolderPath, registry: 'http://localhost:4873'}, {...execAppOptions, cwd: itTestsFolderPath});
      return Promise.resolve();
    }, {lockFilePath: `${itTestsFolderPath}.lock`, cwd: path.join(rootFolderPath, '..'), appDirectory: 'it-tests'});
  }

  // Remove existing app
  if (existsSync(appFolderPath)) {
    rmSync(appFolderPath, {recursive: true});
  }

  const prepareFinalApp = (baseApp: string) => {
    logger.debug?.(`Copying ${baseApp} to ${appFolderPath}`);
    const baseAppPath = path.join(itTestsFolderPath, baseApp);
    cpSync(baseAppPath, appFolderPath, { recursive: true, dereference: true, filter: (source) => !/node_modules/.test(source) });
    packageManagerInstall(execAppOptions);
  };

  let appPath!: string;
  let appName: string | undefined;
  switch (type) {
    case 'blank': {
      createTestEnvironmentBlank({
        appDirectory: folderName,
        cwd: itTestsFolderPath,
        globalFolderPath,
        yarnVersion
      });
      appPath = path.join(itTestsFolderPath, folderName);
      break;
    }

    case 'o3r-project': {
      const baseApp = 'o3r-project';
      appName = 'test-app';
      await createTestEnvironmentOtterProjectWithApp({
        appName,
        appDirectory: baseApp,
        cwd: itTestsFolderPath,
        globalFolderPath,
        yarnVersion,
        replaceExisting: !process.env.CI
      });
      prepareFinalApp(baseApp);
      appPath = path.join(appFolderPath, 'apps', appName);
      break;
    }

    default: {
      throw new O3rCliError(`Unknown test environment type: ${type}`);
    }
  }

  // Setup git and initial commit to easily make checks on the diff inside the tests
  setupGit(appFolderPath);

  return {
    workspacePath: appFolderPath,
    appPath,
    appName
  };
}
