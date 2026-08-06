import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* 導覽列右上角要顯示版本號。從 package.json 取值而不是在畫面上寫死字串，
 * 改版時只要動 package.json 一處，介面就跟著更新，不會有版本對不上的情況。 */
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  plugins: [react()],
  base: './',
  root: '.',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
  },
});
