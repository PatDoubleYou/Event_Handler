const crypto = require('crypto');
const tmi = require('tmi.js');
const express = require('express');
const { init } = require('express/lib/application');
const app = express();
require('dotenv').config();

const port = process.env.PORT;

let CLIENT_SECRET = process.env.CLIENT_SECRET;
let BOTDOUBLEYOU_OAUTH = process.env.BOTDOUBLEYOU_OAUTH;

// Notification request headers
const TWITCH_MESSAGE_ID = 'Twitch-Eventsub-Message-Id'.toLowerCase();
const TWITCH_MESSAGE_TIMESTAMP = 'Twitch-Eventsub-Message-Timestamp'.toLowerCase();
const TWITCH_MESSAGE_SIGNATURE = 'Twitch-Eventsub-Message-Signature'.toLowerCase();
const MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type'.toLowerCase();

// Notification message types
const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification';
const MESSAGE_TYPE_NOTIFICATION = 'notification';
const MESSAGE_TYPE_REVOCATION = 'revocation';

// Prepend this string to the HMAC that's created from the message
const HMAC_PREFIX = 'sha256=';

// Define configuration options
const opts = {
    identity: {
        username: 'BotDoubleYou',
        password: BOTDOUBLEYOU_OAUTH
    },
    channels: [
        'PatDoubleYou',
    ]
};

// Create a client with our options
const twitch_client = new tmi.client(opts);
const target = '#patdoubleyou';

twitch_client.on('connected', onConnectedHandler);

// Called every time the bot connects to Twitch chat.
function onConnectedHandler(addr, port) {
    console.log(`* Event handler tmi client is connected to ${addr}:${port}`);
}

// Connect to Twitch: 
twitch_client.connect();

app.use(express.raw({           // Need raw message body for signature verification
    type: 'application/json'
}))


app.post('/eventsub', (req, res) => {
    let secret = getSecret();
    let message = getHmacMessage(req);
    let hmac = HMAC_PREFIX + getHmac(secret, message);  // Signature to compare

    if (true === verifyMessage(hmac, req.headers[TWITCH_MESSAGE_SIGNATURE])) {


        console.log("signatures match");

        // Get JSON object from body, so you can process the message.
        let notification = JSON.parse(req.body);

        if (MESSAGE_TYPE_NOTIFICATION === req.headers[MESSAGE_TYPE]) {
            // TODO: Do something with the event's data.

            switch (notification.subscription.type) {
                case ('stream.online'):
                    eventStreamOnline(notification);
                    break;
                case ('stream.offline'):
                    eventStreamOffline(notification);
                    break;
                case ('channel.follow'):
                    eventFollow(notification);
                    break;
                case ('channel.raid'):
                    eventRaid(notification);
                    break;
                case ('channel.cheer'):
                    eventCheer(notification);
                    break;
                case ('channel.hype_train.begin'):
                    eventHypeTrain(notification);
                    break;
                case ('channel.subscribe'):
                    eventSubscribe(notification);
                    break;
                case ('channel.subscription.gift'):
                    eventSubscriptionGift(notification);
                    break;
                default:
                    console.log(`notification received: ${notification.subscription.type}, but not processed.`);
                    break;

            }

            console.log(`Event type: ${notification.subscription.type}`);
            console.log(JSON.stringify(notification.event, null, 4));

            res.sendStatus(204);
        }
        else if (MESSAGE_TYPE_VERIFICATION === req.headers[MESSAGE_TYPE]) {
            res.status(200).send(notification.challenge);
        }
        else if (MESSAGE_TYPE_REVOCATION === req.headers[MESSAGE_TYPE]) {
            res.sendStatus(204);

            console.log(`${notification.subscription.type} notifications revoked!`);
            console.log(`reason: ${notification.subscription.status}`);
            console.log(`condition: ${JSON.stringify(notification.subscription.condition, null, 4)}`);
        }
        else {
            res.sendStatus(204);
            console.log(`Unknown message type: ${req.headers[MESSAGE_TYPE]}`);
        }
    }
    else {
        console.log('403');    // Signatures didn't match.
        res.sendStatus(403);
    }
})

app.listen(port, () => {
    console.log(`Event handler listening at http://localhost:${port}`);
})

function getSecret() {
    // TODO: Get secret from secure storage. This is the secret you pass 
    // when you subscribed to the event.
    return CLIENT_SECRET;
}

// Build the message used to get the HMAC.
function getHmacMessage(request) {
    return (request.headers[TWITCH_MESSAGE_ID] +
        request.headers[TWITCH_MESSAGE_TIMESTAMP] +
        request.body);
}

// Get the HMAC.
function getHmac(secret, message) {
    return crypto.createHmac('sha256', secret)
        .update(message)
        .digest('hex');
}

// Verify whether our hash matches the hash that Twitch passed in the header.
function verifyMessage(hmac, verifySignature) {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(verifySignature));
}

// Handle various notification types.
// Test prod using: 
// twitch event trigger channel.follow -F https://pats-twitch-chatbot.herokuapp.com/eventsub/ -s {client_secret}
// Test debug using:
// twitch event trigger channel.follow -F http://localhost:80/eventsub/ -s {client_secret}

function eventStreamOnline(notification) {
    twitch_client.say(target, `We're starting a stream! Woo! ${notification.event.broadcaster_user_name}!`);
}

function eventStreamOffline(notification) {
    twitch_client.say(target, `What a great stream! Now turn off OBS, ${notification.event.broadcaster_user_name}! LUL`);
}

function eventFollow(notification) {
    twitch_client.say(target, `We've got a follow from ${notification.event.user_name}!`);
}

function eventRaid(notification) {
    twitch_client.say(target, `We're getting a raid! ${notification.event.from_broadcaster_user_name} is joining us with ${notification.event.viewers} viewers! Check them out at https://www.twitch.tv/${notification.event.from_broadcaster_user_name} and drop a follow!`);
}

function eventCheer(notification) {
    twitch_client.say(target, `Cheering! Woo! ${notification.event.bits} bits from ${notification.event.user_name}!`);
}

function eventSubscribe(notification) {
    if (notification.event.is_gift) {
        twitch_client.say(target, `${notification.event.user_name} has just been gifted a subscription!`);
    } else {
        twitch_client.say(target, `${notification.event.user_name} has just subscribed to the channel!`);
    }
}

function eventSubscriptionGift(notification) {
    if (notification.event.total == 1) {
        twitch_client.say(target, `${notification.event.user_name} has just gifted a subscription to the channel!`);
    } else {
        twitch_client.say(target, `${notification.event.user_name} has just gifted ${notification.event.total} subs to the channel!`);
    }
}

function eventHypeTrain(notification) {
    twitch_client.say(target, `PogChamp HYPE TRAIN! PogChamp`);
}

module.exports = {};