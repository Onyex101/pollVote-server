var express = require('express');
var bodyParser = require('body-parser');
var _ = require('lodash');
const { ObjectID } = require('mongodb');

var { User } = require('./../../models/user');
var { authenticate } = require('./../../middleware/authentication');
var { Poll } = require('./../../models/poll');
const message = require('./../../misc/message');
const pusher = require('./../../server/pusher');

var router = express.Router();
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

/**
 * Creates a new Admin
 */
router.post('/signup', (req, res) => {
    var body = _.pick(req.body, ['full_name', 'code', 'user_name', 'email', 'password']);
    var user = new User(body);
    user.save().then((user) => {
        return user.generateAuthToken();
    }).then((token) => {
        res.header('x-auth', token).send({ message: message.admin.signUp });
    }).catch((err) => {
        res.status(400).send(err);
    });
});

/**
 * login admin
 * public route
 */
router.post('/login', (req, res) => {
    var body = _.pick(req.body, ['user_name', 'password']);
    User.findByCredentials(body.user_name, body.password).then((user) => {
        user.generateAuthToken().then((token) => {
            res.header('x-auth', token).send({ message: message.admin.login });
        });
    }).catch((err) => {
        res.status(400).send({ err });
    });
});


router.get('/home', authenticate, (req, res) => {
    var user = req.user;
    Poll.find({ _userID: user._id }).then((val) => {
        const data = { user, val, pending: user.pending, auth: user.authorised };
        res.send(data);
    })
});

/**
 * Create a new poll
 * 
 */
router.post('/new-poll', authenticate, (req, res) => {
    var body = {
        _userID: req.user._id,
        code: req.user.code,
        question: req.body.question,
        options: req.body.options
    };
    var newPoll = new Poll(body);
    newPoll.save().then((poll) => {
        res.send({ message: message.admin.poll });
    }).catch((err) => {
        res.status(400).send(err);
    });
});

/**
 * get all polls
 */
router.get('/all-polls', authenticate, (req, res) => {
    var id = req.user._id;
    Poll.find({ _userID: id }).then((polls) => {
        if (!polls) {
            res.send({ message: 'no poll found' });
        };
        res.send(polls);
    }).catch((err) => {
        res.status(400).send(err);
    })
});

/**
 * Delete poll
 */
router.delete('/delete/:id', (req, res) => {
    var id = req.params.id;
    if (!ObjectID.isValid(id)) {
        return res.status(404).send({ message: 'invalid id' });
    };
    Poll.findByIdAndDelete(id).then((poll) => {
        if (!poll) {
            res.send({
                message: 'Sorry, poll does not exist'
            });
        }
        res.send(poll);
    }).catch((err) => {
        res.status(400).send(err);
    });
});

/**
 * view pending users
 */
router.get('/pending', authenticate, (req, res) => {
    var id = req.user._id;
    User.findById(id).then((user) => {
        res.send(user.pending);
    }).catch((err) => {
        res.status(400).send(err);
    })
});

/**
 * convert pending voters to
 * authorized voters
 */
router.post('/pend-auth', authenticate, (req, res) => {
    var body = req.body;
    var id = req.user._id;
    for (var i = 0; i < body.pending.length; i++) {
        var pend = body.pending[i];
        User.update({
            _id: id,
            pending: {
                $elemMatch: {
                    full_name: pend.full_name,
                    email: pend.email
                }
            }
        }, {
                $pull: {
                    pending: pend
                }
            }).then((user) => {
                if (!user) {
                    res.status(400).send({ error });
                }
                User.update({ _id: id }, {
                    $push: {
                        authorised: pend
                    }
                }).then(() => {
                    res.send({ message: 'voter was succesfully authorized' });
                }).catch((e) => {
                    res.status(400).send({ e });
                })
            }).catch((err) => {
                res.send(err);
            });
    }

})

/**
 * view authorised users
 */
router.get('/authorised', authenticate, (req, res) => {
    var id = req.user._id;
    User.findById(id).then((user) => {
        res.send(user.authorised);
    }).catch((err) => {
        res.status(400).send({ err });
    });
});

/**
 * check current results
 */
router.get('/results', authenticate, (req, res) => {
    Poll.findOne({
        _userID: res.user._id,
        code: res.user.code
    }).then((poll) => {
        res.send({ result: poll.options });
    }).catch((e) => {
        res.status(400).send({ e });
    });
})

/**
 * log out
 */
router.delete('/logout', authenticate, (req, res) => {
    req.user.removeToken(req.token).then((arr) => {
        res.send({
            message: 'Admin logged out'
        });
    }).catch((err) => {
        res.status(400).send({ err });
    });
});

module.exports = router;
