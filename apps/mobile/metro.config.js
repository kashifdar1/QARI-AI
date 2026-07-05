const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

// Source uses TS's ESM-style ".js" specifiers on relative imports (resolved
// back to .ts/.tsx by tsc/Bundler moduleResolution). Metro has no equivalent
// remapping, so retry failed ".js" resolutions against .ts/.tsx.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = (name) =>
    defaultResolveRequest
      ? defaultResolveRequest(context, name, platform)
      : context.resolveRequest(context, name, platform);

  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const withoutExt = moduleName.slice(0, -3);
    try {
      return resolve(moduleName);
    } catch (e) {
      for (const ext of ['.tsx', '.ts']) {
        try {
          return resolve(withoutExt + ext);
        } catch (e2) {
          // try next extension
        }
      }
      throw e;
    }
  }

  return resolve(moduleName);
};

module.exports = config;
