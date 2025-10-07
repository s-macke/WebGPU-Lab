import {defineConfig} from 'vite'
import glsl from 'vite-plugin-glsl';


export default defineConfig({
    root: 'src',
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