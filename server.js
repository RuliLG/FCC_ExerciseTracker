const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://admin:Admin1@ds125472.mlab.com:25472/rlg_fcc')

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

var Schema = mongoose.Schema;
var userSchema = new Schema({
  username: {required: true, type: String}
});
var User = mongoose.model('User', userSchema);


app.post('/api/exercise/new-user', (req, res) => {
  const username = req.body.username.trim();
  if (username.length === 0) {
    res.json({error: 'You must send a valid username'});
    return;
  }
  var user = new User({username});
  user.save((err, data) => {
    if (err) {
      res.json({error: 'Username already taken'});
      return;
    }
    res.json({username: data.username, _id: data._id});
  });
});

var exerciseSchema = new Schema({
  userId: {required: true, type: String},
  description: {required: true, type: String},
  duration: {required: true, type: Number},
  date: {required: false, type: Date}
});
var Exercise = mongoose.model('Exercise', exerciseSchema);

app.post('/api/exercise/add', (req, res) => {
  const userId = req.body.userId;
  const description = req.body.description;
  let duration = req.body.duration;
  let date = req.body.date;
  if (!date) {
    date = new Date();
    date = date.toISOString().substring(0, 10); // yyyy-mm-dd format
  }
  
  if (!description || !duration || !userId) {
    res.json({error: 'Missing mandatory parameters'});
    return;
  }
  duration = parseFloat(duration);
  if (isNaN(duration) || duration < 0) {
    res.json({error: 'Invalid duration'});
    return;
  }
  
  User.findOne({_id: userId}, null, function(err, data) {
    if (err) {
      res.json({error: 'invalid user id'});
      return;
    }
    
    var ex = new Exercise({userId, description, duration, date});
    ex.save((err, data) => {
      res.json(data);
    });
  });
});

app.get('/api/exercise/log', (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    res.json({error: 'No userId provided'});
    return;
  }
  
  const from = req.query.from;
  const to = req.query.to;
  let limit = req.query.limit;
  if (limit) {
    limit = parseInt(limit);
    if (isNaN(limit) || limit < 0) {
      limit = 0;
    }
  }
  
  
  User.findOne({_id: userId}, null, function(err, data) {
    if (err) {
      res.json({error: 'invalid user id'});
      return;
    }
    
    const response = {_id: data._id, username: data.username};
    
    // Find exercises
    const query = {userId};
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }
    Exercise.find(query, (err, exercises) => {
      if (err) {
        res.json(err);
        return;
      }
      
      if (limit) {
        exercises = exercises.slice(0, limit);
      }
      exercises = exercises.map(a => {
        return {description: a.description, duration: a.duration, date: a.date};
      });
      response.count = exercises.length;
      response.log = exercises;
      res.json(response);
    });
  });
});

app.get('/api/exercise/users', (req, res) => {
  User.find({}, (err, data) => {
    if (err) {
      res.json({error: 'couldn\'t get user data'});
      return;
    }
    var users = data.map(a => {
      return {_id: a._id, username: a.username};
    });
    res.json(users);
  });
});


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
