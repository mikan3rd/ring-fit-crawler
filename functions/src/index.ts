import * as functions from 'firebase-functions';
import * as puppeteer from 'puppeteer';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//

export const helloPubSub = functions.pubsub.topic('ring-fit-adventure').onPublish(async message => {
  console.log('START');
  console.log(message);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  const url = 'https://store.nintendo.co.jp/item/HAC_Q_AL3PA.html';
  await page.goto(url);

  await page.$eval('.item-cart-add-area__add-button', item => {
    console.log('BUTTON');
    console.log(item.textContent);
  });

  await browser.close();
  console.log('FINISH');
});
