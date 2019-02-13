const app = require('./app');
var {mongoose} = require('./../database/mongoose');
const port = process.env.PORT || 3000;
const cors = require('cors');
const hbs = require('hbs');
const pusher = require('./../misc/pusher');

const adminController = require('./../routes/admin/adminController');
const userController = require('./../routes/user/userController');

app.use(cors({
    origin: ['http://localhost:8100', 'http://localhost:8000', 'http://localhost'],
    credentials: true,
    exposedHeaders: ['x-auth'],
}));

app.use('/admin', adminController);
app.use('/user', userController);
app.set('view engine', 'hbs');


app.listen(port, () => {
    console.log(`server started at ${port}`);
});
