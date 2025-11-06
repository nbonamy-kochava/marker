import { defineConfig } from 'vite';
import { builtinModules } from 'module';
import pkg from './package.json';

const external = [
  'electron',
  ...builtinModules.flatMap(m => [m, `node:${m}`]),
  ...Object.keys(pkg.dependencies || {})
];

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as any;
  const { forgeConfigSelf } = forgeEnv;

  return {
    build: {
      lib: {
        entry: forgeConfigSelf.entry!,
        fileName: () => 'main.js',
        formats: ['cjs'],
      },
      rollupOptions: {
        external,
      },
    },
    resolve: {
      mainFields: ['module', 'jsnext:main', 'jsnext'],
    },
  };
});
