import * as functions from 'firebase-functions';
import * as line from '@line/bot-sdk';

import { config, handleLineEvent, handleRingFitPubsubEvent } from './ringFitFunctions';

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
    await handleRingFitPubsubEvent();
  });
