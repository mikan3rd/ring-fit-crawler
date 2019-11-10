import * as functions from 'firebase-functions';
import puppeteer from 'puppeteer';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//

export const helloWorld = functions.https.onRequest((request, response) => {
  response.send('Hello from Firebase!');
});

export const helloPubSub = functions.pubsub.topic('ring-fit-adventure').onPublish(message => {
  console.log(message);
});
