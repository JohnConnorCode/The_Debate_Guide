/**
 * 11ty Configuration for The Debate Guide
 */

module.exports = function(eleventyConfig) {
  // Pass through static assets
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

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
