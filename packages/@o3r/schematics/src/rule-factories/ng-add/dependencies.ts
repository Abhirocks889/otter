import { chain, Rule, Schematic } from '@angular-devkit/schematics';
import { NodeDependencyType } from '@schematics/angular/utility/dependencies';
import * as path from 'node:path';
import type { PackageJson } from 'type-fest';
import * as semver from 'semver';
import { getPackageManager, getWorkspaceConfig, SupportedPackageManagers } from '../../utility';
import { NodePackageInstallTask, RunSchematicTask } from '@angular-devkit/schematics/tasks';

/**
 * Options to be passed to the ng add task
 */
export interface NgAddSchematicOptions {
  /** Name of the project */
  projectName?: string | null;

  /** Skip the run of the linter*/
  skipLinter?: boolean;

  /** Skip the install process */
  skipInstall?: boolean;

  [x: string]: any;
}

export interface DependencyInManifest {
  /**
   * Range of the dependency
   * @default 'latest'
   */
  range?: string;
  /**
   * Types of the dependency
   * @default [NodeDependencyType.Default]
   */
  types?: NodeDependencyType[];
}

export interface DependencyToAdd {
  /** Enforce this dependency to be applied to Workspace's manifest only */
  toWorkspaceOnly?: boolean;
  /** List of dependency to register in manifest */
  inManifest: DependencyInManifest[];
  /** ng-add schematic option dedicated to the package */
  ngAddOptions?: NgAddSchematicOptions;
}

export interface SetupDependenciesOptions {
  /** Map of dependencies to install */
  dependencies: Record<string, DependencyToAdd>;
  /**
   * Pattern of list of the dependency for which the ng-add run process is required
   */
  ngAddToRun?: (RegExp | string)[];
  /**
   * Will skip install in the end of the package.json update.
   * if `undefined`, the installation will be process only if a ngAdd run is required).
   * If `true` the install will not run in any case
   * @default undefined
   */
  skipInstall?: boolean;
  /** Project Name */
  projectName?: string;
  /** default ng-add schematic option */
  ngAddOptions?: NgAddSchematicOptions;
  /** Enforce install package manager */
  packageManager?: SupportedPackageManagers;
}

/**
 * Setup dependency to a repository.
 * Will run manually the ngAdd schematics according to the parameters and install the packages if required
 * @param options
 */
export const setupDependencies = (options: SetupDependenciesOptions): Rule => {

  const ngAddToRun = new Set(Object.keys(options.dependencies)
    .filter((dep) => options.ngAddToRun?.some((pattern) => typeof pattern === 'string' ? pattern === dep : pattern.test(dep))));
  const isInstallNeeded = () => typeof options.skipInstall !== 'undefined' ? !options.skipInstall : ngAddToRun.size > 0;

  const editPackageJson = (packageJsonPath: string, packageToInstall: string, dependency: DependencyToAdd, updateNgAddList: boolean): Rule => {
    return (tree, context) => {
      const packageJsonContent = tree.readJson(packageJsonPath) as PackageJson;

      dependency.inManifest.forEach(({ range, types }) => {
        (types || [NodeDependencyType.Default]).forEach((depType) => {
          if (packageJsonContent[depType]?.[packageToInstall]) {
            if (range && semver.validRange(range)) {
              const currentMinimalVersion = semver.minVersion(packageJsonContent[depType]?.[packageToInstall] as string);
              const myRangeMinimalVersion = semver.minVersion(range);
              if (currentMinimalVersion && myRangeMinimalVersion && semver.gt(myRangeMinimalVersion, currentMinimalVersion)) {
                packageJsonContent[depType]![packageToInstall] = range;
              } else {
                if (updateNgAddList) {
                  ngAddToRun.delete(packageToInstall);
                }
                context.logger.warn(`The dependency ${packageToInstall} (${depType}) will not added ` +
                  `because its range is inferior to the current one (${range} < ${packageJsonContent[depType]![packageToInstall]!}) in targeted ${packageJsonPath}`);
              }
            } else {
              if (updateNgAddList) {
                ngAddToRun.delete(packageToInstall);
              }
              context.logger.warn(`The dependency ${packageToInstall} (${depType}) will not added ` +
                `because there is already this dependency with a defined range (${packageJsonContent[depType]![packageToInstall]!}) in targeted ${packageJsonPath}`);
            }
          } else {
            packageJsonContent[depType] ||= {};
            packageJsonContent[depType]![packageToInstall] = range;
          }
          packageJsonContent[depType] = Object.keys(packageJsonContent[depType]!)
            .sort()
            .reduce((acc, key) => {
              acc[key] = packageJsonContent[depType]![key];
              return acc;
            }, {} as PackageJson.Dependency);
        });
      });

      const content = JSON.stringify(packageJsonContent, null, 2);
      tree.overwrite(packageJsonPath, content);
    };
  };

  const addDependencies: Rule = (tree) => {
    const workspaceConfig = getWorkspaceConfig(tree);
    const workspaceProject = options.projectName && workspaceConfig?.projects?.[options.projectName] || undefined;
    const projectDirectory = workspaceProject?.root;
    Object.entries(options.dependencies)
      .map(([packageName, dependencyDetails]) => {
        const shouldRunInSubPackage = projectDirectory && !dependencyDetails.toWorkspaceOnly;
        const rootPackageRule = editPackageJson('package.json', packageName, dependencyDetails, !shouldRunInSubPackage);
        if (shouldRunInSubPackage) {
          return chain([
            rootPackageRule,
            editPackageJson(path.posix.join(projectDirectory, 'package.json'), packageName, dependencyDetails, true)
          ]);
        }
        return rootPackageRule;
      });
  };

  const runNgAddSchematics: Rule = (_, context) => {
    const packageManager = options.packageManager || getPackageManager();
    const installId = isInstallNeeded() ? context.addTask(new NodePackageInstallTask({ packageManager })) : undefined;

    const getOptions = (packageName: string, schema: Schematic<any, any>) => {
      const schemaOptions = schema.description.schemaJson?.properties || {};
      return Object.entries({ projectName: options.projectName, ...options.ngAddOptions, ...options.dependencies[packageName].ngAddOptions })
        .reduce<Record<string, any>>((accOptions, [key, value]: [string, any]) => {
          if (schemaOptions[key]) {
            accOptions[key] = value;
          }
          return accOptions;
        }, {});
    };

    [...ngAddToRun]
      .map((packageName) => {
        try {
          const collection = context.engine.createCollection(packageName);
          return { packageName, schematic: collection.createSchematic('ng-add') };
        } catch {
          context.logger.warn(`No ng-add found for ${packageName}`);
          return undefined;
        }
      })
      .filter((collection): collection is { packageName: string; schematic: Schematic<any, any> } => !!collection)
      .reduce((id, { packageName, schematic }) =>
        context.addTask(new RunSchematicTask(packageName, 'ng-add', getOptions(packageName, schematic)), id && [id]),
      installId);
  };

  return chain([
    addDependencies,
    runNgAddSchematics
  ]);

};
