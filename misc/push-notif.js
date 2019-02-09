var admin = require('firebase-admin');
var serviceAccount = require('./pollx-abac2-firebase-adminsdk-kwxpb-b2c696b16c.json');

var notifications = () => {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://pollx-abac2.firebaseio.com"
    });

    var registrationToken = "<registration token goes here>";

    var payload = {
        notification: {
            title: "Account Deposit",
            body: "A deposit to your savings account has just cleared."
        }
    };
    var options = {
        priority: "high",
        timeToLive: 60 * 60 * 24
    };

    admin.messaging().sendToDevice(registrationToken, payload, options).then((message) => {
        console.log('successfully sent message', message);
    }).catch((e) => {
        console.log('error', e);
    });
};

module.exports = { notifications };