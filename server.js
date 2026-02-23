const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;


const sendotpRoute = require('./routes/sendotp');

app.use(express.json());


app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});


app.use('/sendotp', sendotpRoute);


app.get('/', (req, res) => {
  res.json({
    name: 'Railway OTP API',
    version: '3.0.0',
    endpoints: ['/sendotp'],
    status: 'online'
  });
});

app.listen(PORT, () => {
  console.log(`✅ Railway OTP API berjalan di port ${PORT}`);
});
