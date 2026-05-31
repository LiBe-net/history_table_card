import { readFile, writeFile } from 'node:fs/promises';
import { minify } from 'terser';

const sourcePath = new URL('./history-table-card.js', import.meta.url);
const targetPath = new URL('./history-table-card.min.js', import.meta.url);

const source = await readFile(sourcePath, 'utf8');
const result = await minify(source, {
  compress: true,
  mangle: true,
  output: {
    comments: /^!|@preserve|@license/i,
  },
});

if (result.error) {
  throw result.error;
}

await writeFile(targetPath, `${result.code}\n`, 'utf8');