var mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pollvote', {useNewUrlParser: true});
mongoose.set('useCreateIndex', true);

module.exports = {mongoose};