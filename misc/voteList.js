const { PollList } = require('./../models/pollList');

var voteList = (userDet, id) => {
    console.log('authorised list no:', userDet.authorised.length);
    if (userDet.authorised.length !== 0) {
        var auth = userDet.authorised;
        auth.forEach((element) => {
            PollList.findOneAndUpdate({
                _pollID: id
            }, {
                $push: {
                    notVoted: {
                        full_name: element.full_name,
                        user_name: element.user_name
                    }
                }
            }).then((poll) => {
                console.log('success');
            }).catch((er) => {
                console.log('40:', er);
            });
        });
    };
};

module.exports = { voteList };
