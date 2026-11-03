import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const nativeRoot = join(root, 'native', 'fasttune');
const outputDir = join(root, 'public', 'fasttune');
mkdirSync(outputDir, { recursive: true });

function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : entry.name.endsWith('.c') ? [path] : [];
  });
}

const localEmcc = join(root, '.workbuddy', 'reference', 'emsdk-main', 'upstream', 'emscripten', 'emcc.py');
const useLocal = existsSync(localEmcc);
const command = useLocal ? process.env.PYTHON || 'python' : process.env.EMCC || 'emcc';
const args = [
  ...(useLocal ? [localEmcc] : []),
  '-O3', '-std=c99', '-DM_PI=3.14159265358979323846',
  `-I${join(nativeRoot, 'pitch')}`,
  ...sources(join(nativeRoot, 'pitch')),
  join(nativeRoot, 'fasttune_bridge.c'),
  '-o', join(outputDir, 'fasttune.js'),
  '-sMODULARIZE=1',
  '-sEXPORT_ES6=1',
  '-sENVIRONMENT=web,worker,node',
  '-sALLOW_MEMORY_GROWTH=1',
  '-sINITIAL_MEMORY=16777216',
  '-sFILESYSTEM=0',
  '-sEXPORTED_FUNCTIONS=_ft_init,_ft_detect,_ft_destroy,_malloc,_free',
  '-sEXPORTED_RUNTIME_METHODS=HEAPF32',
];

console.log('Building FastTune PEF WebAssembly engine...');
const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' && !useLocal });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
copyFileSync(join(nativeRoot, 'LICENSE.md'), join(outputDir, 'LICENSE.md'));
console.log('FastTune engine written to public/fasttune.');
