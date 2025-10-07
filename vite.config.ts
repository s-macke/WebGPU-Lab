import {defineConfig} from 'vite'
import glsl from 'vite-plugin-glsl';


export default defineConfig({
    root: 'src',
    base: '', // use relative references
    publicDir: '../assets',
    plugins: [
        glsl({
            include: ['**/*.wgsl'],
        }),
    ],
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        sourcemap: true,
    }
})