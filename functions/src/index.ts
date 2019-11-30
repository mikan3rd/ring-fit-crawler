import * as functions from 'firebase-functions';
import * as line from '@line/bot-sdk';

import { handleLineEvent, config, checkQuickReply, targetUserId, client, checkRingFitStatus } from './ringFitFunctions';

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

export const checkRingFitPubSub = functions
  .runWith({ memory: '1GB' })
  .region('asia-northeast1')
  .pubsub.topic('ring-fit-adventure')
  .onPublish(async message => {
    const result = await checkRingFitStatus();
    if (result.difference) {
      await client.pushMessage(targetUserId, { type: 'text', text: result.resultText, quickReply: checkQuickReply });
    }
    return result;
  });
