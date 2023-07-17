import type { JsonObject } from '@angular-devkit/core';

export interface NgGenerateTypescriptSDKShellSchematicsSchema extends JsonObject {
  /** Project name (NPM package scope) */
  name: string;

  /** Package name */
  package: string;

  /** Project description */
  description: string;

  /** Directory where to generate the SDK */
  directory: string;

  /** Package manager to be used in the generated SDK */
  packageManager: 'npm' | 'yarn' | '';

  /** Skip NPM install */
  skipInstall: boolean;
}