import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as puppeteer from 'puppeteer';
import * as line from '@line/bot-sdk';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript

admin.initializeApp();
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const targetUserId = functions.config().line.user_id;
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
    await client.pushMessage(targetUserId, { type: 'text', text: 'クロール中...' });
    const result = await checkRingFitStatus();
    replyText = result.resultText;
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
    const result = await checkRingFitStatus();
    response.json({ result });
  });

export const helloPubSub = functions
  .runWith({ memory: '1GB' })
  .region('asia-northeast1')
  .pubsub.topic('ring-fit-adventure')
  .onPublish(async message => {
    const result = await checkRingFitStatus();
    if (result.difference) {
      await client.pushMessage(targetUserId, { type: 'text', text: result.resultText });
    }
    return result;
  });

const checkRingFitStatus = async () => {
  const ringFitCrawlType = 'ring-fit-adventure';
  const resultText = await getRingFitSaleStatus();
  const difference = await updateCrawlResult(ringFitCrawlType, resultText);
  return { difference, resultText };
};

const getRingFitSaleStatus = async () => {
  let content = '';
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    const url = 'https://store.nintendo.co.jp/item/HAC_Q_AL3PA.html';
    await page.goto(url);

    content = (await page.$eval('.item-cart-add-area__add-button', item => item.textContent)) || '取得できませんでした';

    await browser.close();
  } catch (error) {
    content = JSON.stringify(error);
  }
  console.log('content', content);
  return content;
};

const updateCrawlResult = async (crawlType: string, newResultText: string) => {
  const crawlCollection = db.collection('crawl');
  const snapshot = await crawlCollection
    .where('crawlType', '==', crawlType)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const result = snapshot.docs[0].data();
    const { resultText } = result;

    if (newResultText === resultText) {
      return false;
    }
  }

  const crawlData = {
    crawlType,
    resultText: newResultText,
    updated_at: FieldValue.serverTimestamp(),
  };

  crawlCollection
    .doc()
    .set(crawlData, { merge: true })
    .catch(err => {
      throw new functions.https.HttpsError('internal', 'Failed to set crawl data', err);
    });

  return true;
};
