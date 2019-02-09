const { Poll } = require('./../models/poll');
const { Archive } = require('./../models/archive');

var count = (date, id) => {
    var countDownDate = new Date(date).getTime();
    // Update the count down every 1 second
    var x = setInterval(function () {

        // Get todays date and time
        var now = new Date().getTime();

        // Find the distance between now and the count down date
        var distance = countDownDate - now;

        var saveDB = setInterval((id) => {
            Poll.findByIdAndUpdate(id, {
                $set: {
                    duration: distance
                }
            })
        }, 2000);
        // If the count down is over, write some text 
        if (distance <= 2) {
            clearInterval(saveDB);
            Poll.findByIdAndRemove(id).then((poll) => {
                var newArchive = new Archive(poll);
                newArchive.save().then(() => {
                    console.log('archive successfully saved');
                }).catch((e) => {
                    console.log('archive error', e);
                });
            });
            clearInterval(x);
        }
    }, 1000);
};

module.exports = count;