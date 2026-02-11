
const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['src/huawei/index.js'],
    bundle: true,
    outfile: 'dist/huawei/index.js',
    platform: 'node',
    target: 'node16.17',
    external: [], // List any externals if needed, but for FunctionGraph we usually want to bundle everything
}).catch(() => process.exit(1));

console.log('Build complete: dist/huawei/index.js');
