import { execFileSync, ExecSyncOptions } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import {
  createWithLock,
  CreateWithLockOptions,
  getPackageManager,
  PackageManagerConfig,
  packageManagerExec,
  packageManagerInstall,
  setPackagerManagerConfig
} from '../utilities';

export interface CreateTestEnvironmentOtterProjectWithAppOptions extends CreateWithLockOptions, PackageManagerConfig {
  /**
   * Name of the app to generate
   */
  appName: string;

  /**
   * Working directory
   */
  cwd: string;

  /**
   * Otter dependency version
   * @default '999.0.0'
   */
  o3rVersion: string;
}

const o3rVersion = '999.0.0';

/**
 * Generate a base angular app with minimal necessary dependencies
 * Uses a locker mechanism so this function can be called in parallel
 * The lock will automatically expire after 10 minutes if the creation of the app failed for whatever reason
 * @param inputOptions
 */
export async function createTestEnvironmentOtterProjectWithApp(inputOptions: Partial<CreateTestEnvironmentOtterProjectWithAppOptions>) {
  const options: CreateTestEnvironmentOtterProjectWithAppOptions = {
    appName: 'test-app',
    appDirectory: 'test-app',
    o3rVersion,
    cwd: process.cwd(),
    globalFolderPath: process.cwd(),
    registry: 'http://127.0.0.1:4873',
    useLocker: true,
    lockTimeout: 10 * 60 * 1000,
    replaceExisting: true,
    ...inputOptions
  };

  await createWithLock(() => {
    const appFolderPath = path.join(options.cwd, options.appDirectory);
    const execAppOptions: ExecSyncOptions = {
      cwd: appFolderPath,
      stdio: 'inherit',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      env: {...process.env, NODE_OPTIONS: '', CI: 'true'}
    };

    // Prepare folder
    if (existsSync(appFolderPath)) {
      rmSync(appFolderPath, {recursive: true});
    }

    // Create Project
    setPackagerManagerConfig(options, { ...execAppOptions, cwd: options.cwd});
    const createOptions = `--package-manager=${getPackageManager()}`;
    execFileSync('npm', `create @o3r@${o3rVersion} ${options.appDirectory} -- ${createOptions}`.split(' '),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      {...execAppOptions, cwd: options.cwd, shell: process.platform === 'win32'});
    // By default node_modules inside projects are not git-ignored
    const gitIgnorePath = path.join(appFolderPath, '.gitignore');
    if (existsSync(gitIgnorePath)) {
      const gitIgnore = readFileSync(gitIgnorePath, {encoding: 'utf8'});
      writeFileSync(gitIgnorePath, gitIgnore.replace(/\/(dist|node_modules)/g, '$1'));
    }
    setPackagerManagerConfig(options, execAppOptions);
    packageManagerInstall(execAppOptions);
    packageManagerExec('ng g application dont-modify-me --style=scss --routing --skip-install', execAppOptions);
    packageManagerExec(`ng g application ${options.appName} --style=scss --routing --skip-install`, execAppOptions);


    packageManagerExec('ng config cli.cache.environment all', execAppOptions);
    if (options.globalFolderPath) {
      packageManagerExec(`ng config cli.cache.path "${path.join(options.globalFolderPath, '.angular', 'cache')}"`, execAppOptions);
    }

    return Promise.resolve();
  }, {lockFilePath: path.join(options.cwd, `${options.appDirectory}-ongoing.lock`), ...options});
}
