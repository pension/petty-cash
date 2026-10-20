// Copies @pension/ui-kit's pre-built stylesheet into public/ui-kit.css.
// Walks require.resolve.paths() rather than require.resolve()-ing a subpath,
// since @pension/ui-kit's "exports" map doesn't expose "./package.json" or
// "./dist/build.css" directly. This keeps working whether yarn hoists the
// package to the monorepo root node_modules or not.
const fs = require('fs');
const path = require('path');

function findUiKitDir() {
  const searchPaths = require.resolve.paths('@pension/ui-kit') || [];
  for (const dir of searchPaths) {
    const candidate = path.join(dir, '@pension', 'ui-kit');
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Could not locate @pension/ui-kit in any node_modules directory');
}

const srcCss = path.join(findUiKitDir(), 'dist', 'build.css');
const destDir = path.join(__dirname, '..', 'public');
const destCss = path.join(destDir, 'ui-kit.css');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(srcCss, destCss);
console.log(`Copied ${srcCss} -> ${destCss}`);
