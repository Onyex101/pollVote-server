var fcm = require('fcm-notification');
var FCM = new fcm('./pollvote-f81c0-firebase-adminsdk-mhg6d-e5608925ed.json');
var Tokens = ['token1 here', '....', 'token n here'];

var message = {
    data: {
        score: '850',
        time: '2:45'
    },
    notification: {
        title: 'Navish',
        body: 'Test message by navish'
    }
};
FCM.sendToMultipleToken(message, Tokens, function (err, response) {
    if (err) {
        console.log('err--', err);
    } else {
        console.log('response-----', response);
    }
});