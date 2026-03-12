const puppeteer = require('puppeteer');

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER_ERROR:', err));

  console.log("Logging in...");
  await page.goto('http://localhost:4200/login');
  await page.type('input[type="text"]', 'admin');
  await page.type('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  await page.waitForNavigation();
  console.log("Logged in, going to items...");
  
  await page.goto('http://localhost:4200/inventory/items');
  
  console.log("Waiting for row...");
  await page.waitForSelector('tbody tr', { timeout: 10000 });
  
  console.log("Clicking row...");
  await page.click('tbody tr:first-child');
  
  console.log("Waiting for offcanvas or network...");
  await new Promise(r => setTimeout(r, 4000));
  
  await browser.close();
  console.log("Done.");
})();
