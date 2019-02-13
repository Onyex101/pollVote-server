const { Poll } = require('./../models/poll');
const { Archive } = require('./../models/archive');

var Timer = (period, pollID, duration) => {
    var x = setInterval(() => {
        console.log('timeLeft', period);
        Poll.findOneAndUpdate({_id: pollID}, {
            $set: {
                duration: period
            }
        }).then(() => {
            console.log('duration updated');
        }).catch((err) => {
            console.log(err);
        });
        period--;
        if (period <= 1) {
            Poll.findByIdAndRemove(pollID).then((poll) => {
                var body = {
                    _userID: poll._userID,
                    code: poll.code,
                    question: poll.question,
                    options: poll.options,
                    startDate: duration.startDate,
                    endDate: duration.endDate
                };
                console.log('archive body', body);
                var newArchive = new Archive(body);
                newArchive.save().then(() => {
                    console.log('archive successfully saved');
                }).catch((e) => {
                    console.log('archive error', e);
                });
            });
            clearInterval(x);
        };
    }, 1000);
};

module.exports = { Timer };












