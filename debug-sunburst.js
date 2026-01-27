const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }
  });
  const page = await context.newPage();

  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Get ALL computed styles for sunburst
  const debug = await page.evaluate(() => {
    const sunburst = document.querySelector('.sunburst-hero');
    const svg = document.querySelector('.sunburst-hero svg');

    if (!sunburst) return { error: 'No .sunburst-hero element found' };

    const sunburstStyle = window.getComputedStyle(sunburst);
    const svgStyle = svg ? window.getComputedStyle(svg) : null;

    return {
      sunburst: {
        display: sunburstStyle.display,
        visibility: sunburstStyle.visibility,
        opacity: sunburstStyle.opacity,
        width: sunburstStyle.width,
        height: sunburstStyle.height,
        position: sunburstStyle.position,
        top: sunburstStyle.top,
        left: sunburstStyle.left,
        transform: sunburstStyle.transform,
        zIndex: sunburstStyle.zIndex,
        pointerEvents: sunburstStyle.pointerEvents
      },
      svg: svgStyle ? {
        display: svgStyle.display,
        visibility: svgStyle.visibility,
        opacity: svgStyle.opacity,
        width: svgStyle.width,
        height: svgStyle.height,
        animation: svgStyle.animation,
        animationName: svgStyle.animationName,
        animationDuration: svgStyle.animationDuration,
        animationPlayState: svgStyle.animationPlayState
      } : null,
      html: sunburst.outerHTML.substring(0, 500)
    };
  });

  console.log('SUNBURST DEBUG:');
  console.log(JSON.stringify(debug, null, 2));

  await page.screenshot({ path: '/tmp/debug-mobile.png' });
  console.log('\nScreenshot saved to /tmp/debug-mobile.png');

  await browser.close();
})();
