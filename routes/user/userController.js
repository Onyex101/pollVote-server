var express = require('express');
var bodyParser = require('body-parser');
var _ = require('lodash');
const { ObjectID } = require('mongodb');

const { voteAuth } = require('./../../middleware/voter-auth');
const { Voter } = require('./../../models/voter');
const { Poll } = require('./../../models/poll');
const { User } = require('./../../models/user');

var router = express.Router();
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

/**
 * Add a user
 */
router.post('/signup', (req, res) => {
    var body = _.pick(req.body, ['full_name', 'user_name', 'email', 'password']);
    var voter = new Voter(body);
    voter.save().then((voter) => {
        return voter.generateAuthToken();
    }).then((token) => {
        res.header('x-auth', token).send({ voter });
    }).catch((err) => {
        res.status(400).send(err);
    });
});

/**
 * login voter
 */
router.post('/login', (req, res) => {
    var body = _.pick(req.body, ['user_name', 'code', 'password']);
    Voter.findByCredentials(body.user_name, body.password).then((voter) => {
        voter.generateAuthToken().then((token) => {
            User.find({
                code: body.code,
                authorised: {
                    $elemMatch: {
                        full_name: voter.full_name,
                        email: voter.email
                    }
                }
            }).then((user) => {
                let test = _.isEmpty(user);
                if ((test === true) || !user) {
                    User.update({ code: body.code }, {
                        $push: {
                            pending: { full_name: voter.full_name, email: voter.email }
                        }
                    }).then(() => {
                        res.header('x-auth', token).send(voter);
                    });
                } else {
                    res.header('x-auth', token).send(voter);
                }
            }).catch((e) => {
                res.status(400).send({ e });
            })
        });
    }).catch((err) => {
        res.status(400).send({err});
    });
});

/**
 * get question
 */
router.post('/get-code', voteAuth, (req, res) => {
    var code = _.pick(req.body, ['code']);
    User.find(
        {
            code: code.code,
            authorised: {
                $elemMatch: {
                    full_name: req.voter.full_name,
                    hasVoted: false
                }
            }
        }
    ).then((val) => {
        let test = _.isEmpty(val);
        if (test === true) {
            res.send({ message: 'Already Voted!' });
        } else {
            Poll.findOne({ code: code.code }).then((poll) => {
                if (!poll) {
                    res.status(400).send({ message: 'no poll' });
                };
                res.send(poll);
            }).catch((err) => {
                res.status(400).send(err);
            });
        }
    }).catch((e) => {
        res.status(400).send({e});
    });
});

/**
 * send selected option
 */
router.post('/poll', voteAuth, (req, res) => {
    var body = _.pick(req.body, ['_id', 'code']);
    User.find(
        {
            code: body.code,
            authorised: {
                $elemMatch: {
                    full_name: req.voter.full_name,
                    hasVoted: false
                }
            }
        }
    ).then((user) => {
        let test = _.isEmpty(user);
        if (test === true) {
            res.send({ message: 'Already Voted!' });
        } else {
            Poll.update({
                code: body.code,
                'options._id': body._id
            }, {
                    $inc: {
                        "options.$.votes": 1
                    }
                }).then((poll) => {
                    User.update({
                        code: body.code,
                        'authorised.full_name': req.voter.full_name
                    }, { $set: { 'authorised.$.hasVoted': true } }).then((r) => {
                        res.send({message: 'Voted!' });
                    }).catch((err) => {
                        res.status(400).send({ err });
                    });
                }).catch((err) => res.status(400).send({ err }));
        }
    }).catch((err) => {
        res.status(400).send({ err });
    });
});

router.post('/results', voteAuth, (req, res) => {
    var body = _.pick(req.body, ['code']);
    Poll.findOne({
        code: body.code
    }).then((poll) => {
        var data = poll.options;
        var a = 0;
        data.forEach((element) => {
            a += element.votes
        });
        var listObjects = [];
        data.forEach((element) => {
            var singleObj = {};
            singleObj['value'] = Math.round(((element.votes)/a)*100);
            singleObj['votes'] = element.votes;
            singleObj['field'] = element.field;
            singleObj['_id'] = element._id;
            listObjects.push(singleObj);
        });
        res.send({title: poll.question, options: listObjects});
    }).catch((e) => {
        res.status(400).send({ e });
    });
})

/**
 * logout
 */
router.delete('/logout', voteAuth, (req, res) => {
    req.voter.removeToken(req.token).then(() => {
        res.send({
            message: 'voter logged out'
        });
    }).catch((err) => {
        res.status(400).send({ err });
    });
});

module.exports = router;
