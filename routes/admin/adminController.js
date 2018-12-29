var express = require('express');
var bodyParser = require('body-parser');
var _ = require('lodash');
const {ObjectID} = require('mongodb');

var {User} = require('./../../models/user');
var {authenticate} = require('./../../middleware/authentication');
var {Poll} = require('./../../models/poll');

var router = express.Router();
router.use(bodyParser.urlencoded({extended: true}));
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
        res.header('x-auth', token).send(user);
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
            res.header('x-auth', token).send(user);
        });
    }).catch ((err) => {
        res.status(400).send({err});
    });
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
        res.send(poll);
    }).catch((err) => {
        res.status(400).send(err);
    });
});

/**
 * get all polls
 */
router.get('/all-polls', authenticate, (req, res) => {
    var id = req.user._id;
    Poll.find({_userID: id}).then((polls) => {
        if (!polls) {
            res.send('no poll found');
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
    if(!ObjectID.isValid(id)) {
        return res.status(404).send({message: 'invalid id'});
    };
    Poll.findByIdAndDelete(id).then((poll) => {
        if (!poll) {
            res.send({
                message: 'Sorry, this poll does not exist'
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
 * log out
 */
router.delete('/logout', authenticate, (req, res) => {
    req.user.removeToken(req.token).then((arr) => {
        res.send({
            message: 'Admin logged out'
        });
    }).catch((err) => {
        res.status(400).send({err});
    });
});

module.exports = router;
