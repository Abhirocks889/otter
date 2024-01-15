import {
  addDependenciesToPackageJson,
  addImportToAppModule,
  getDefaultExecSyncOptions,
  getGitDiff,
  packageManagerExec,
  packageManagerInstall,
  packageManagerRun,
  prepareTestEnv,
  setupLocalRegistry
} from '@o3r/test-helpers';
import * as path from 'node:path';

const folderName = 'test-app-styling';
const o3rVersion = '999.0.0';
const execAppOptions = getDefaultExecSyncOptions();
let appFolderPath!: string;
let projectNameParam!: string;
let testWorkspacePath!: string;
describe('new otter application with styling', () => {
  setupLocalRegistry();
  beforeAll(async () => {
    const { workspacePath, appName, appPath } = await prepareTestEnv(folderName);
    projectNameParam = `--project-name=${appName}`;
    appFolderPath = appPath;
    testWorkspacePath = workspacePath;
    execAppOptions.cwd = workspacePath;
  });
  test('should add styling to existing application', async () => {
    addDependenciesToPackageJson([testWorkspacePath, appFolderPath], '@o3r/styling', o3rVersion, 'devDependencies');
    packageManagerExec(`ng add --skip-confirmation @o3r/styling@${o3rVersion} --enable-metadata-extract`, execAppOptions);

    packageManagerExec(`ng g @o3r/core:component --defaults=true test-component --use-otter-theming=false ${projectNameParam}`, execAppOptions);
    const filePath = path.join(path.relative(testWorkspacePath, appFolderPath), 'src/components/test-component/test-component.style.scss');
    packageManagerExec(`ng g @o3r/styling:add-theming --path="${filePath}"`, execAppOptions);
    addImportToAppModule(appFolderPath, 'TestComponentModule', 'src/components/test-component');

    await addImportToAppModule(appFolderPath, 'TestComponentModule', 'src/components/test-component');

    const diff = getGitDiff(execAppOptions.cwd as string);
    expect(diff.modified).toContain('package.json');
    expect(diff.added).toContain('src/components/test-component/test-component.style.theme.scss');

    expect(() => packageManagerInstall(execAppOptions)).not.toThrow();
    expect(() => packageManagerRun('build', { ...execAppOptions, cwd: appFolderPath })).not.toThrow();
  });
});
