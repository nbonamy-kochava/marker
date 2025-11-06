import { defineConfig } from 'vite';
import { builtinModules } from 'module';

const external = [
  'electron',
  ...builtinModules.flatMap(m => [m, `node:${m}`])
];

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as any;
  const { forgeConfigSelf } = forgeEnv;

  return {
    build: {
      rollupOptions: {
        external,
        input: forgeConfigSelf.entry!,
        output: {
          format: 'cjs',
          inlineDynamicImports: true,
          entryFileNames: 'preload.js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
        },
      },
    },
    resolve: {
      mainFields: ['module', 'jsnext:main', 'jsnext'],
    },
  };
});
