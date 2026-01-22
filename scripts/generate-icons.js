#!/usr/bin/env node
/**
 * Generate PWA icons from SVG source
 *
 * Usage: npm run generate-icons
 * Requires: npm install sharp --save-dev
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
    let sharp;
    try {
        sharp = require('sharp');
    } catch (e) {
        console.error('Sharp is not installed. Run: npm install sharp --save-dev');
        process.exit(1);
    }

    const svgPath = path.join(__dirname, '../src/assets/icons/icon.svg');
    const outputDir = path.join(__dirname, '../src/assets/icons');

    if (!fs.existsSync(svgPath)) {
        console.error('SVG source not found at:', svgPath);
        process.exit(1);
    }

    const sizes = [16, 32, 72, 96, 128, 144, 152, 180, 192, 384, 512];

    console.log('Generating PWA icons...\n');

    for (const size of sizes) {
        const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

        try {
            await sharp(svgPath)
                .resize(size, size)
                .png()
                .toFile(outputPath);

            console.log(`  ✓ icon-${size}x${size}.png`);
        } catch (err) {
            console.error(`  ✗ Failed to generate ${size}x${size}:`, err.message);
        }
    }

    // Generate apple-touch-icon (180x180)
    const appleTouchPath = path.join(outputDir, 'apple-touch-icon.png');
    try {
        await sharp(svgPath)
            .resize(180, 180)
            .png()
            .toFile(appleTouchPath);
        console.log('  ✓ apple-touch-icon.png');
    } catch (err) {
        console.error('  ✗ Failed to generate apple-touch-icon:', err.message);
    }

    console.log('\nIcon generation complete!');
    console.log('Icons saved to:', outputDir);
}

generateIcons().catch(console.error);
