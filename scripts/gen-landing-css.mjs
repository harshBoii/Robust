import fs from 'fs';

const html = fs.readFileSync('/Users/mac/Desktop/robust (1) (1).html', 'utf8');
const m = html.match(/<style>([\s\S]*?)<\/style>/);
if (!m) throw new Error('no style block');

let css = m[1];
css = css.replace(/\/\* reveal \*\/[\s\S]*?\/\* MODAL \*\//, '');
css = css.replace(/\/\* MODAL \*\/[\s\S]*?(?=@media)/, '');
css = css.replace(/:root\{/, '.landing{');
css = css.replace(/html\{[^}]+\}/, '');
css = css.replace(/body\{([^}]+)\}/, '.landing{$1}');

const lines = css.split('\n');
const out = [];
let inMedia = false;

for (const line of lines) {
  if (line.trim().startsWith('@media')) {
    inMedia = true;
    out.push(line);
    continue;
  }
  if (inMedia) {
    if (line.trim() === '}') {
      inMedia = false;
      out.push(line);
      continue;
    }
    const t = line.trim();
    if (t && !t.startsWith('/*') && t.includes('{') && !t.startsWith('.landing')) {
      out.push(line.replace(/^(\s*)([^{]+)(\{)/, (_, sp, sel, br) => `${sp}.landing ${sel.trim()} ${br}`));
    } else {
      out.push(line);
    }
    continue;
  }
  const t = line.trim();
  if (!t || t.startsWith('/*') || t.startsWith('.landing') || t.startsWith('*')) {
    out.push(line);
    continue;
  }
  if (t.includes('{')) {
    out.push(`.landing ${line}`);
  } else {
    out.push(line);
  }
}

fs.mkdirSync('app/components/landing', { recursive: true });
fs.writeFileSync('app/components/landing/landing.css', out.join('\n'));
console.log('wrote landing.css', out.length, 'lines');
