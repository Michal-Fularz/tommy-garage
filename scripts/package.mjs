import {randomUUID} from 'node:crypto';
import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {BlobWriter, Uint8ArrayReader, ZipWriter} from '@zip.js/zip.js';

const {version} = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../dist/index.html', import.meta.url));
const archive = new ZipWriter(new BlobWriter(), {useWebWorkers: false});
await archive.add('Tommy-Garage.html', new Uint8ArrayReader(html), {level: 9});
const bytes = await (await archive.close()).arrayBuffer();

const directory = new URL('../artifacts/', import.meta.url);
const filename = `Tommy-Garage-v${version}.zip`;
const destination = new URL(filename, directory);
const temporary = new URL(`${filename}.${randomUUID()}.tmp`, directory);
await mkdir(directory, {recursive: true});
try {
  await writeFile(temporary, new Uint8Array(bytes), {flag: 'wx'});
  await rename(temporary, destination);
} finally {
  await rm(temporary, {force: true});
}
console.log(`Packaged artifacts/${filename}`);
