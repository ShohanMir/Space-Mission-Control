const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const api = require('./routes/api');

const app = express();

//cors accessability
app.use(
  cors({
    origin: 'http://localhost:3000',
  })
);

//dynamic log/ track
app.use(morgan('combined'));

// passing middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/v1', api);

app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;
