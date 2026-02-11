
const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['src/huawei/index.js'],
    bundle: true,
    outfile: 'dist/huawei/index.js',
    platform: 'node',
    target: 'node16.17',
    format: 'cjs',
    bundle: true,
    minify: false, // Keep it readable for debugging
    sourcemap: false,
    external: [],
}).then(() => {
    console.log('Build complete: dist/huawei/index.js');
}).catch(() => process.exit(1));
