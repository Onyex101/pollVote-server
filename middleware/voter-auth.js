const {Voter} = require('./../models/voter');

var voteAuth = (req, res, next) => {
    var token = req.header('x-auth');
    Voter.findByToken(token).then((voter) => {
        if (!voter) {
            return Promise.reject();
        }
        req.voter = voter;
        req.token = token;
        next();
    }).catch((err) => {
        res.status(401).send();
    });
};

module.exports = {voteAuth};
