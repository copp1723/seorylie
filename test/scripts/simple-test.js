const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const server = app.listen(3002, '127.0.0.1', () => {
  console.log('Server running on http://127.0.0.1:3002');
});