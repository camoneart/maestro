import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts', 'src/mcp/server.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  minify: false,
  target: 'node18',
  // キャッシュ設定で高速化
  cacheDir: '.tsup-cache',
  // watchモードでのみcleanをfalseにして高速化
  onSuccess: async () => {
    if (process.env.TSUP_WATCH) {
      console.log('✨ Build completed (watch mode, cache enabled)')
    }
  }
})