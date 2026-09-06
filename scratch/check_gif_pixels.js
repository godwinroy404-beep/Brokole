import fs from 'fs';

function getGifDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  return { width, height };
}

console.log('cooking.gif dimensions:', getGifDimensions('public/images/cooking.gif'));
console.log('past.gif dimensions:', getGifDimensions('public/images/past.gif'));
console.log('scooter.gif dimensions:', getGifDimensions('public/images/scooter.gif'));
