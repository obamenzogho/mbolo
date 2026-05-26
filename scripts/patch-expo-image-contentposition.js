const fs = require('fs');
const path = require('path');

const contentPositionPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-image',
  'ios',
  'ContentPosition.swift',
);
const imageSourcePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-image',
  'ios',
  'ImageSource.swift',
);
const imageLoadOptionsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-image',
  'ios',
  'ImageLoadOptions.swift',
);

function patchFile(filePath, replacements, marker) {
  if (!fs.existsSync(filePath)) {
    console.log(`[patch-expo-image-contentposition] ${path.basename(filePath)} not found, skipping`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  let patched = content;

  for (const [from, to] of replacements) {
    patched = patched.replace(from, to);
  }

  if (patched !== content) {
    fs.writeFileSync(filePath, patched, 'utf-8');
    console.log(`[patch-expo-image-contentposition] Patched ${path.basename(filePath)}`);
  } else if (patched.includes(marker)) {
    console.log(`[patch-expo-image-contentposition] ${path.basename(filePath)} already patched`);
  } else {
    console.log(`[patch-expo-image-contentposition] Expected source line not found in ${path.basename(filePath)}, skipping`);
  }
}

patchFile(
  contentPositionPath,
  [['  static let center = Self()', '  static var center: Self { Self() }']],
  '  static var center: Self { Self() }',
);

patchFile(
  imageSourcePath,
  [['struct ImageSource: Record {', 'struct ImageSource: Record, @unchecked Sendable {']],
  'struct ImageSource: Record, @unchecked Sendable {',
);

patchFile(
  imageLoadOptionsPath,
  [['internal struct ImageLoadOptions: Record {', 'internal struct ImageLoadOptions: Record, @unchecked Sendable {']],
  'internal struct ImageLoadOptions: Record, @unchecked Sendable {',
);
