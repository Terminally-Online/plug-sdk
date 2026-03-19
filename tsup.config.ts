import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts', 'src/react.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react/jsx-runtime', '@tanstack/react-query', 'zod'],
    treeshake: true,
    minify: true
})
