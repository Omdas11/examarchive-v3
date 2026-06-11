const fs = require('fs');
const path = require('path');

const source = path.join(process.cwd(), 'node_modules', '@fontsource', 'inter', 'files', 'inter-latin-700-normal.woff');
const destDir = path.join(process.cwd(), 'public', 'fonts');
const dest = path.join(destDir, 'inter-latin-700-normal.woff');

if (fs.existsSync(source)) {
  try {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(source, dest);
    console.log('Successfully copied Inter font to public/fonts');
  } catch (err) {
    console.error('Failed to copy Inter font:', err.message);
    process.exitCode = 1;
  }
} else {
  console.warn('Font source not found in node_modules. Skipping copy.');
}
