var {User} = require('./../models/user');

var authenticate = (req, res, next) => {
    var token = req.header('x-auth');
    User.findByToken(token).then((user) => {
        if (!user) {
            return Promise.reject('invalid token');
        }
        req.user = user;
        req.token = token;
        next();
    }).catch((err) => {
        res.status(401).send({message: 'token does not exist'});
    });
};

module.exports = {authenticate};
