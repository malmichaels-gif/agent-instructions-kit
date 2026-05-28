// Postbuild step: normalize the ncc-generated bundle to LF line endings.
//
// ncc emits CRLF (and a lone-CR shebang separator) when run on Windows, but LF
// on Linux/macOS. The committed dist/ must byte-match a fresh build in CI
// (which runs on Linux), so a Windows-built bundle would otherwise never match.
// Forcing LF here makes `npm run build` produce identical output on every OS:
// it's a no-op on Linux/macOS and fixes the line endings on Windows.
import fs from 'fs';
import path from 'path';

const DIST = 'dist';

function normalize(dir) {
  let changed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      changed += normalize(p);
      continue;
    }
    const buf = fs.readFileSync(p);
    if (!buf.includes(13)) continue; // no CR byte — already LF
    const lf = buf.toString('latin1').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    fs.writeFileSync(p, Buffer.from(lf, 'latin1'));
    changed++;
    console.log('normalized to LF:', p);
  }
  return changed;
}

if (!fs.existsSync(DIST)) {
  console.error('normalize-dist: dist/ not found — run the build first');
  process.exit(1);
}
const n = normalize(DIST);
console.log(`normalize-dist: ${n} file(s) normalized to LF`);
