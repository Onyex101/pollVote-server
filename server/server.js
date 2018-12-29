const {app} = require('./app');
var {mongoose} = require('./../database/mongoose');
const port = process.env.PORT || 3000;
const cors = require('cors');
const adminController = require('./../routes/admin/adminController');
const userController = require('./../routes/user/userController');

app.use(cors());
app.use('/admin', adminController);
app.use('/user', userController);

app.listen(port, () => {
    console.log(`server started at ${port}`);
});
