import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'renderer'>;
  const { root, mode, forgeConfigSelf } = forgeEnv;
  const name = forgeConfigSelf.name ?? '';

  return {
    root,
    mode,
    base: './',
    build: {
      outDir: `.vite/renderer/${name}`,
    },
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer')
      }
    },
    clearScreen: false,
  } as UserConfig;
});
