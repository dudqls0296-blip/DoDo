// 서버 없이 더블클릭으로 열 수 있는 단일 HTML 미리보기를 만든다.
// 결과: preview/index.html (JS·CSS 인라인, 폰트만 외부 CDN)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const out = await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020', 'chrome100', 'safari15'],
  jsx: 'automatic',
  write: false,
  outdir: 'preview',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'css' },
  legalComments: 'none',
});
const js = out.outputFiles.find((f) => f.path.endsWith('.js')).text;
const css = out.outputFiles.find((f) => f.path.endsWith('.css')).text;
let html = readFileSync('index.html', 'utf8')
  .replace(/<!--DEV-ONLY-->[\s\S]*?<!--\/DEV-ONLY-->/, '')
  .replace('<!--INLINE_STYLE-->', `<style>${css}</style>`)
  .replace('<script type="module" src="/src/main.tsx"></script>', () => `<script>${js.replace(/<\/script/g, '<\\/script')}</script>`);
mkdirSync('preview', { recursive: true });
writeFileSync('preview/index.html', html);
console.log('preview/index.html', (html.length / 1024).toFixed(0) + ' KB');
