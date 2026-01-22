#!/usr/bin/env node
/**
 * Generate OG image from SVG source
 *
 * Usage: npm run generate-og
 * Requires: npm install sharp --save-dev
 */

const fs = require('fs');
const path = require('path');

async function generateOgImage() {
    let sharp;
    try {
        sharp = require('sharp');
    } catch (e) {
        console.error('Sharp is not installed. Run: npm install sharp --save-dev');
        process.exit(1);
    }

    const svgPath = path.join(__dirname, '../src/assets/og-image.svg');
    const outputPath = path.join(__dirname, '../src/assets/og-image.png');

    if (!fs.existsSync(svgPath)) {
        console.error('SVG source not found at:', svgPath);
        process.exit(1);
    }

    console.log('Generating OG image...\n');

    try {
        await sharp(svgPath)
            .resize(1200, 630)
            .png({ quality: 90 })
            .toFile(outputPath);

        console.log('  ✓ og-image.png (1200x630)');
        console.log('\nOG image generation complete!');
        console.log('Image saved to:', outputPath);
    } catch (err) {
        console.error('  ✗ Failed to generate OG image:', err.message);
        process.exit(1);
    }
}

generateOgImage().catch(console.error);
