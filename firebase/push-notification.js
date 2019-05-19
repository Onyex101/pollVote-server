var admin = require("firebase-admin");

var serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://pollvote-f81c0.firebaseio.com"
});

const sendNote = (payload) => {
    var token = [];
    var db = admin.firestore();
    db.collection('devices').get().then((snapshot) => {
        snapshot.forEach((doc) => {
            var tk = doc.data();
            token.push(tk.token);
            console.log('new array', token);
        });
        var options = {
            priority: "high",
            timeToLive: 60 * 60 * 24
        };
        admin.messaging().sendToDevice(token, payload, options)
            .then(function (response) {
                console.log("Successfully sent message:", response);
            })
            .catch(function (error) {
                console.log("Error sending message:", error);
            });
    }).catch((err) => console.log('error getting docs: ', err));
}

module.exports = sendNote;