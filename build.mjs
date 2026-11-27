import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {build} from 'esbuild';

await mkdir('dist', {recursive: true});
const css = execFileSync(process.execPath, [
  'node_modules/tailwindcss/lib/cli.js', '-i', './src/styles.css', '--minify',
], {encoding: 'utf8'});
const {outputFiles: [app]} = await build({
  entryPoints: ['src/app.js'], bundle: true, format: 'iife', platform: 'browser',
  target: ['chrome109', 'firefox115', 'safari16.4'], loader: {'.html': 'text'},
  write: false, minify: true, legalComments: 'inline',
});
const template = await readFile('src/index.html', 'utf8');
const charts = await readFile('node_modules/echarts/dist/echarts.min.js', 'utf8');
const art = await readFile('src/assets/tommy-garage-wedding.webp');
const noticeFiles = [
  'LICENSE',
  'node_modules/@zip.js/zip.js/LICENSE', 'node_modules/papaparse/LICENSE',
  'node_modules/echarts/LICENSE', 'node_modules/echarts/NOTICE', 'node_modules/tailwindcss/LICENSE',
];
const notices = await Promise.all(noticeFiles.map(async path => `${path}\n${await readFile(path, 'utf8')}`));
const script = value => `<script>${value.replace(/<\/script/gi, '<\\/script')}</script>`;
const output = template
  .replace('</body>', () => `<!-- Licenses\n${notices.join('\n\n').replaceAll('--', '—')}\n-->\n</body>`)
  .replace('<!-- INLINE_CSS -->', () => `<style>${css}</style>`)
  .replace('__GARAGE_ART__', () => `data:image/webp;base64,${art.toString('base64')}`)
  .replace('<!-- INLINE_CHARTS -->', () => script(charts))
  .replace('<!-- INLINE_APP -->', () => script(app.text));
await writeFile('dist/index.html', output);
console.log(`Built dist/index.html (${Buffer.byteLength(output).toLocaleString('en')} bytes)`);
