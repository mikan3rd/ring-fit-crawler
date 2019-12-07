import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as puppeteer from 'puppeteer';
import * as line from '@line/bot-sdk';
import axios from 'axios';

admin.initializeApp();
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const LINE_ENV = functions.config().line;
const SLACK_ENV = functions.config().slack;

export const targetUserId = LINE_ENV.user_id;
export const config = {
  channelAccessToken: LINE_ENV.channel_access_token,
  channelSecret: LINE_ENV.channel_secret,
} as line.Config;

export const client = new line.Client(config as line.ClientConfig);

export const checkQuickReply = {
  items: [
    {
      type: 'action',
      action: {
        type: 'message',
        label: 'チェック',
        text: 'チェック',
      },
    },
  ],
} as line.QuickReply;

const RING_FIT_WEBHOOK = SLACK_ENV.ringfit_webhook;
const RING_FIT_URL = 'https://store.nintendo.co.jp/item/HAC_Q_AL3PA.html';

type JSObject = { [p: string]: any };

export const handleLineEvent = async (event: line.WebhookEvent) => {
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
    replyText = `${result.resultText}\n${RING_FIT_URL}`;
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: replyText,
    quickReply: checkQuickReply,
  });
};

export const handleRingFitPubsubEvent = async () => {
  const result = await checkRingFitStatus();
  if (result.difference) {
    const text = `${result.resultText}\n${RING_FIT_URL}`;
    await client.pushMessage(targetUserId, { type: 'text', text, quickReply: checkQuickReply });
    const data = { attachments: [{ text, color: '#f79600' }] };
    await postSlack(RING_FIT_WEBHOOK, data);
  }
  return result;
};

export const checkRingFitStatus = async () => {
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

    await page.goto(RING_FIT_URL);

    const item = await page.$('.item-cart-add-area__add-button');
    if (item) {
      const value = await (await item.getProperty('value')).jsonValue();
      if (value === 'カートに追加する') {
        content = '在庫あり';
      } else {
        const textContent = await (await item.getProperty('textContent')).jsonValue();
        content = value || textContent || '取得できませんでした';
      }
    }

    await browser.close();
  } catch (error) {
    content = JSON.stringify(error);
  }
  console.log('content', content);
  return content;
};

const updateCrawlResult = async (crawlType: string, newResultText: string) => {
  const crawlCollection = db.collection('crawl');
  const doc = await crawlCollection.doc(crawlType).get();

  if (doc.exists) {
    const result = doc.data();
    if (!result) {
      return false;
    }

    const { resultText } = result;
    if (newResultText === resultText) {
      return false;
    }
  }

  const crawlData = {
    resultText: newResultText,
    updated_at: FieldValue.serverTimestamp(),
  };

  crawlCollection
    .doc(crawlType)
    .set(crawlData, { merge: true })
    .catch(err => {
      throw new functions.https.HttpsError('internal', 'Failed to set crawl data', err);
    });

  return true;
};

const postSlack = async (url: string, data: JSObject) => {
  try {
    const response = await axios.post(url, data);
    console.log(response);
  } catch (error) {
    console.error(error);
  }
};
