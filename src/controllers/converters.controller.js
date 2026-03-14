import puppeteer from '@cloudflare/puppeteer';

const PAGE_SIZES = {
  A4: { width: '210mm', height: '297mm' },
  Letter: { width: '8.5in', height: '11in' },
  Legal: { width: '8.5in', height: '14in' },
  A3: { width: '297mm', height: '420mm' },
  A5: { width: '148mm', height: '210mm' },
  Tabloid: { width: '11in', height: '17in' },
};

/* ===================== HTML TO PDF (PAGINATION & LANDSCAPE FIX) ===================== */
async function handlePdf(page, body) {
  const {
    pageSize = 'A4',
    orientation = 'portrait',
    margins = { top: 0, right: 0, bottom: 0, left: 0 },
    scale = 1,
    includeBackground = true,
    printMedia = false,
    fullPage = true,
  } = body;

  await page.emulateMediaType(printMedia ? 'print' : 'screen');

  // Apply CSS overrides to ensure content fits the width correctly
  await page.addStyleTag({
    content: `
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      html, body { background-color: transparent !important; margin: 0; padding: 0; }
    `
  });

  const pdfOptions = {
    scale,
    displayHeaderFooter: false,
    printBackground: includeBackground,
    landscape: orientation === 'landscape', // CRITICAL FIX: Explicitly apply landscape
    margin: {
      top: `${margins.top}mm`,
      right: `${margins.right}mm`,
      bottom: `${margins.bottom}mm`,
      left: `${margins.left}mm`,
    },
  };

  if (fullPage) {
    // --- SINGLE LONG PAGE MODE ---
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    pdfOptions.height = `${height}px`;
    pdfOptions.width = PAGE_SIZES[pageSize].width;
  } else {
    // --- STANDARD MULTI-PAGE (PAGINATED) MODE ---
    pdfOptions.format = pageSize;
  }

  return await page.pdf(pdfOptions);
}

/* ===================== HTML TO IMAGE (STABLE) ===================== */
async function handleImage(page, body) {
  const { format = 'png', fullPage = true } = body;


  return await page.screenshot({
    fullPage: fullPage,
    type: format === 'jpg' ? 'jpeg' : 'png',
    quality: format === 'jpg' ? 90 : undefined,
  });
}

/* ===================== MAIN ROUTER ===================== */
export async function runConversion(c, type) {
  const body = await c.req.json();
  const { url, viewportWidth = 1440 } = body;

  if (!url) return c.text("URL is required", 400);

  let browser;
  try {
    browser = await puppeteer.launch(c.env.MY_BROWSER_BINDING);
    const page = await browser.newPage();

    await page.setViewport({ width: parseInt(viewportWidth) || 1440, height: 1080 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });

    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 800;
        const maxScrolls = 50;
        let scrollCount = 0;

        const timer = setInterval(() => {
          const scrollHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
          );
          window.scrollBy(0, distance);
          totalHeight += distance;
          scrollCount++;
          if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
            clearInterval(timer);
            resolve();
          }
        }, 150);

        setTimeout(() => { clearInterval(timer); resolve(); }, 15000);
      });
      window.scrollTo(0, document.body.scrollHeight);
      setTimeout(() => window.scrollTo(0, 0), 600);
    });

    // Wait for Tailwind UI and fonts to settle
    try { await page.evaluate(async () => { await document.fonts.ready; }); } catch (e) { }
    await new Promise(r => setTimeout(r, 1500));

    const result = type === 'pdf' ? await handlePdf(page, body) : await handleImage(page, body);

    return new Response(result, {
      headers: {
        'Content-Type': type === 'pdf' ? 'application/pdf' : `image/${body.format === 'jpg' ? 'jpeg' : 'png'}`,
        'Content-Disposition': `attachment; filename="allypdf-conversion-${Date.now()}.${type === 'pdf' ? 'pdf' : 'png'}"`
      }
    });

  } catch (err) {
    return c.text(`Conversion Failed: ${err.message}`, 500);
  } finally {
    if (browser) await browser.close();
  }
}