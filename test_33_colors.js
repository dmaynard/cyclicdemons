import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 2000));
  
  // Set to 33 colors
  await page.evaluate(() => {
    const slider = document.querySelector('input[type="range"]');
    slider.value = 33;
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Click Play
  await page.evaluate(() => {
    const playBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('▶'));
    if (playBtn) playBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
})();
