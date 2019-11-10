import * as functions from 'firebase-functions';
import * as puppeteer from 'puppeteer';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript

export const helloWorld = functions.https.onRequest(async (request, response) => {
  const result = await getRingFitSaleStatus();
  response.json({ result });
});

export const helloPubSub = functions.pubsub.topic('ring-fit-adventure').onPublish(async message => {
  const result = await getRingFitSaleStatus();
  return result;
});

const getRingFitSaleStatus = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  const url = 'https://store.nintendo.co.jp/item/HAC_Q_AL3PA.html';
  await page.goto(url);

  const content = await page.$eval('.item-cart-add-area__add-button', item => item.textContent);

  console.log('content', content);

  await browser.close();

  return content;
};
