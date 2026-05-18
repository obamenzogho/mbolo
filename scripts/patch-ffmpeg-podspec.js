const fs = require('fs');
const path = require('path');

const podspecPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'ffmpeg-kit-react-native',
  'ffmpeg-kit-react-native.podspec',
);

if (!fs.existsSync(podspecPath)) {
  console.log('[patch-ffmpeg-podspec] podspec not found, skipping');
  process.exit(0);
}

let content = fs.readFileSync(podspecPath, 'utf-8');
const patched = content.replace(
  "s.default_subspec   = 'https'",
  "s.default_subspec   = 'full-gpl'",
);

if (patched !== content) {
  fs.writeFileSync(podspecPath, patched, 'utf-8');
  console.log('[patch-ffmpeg-podspec] Patched default_subspec to full-gpl');
} else {
  console.log('[patch-ffmpeg-podspec] Already patched');
}
