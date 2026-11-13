// Builds dist/meridian-demo.html: the whole app in one file (for sharing as a page).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const dir = 'dist/assets';
const files = readdirSync(dir);
const css = readFileSync(`${dir}/${files.find((f) => f.endsWith('.css'))}`, 'utf8');
const js = readFileSync(`${dir}/${files.find((f) => f.endsWith('.js'))}`, 'utf8').replace(/<\/script/g, '<\\/script');
const html = `<title>Meridian Sales</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
writeFileSync('dist/meridian-demo.html', html);
console.log('dist/meridian-demo.html', (html.length / 1024).toFixed(0), 'KB');
