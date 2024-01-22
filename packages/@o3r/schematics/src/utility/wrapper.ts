import type { JsonObject } from '@angular-devkit/core';
import { askConfirmation } from '@angular/cli/src/utilities/prompt';
import type { SchematicWrapper } from '@o3r/telemetry';
import { NodeDependencyType } from '@schematics/angular/utility/dependencies';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { lastValueFrom } from 'rxjs';
import { NodePackageNgAddTask } from '../tasks/index';

const noopSchematicWrapper: SchematicWrapper = (fn) => fn;

/**
 * Wrapper method of a schematic to retrieve some metrics around the schematic run
 * if @o3r/telemetry is installed
 * @param schematicFn
 */
export const createSchematicWithMetricsIfInstalled: SchematicWrapper = (schematicFn) => (opts) => async (tree, context) => {
  let wrapper: SchematicWrapper = noopSchematicWrapper;
  const packageJsonPath = 'package.json';
  const packageJson = tree.exists(packageJsonPath) ? tree.readJson(packageJsonPath) as JsonObject : {};
  try {
    const { createSchematicWithMetrics } = await import('@o3r/telemetry');
    if ((packageJson.config as JsonObject)?.o3rMetrics) {
      wrapper = createSchematicWithMetrics;
    }
  } catch (e: any) {
    // Do not throw if `@o3r/telemetry is not installed
    if ((packageJson.config as JsonObject)?.o3rMetrics) {
      context.logger.warn('`config.o3rMetrics` is set to true in your package.json, please install the telemetry package with `ng add @o3r/telemetry` to enable the collect of metrics.');
    } else if (context.interactive && (packageJson.config as JsonObject)?.o3rMetrics !== false) {
      context.logger.debug('`@o3r/telemetry` is not available.\nAsking to add the dependency\n' + e.toString());

      const isReplyPositive = await askConfirmation(
        `
Would you like to share anonymous usage data about this project with the Otter Team at Amadeus ?
It will help us to improve our tools.
For more details and instructions on how to change these settings, see https://github.com/AmadeusITGroup/otter/blob/main/docs/telemetry/README.md.
        `,
        false
      );

      if (isReplyPositive) {
        const version = JSON.parse(readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf-8')).version;
        context.addTask(
          new NodePackageNgAddTask(
            '@o3r/telemetry',
            {
              dependencyType: NodeDependencyType.Dev,
              version
            }
          )
        );
        await lastValueFrom(context.engine.executePostTasks());

        try {
          const { createSchematicWithMetrics } = await import('@o3r/telemetry');
          wrapper = createSchematicWithMetrics;
        } catch {
          // If pnp context package installed in the same process will not be available
        }
      } else {
        context.logger.info('You can activate it at any time by running `ng add @o3r/telemetry`.');

        packageJson.config ||= {};
        (packageJson.config as JsonObject).o3rMetrics = false;

        if (tree.exists(packageJsonPath)) {
          tree.overwrite(
            packageJsonPath,
            JSON.stringify(packageJson, null, 2)
          );
        }
      }
    }
  }
  return wrapper(schematicFn)(opts);
};
