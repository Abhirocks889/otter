import {
  addImportToAppModule,
  getDefaultExecSyncOptions,
  getGitDiff,
  packageManagerExec,
  packageManagerInstall,
  packageManagerRun,
  prepareTestEnv,
  setupLocalRegistry
} from '@o3r/test-helpers';
import { rm } from 'node:fs/promises';

const appName = 'test-app-rules-engine';
const o3rVersion = '999.0.0';
const execAppOptions = getDefaultExecSyncOptions();
let appFolderPath: string;

describe('new otter application with rules-engine', () => {
  setupLocalRegistry();
  describe('standalone', () => {
    beforeAll(async () => {
      appFolderPath = await prepareTestEnv(appName, 'angular-with-o3r-core');
      execAppOptions.cwd = appFolderPath;
    });
    test('should add rules engine to existing application', () => {
      packageManagerExec(`ng add --skip-confirmation @o3r/rules-engine@${o3rVersion} --enable-metadata-extract`, execAppOptions);

      packageManagerExec('ng g @o3r/core:component test-component --activate-dummy --use-rules-engine=false', execAppOptions);
      packageManagerExec('ng g @o3r/rules-engine:rules-engine-to-component --path=src/components/test-component/test-component.component.ts', execAppOptions);
      addImportToAppModule(appFolderPath, 'TestComponentModule', 'src/components/test-component');

      const diff = getGitDiff(appFolderPath);
      expect(diff.modified).toContain('package.json');

      expect(() => packageManagerInstall(execAppOptions)).not.toThrow();
      expect(() => packageManagerRun('build', execAppOptions)).not.toThrow();
    });
    afterAll(() => rm(execAppOptions.cwd, {recursive: true}));
  });
});
