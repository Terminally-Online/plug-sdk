import { defineConfig } from 'tsup'

export default defineConfig({
    entry: [
        'src/provider.tsx',
        'src/index.ts',
        'src/client.ts'
    ],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['react', '@tanstack/react-query', 'zod'],
    treeshake: true,
    minify: true
})
