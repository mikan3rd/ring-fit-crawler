import * as functions from 'firebase-functions';
import * as puppeteer from 'puppeteer';
import * as line from '@line/bot-sdk';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript

const config = {
  channelAccessToken: functions.config().line.channel_access_token,
  channelSecret: functions.config().line.channel_secret,
} as line.Config;

const client = new line.Client(config as line.ClientConfig);

export const lineWebhook = functions
  .runWith({ memory: '1GB' })
  .region('asia-northeast1')
  .https.onRequest(async (request, response) => {
    const signature = request.get('x-line-signature');

    if (!signature || !line.validateSignature(request.rawBody, config.channelSecret as string, signature)) {
      throw new line.SignatureValidationFailed('signature validation failed', signature);
    }

    Promise.all(request.body.events.map(handleLineEvent))
      .then(result => response.json(result))
      .catch(error => console.error(error));
  });

const handleLineEvent = async (event: line.WebhookEvent) => {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const {
    message: { text },
  } = event;

  let replyText = text;
  if (text === 'チェック') {
    const result = await getRingFitSaleStatus();
    if (result) {
      replyText = result;
    } else {
      replyText = '取得できませんでした';
    }
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: replyText,
  });
};

export const helloWorld = functions
  .runWith({ memory: '1GB' })
  .region('asia-northeast1')
  .https.onRequest(async (request, response) => {
    const result = await getRingFitSaleStatus();
    response.json({ result });
  });

export const helloPubSub = functions
  .runWith({ memory: '1GB' })
  .region('asia-northeast1')
  .pubsub.topic('ring-fit-adventure')
  .onPublish(async message => {
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
