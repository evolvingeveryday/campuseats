// capture-screenshots.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = require('./server');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempProfile = 'C:\\Users\\vivek\\AppData\\Local\\Temp\\chrome_temp_profile';
const screenshotsDir = path.join(__dirname, 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const beforeShot = path.join(screenshotsDir, 'before-post.png');
const afterShot = path.join(screenshotsDir, 'after-post.png');

function takeScreenshotAsync(url, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      `--user-data-dir=${tempProfile}`,
      `--screenshot=${outputPath}`,
      '--window-size=1280,850',
      '--hide-scrollbars',
      '--disable-gpu',
      url
    ];
    const child = spawn(chromePath, args, { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Chrome exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

const server = app.listen(3000, async () => {
  try {
    console.log('1. Capturing before-post screenshot of http://localhost:3000...');
    await new Promise(r => setTimeout(r, 1200));

    await takeScreenshotAsync('http://localhost:3000', beforeShot);
    console.log(`Saved: ${beforeShot} (${fs.statSync(beforeShot).size} bytes)`);

    console.log('2. Posting new item live via POST /items...');
    const postRes = await fetch('http://localhost:3000/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Special Thali (Dal Makhani & Naan)',
        price: 180,
        category: 'Meals',
        available: true
      })
    });
    const postData = await postRes.json();
    console.log(`Item successfully added [Status ${postRes.status}]:`, postData.name);

    await new Promise(r => setTimeout(r, 1200));

    console.log('3. Capturing after-post screenshot of http://localhost:3000...');
    await takeScreenshotAsync('http://localhost:3000', afterShot);
    console.log(`Saved: ${afterShot} (${fs.statSync(afterShot).size} bytes)`);

    console.log('\nSUCCESS: Both before-post.png and after-post.png generated successfully!');
  } catch (err) {
    console.error('Error in capture-screenshots:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
