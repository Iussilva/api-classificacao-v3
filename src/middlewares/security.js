const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');

function applySecurity(app) {
  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn-uicons.flaticon.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn-uicons.flaticon.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));

  app.use(cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (env.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn('[CORS BLOQUEADO]', origin);
      return callback(new Error('Origem nao permitida pelo CORS.'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Token'],
    credentials: true
  }));

  app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { erro: 'Muitas requisicoes. Tente novamente em 15 minutos.' }
  }));

  app.use('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { erro: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
    skipSuccessfulRequests: true
  }));
}

module.exports = applySecurity;
