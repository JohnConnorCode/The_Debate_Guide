/**
 * 11ty Configuration for The Debate Guide
 */

const CleanCSS = require('clean-css');
const { minify } = require('terser');
const fs = require('fs');
const path = require('path');

module.exports = function(eleventyConfig) {
  // Pass through static assets (will be minified in production)
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/manifest.json");
  eleventyConfig.addPassthroughCopy("src/service-worker.js");
  eleventyConfig.addPassthroughCopy("src/favicon.ico");

  // Copy quiz data files to /quizzes/ directory
  eleventyConfig.addPassthroughCopy({ "src/_data/quizzes": "quizzes" });

  // Watch CSS and JS for changes during development
  eleventyConfig.addWatchTarget("src/css/");
  eleventyConfig.addWatchTarget("src/js/");

  // Add layout aliases for cleaner front matter
  eleventyConfig.addLayoutAlias('base', 'base.njk');
  eleventyConfig.addLayoutAlias('chapter', 'chapter.njk');
  eleventyConfig.addLayoutAlias('home', 'home.njk');

  // Add a filter for formatting chapter numbers
  eleventyConfig.addFilter("padZero", function(num) {
    return String(num).padStart(2, '0');
  });

  // Add a filter for generating relative paths based on depth
  eleventyConfig.addFilter("relativePath", function(depth) {
    if (depth === 0) return "";
    return "../".repeat(depth);
  });

  // Add a shortcode for vocabulary boxes
  eleventyConfig.addShortcode("vocab", function(term, pronunciation, definition) {
    return `<div class="vocabulary-box">
    <span class="vocab-term">${term}</span>
    <span class="vocab-pronunciation">${pronunciation}</span>
    <p class="vocab-definition">${definition}</p>
</div>`;
  });

  // Add a shortcode for featured quotes
  eleventyConfig.addShortcode("quote", function(text, cite) {
    return `<div class="featured-quote">
    <blockquote>${text}</blockquote>
    <cite>${cite}</cite>
</div>`;
  });

  // Collection for all chapters in order
  eleventyConfig.addCollection("chapters", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/chapters/**/*.njk")
      .sort((a, b) => {
        return (a.data.chapterNumber || 0) - (b.data.chapterNumber || 0);
      });
  });

  // Minify CSS and JS in production builds
  eleventyConfig.on('eleventy.after', async ({ dir }) => {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;

    if (!isProduction) {
      console.log('[Build] Skipping minification (development mode)');
      return;
    }

    console.log('[Build] Minifying CSS and JS files...');

    // Minify CSS files
    const cssDir = path.join(dir.output, 'css');
    if (fs.existsSync(cssDir)) {
      const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
      // Don't process @import statements, just minify the CSS content
      const cleanCss = new CleanCSS({
        level: 2,
        inline: false  // Don't inline @import statements
      });

      for (const file of cssFiles) {
        const filePath = path.join(cssDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const minified = cleanCss.minify(content);

        if (minified.errors.length === 0) {
          fs.writeFileSync(filePath, minified.styles);
          const savings = ((1 - minified.styles.length / content.length) * 100).toFixed(1);
          console.log(`  CSS: ${file} (${savings}% reduction)`);
        } else {
          console.warn(`  CSS: ${file} - minification failed:`, minified.errors);
        }
      }
    }

    // Minify JS files
    const jsDir = path.join(dir.output, 'js');
    if (fs.existsSync(jsDir)) {
      const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

      for (const file of jsFiles) {
        const filePath = path.join(jsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        try {
          const minified = await minify(content, {
            compress: true,
            mangle: true
          });

          if (minified.code) {
            fs.writeFileSync(filePath, minified.code);
            const savings = ((1 - minified.code.length / content.length) * 100).toFixed(1);
            console.log(`  JS: ${file} (${savings}% reduction)`);
          }
        } catch (e) {
          console.warn(`  JS: ${file} - minification failed:`, e.message);
        }
      }
    }

    // Inject build timestamp and minify service worker
    const swPath = path.join(dir.output, 'service-worker.js');
    if (fs.existsSync(swPath)) {
      let content = fs.readFileSync(swPath, 'utf8');

      // Inject build timestamp for cache versioning
      const buildTimestamp = Date.now().toString(36);
      content = content.replace('%%BUILD_TIMESTAMP%%', buildTimestamp);
      console.log(`  SW: Injected build timestamp ${buildTimestamp}`);

      try {
        const minified = await minify(content, { compress: true, mangle: true });
        if (minified.code) {
          fs.writeFileSync(swPath, minified.code);
          const savings = ((1 - minified.code.length / content.length) * 100).toFixed(1);
          console.log(`  JS: service-worker.js (${savings}% reduction)`);
        }
      } catch (e) {
        // Even if minification fails, write the timestamped version
        fs.writeFileSync(swPath, content);
        console.warn(`  JS: service-worker.js - minification failed:`, e.message);
      }
    }

    console.log('[Build] Minification complete');
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data"
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
