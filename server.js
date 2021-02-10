const config = require('./config');
const fs = require('fs');
const https = require('https');
const Root = require('./controllers/root').Root;
const IDM = require('./lib/idm.js').IDM;
const async = require('async');
const errorhandler = require('errorhandler');

config.azf = config.azf || {};
config.https = config.https || {};

const log = require('./lib/logger').logger.getLogger('Server');

const express = require('express');

process.on('uncaughtException', function(err) {
  log.error('Caught exception: ' + err);
});
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();

//app.use(express.bodyParser());

app.use(function(req, res, next) {
  const bodyChunks = [];
  req.on('data', function(chunk) {
    bodyChunks.push(chunk);
  });

  req.on('end', function() {
    if (bodyChunks.length > 0) {
      req.body = Buffer.concat(bodyChunks);
    }
    next();
  });
});

app.use(errorhandler({ log: log.error }));

app.use(function(req, res, next) {
    //res.header('Content-Security-Policy', 'default-src http:');
    res.header('Access-Control-Allow-Origin', '*');
    res.header(
    'Access-Control-Allow-Methods',
    'HEAD, POST, PUT, GET, OPTIONS, DELETE'
  );
  res.header(
    'Access-Control-Allow-Headers',
    'origin, content-type, X-Auth-Token, Tenant-ID, Authorization, Fiware-Service'
  );
  //log.debug("New Request: ", req.method);
  if (req.method === 'OPTIONS') {
    log.debug('CORS request');
    res.statusCode = 200;
    res.header('Content-Length', '0');
    res.send();
    res.end();
  } else {
    next();
  }
});

let port = config.pep_port || 80;
if (config.https.enabled) {
  port = config.https.port || 443;
}
app.set('port', port);

for (const p in config.public_paths) {
  log.debug('Public paths', config.public_paths[p]);
  app.all(config.public_paths[p], Root.public);
}

app.all('/*', Root.pep);

let retries = 0;
let idmConnected = false;

function retryCheck() {
  return !idmConnected && retries < 10;
}

function connectIDM(callback) {
  IDM.authenticate(
    function(token) {
      log.info('Success authenticating PEP proxy. Proxy Auth-token: ', token);
      idmConnected = true;
      callback();
    },
    function(status, e) {
      log.error('Error in IDM communication', e);
      callback();
    }
  );
}

function tryCreateConnection(callback) {
  const seconds = 5;

  retries++;

  if (retries === 1) {
    log.info('Starting PEP proxy in port ' + port + '. IdM authentication ...');
    connectIDM(callback);
  } else {
    log.info('Waiting %d seconds before attempting again.', seconds);
    setTimeout(() => {
      connectIDM(callback);
    }, seconds * 1000);
  }
}

function createConnectionHandler(error) {
  if (idmConnected) {
    log.info('Success authenticating PEP proxy.');
  } else {
    log.error('Error found after [%d] attempts: %s', retries, error);
    process.exit(1);
  }
}

async.whilst(retryCheck, tryCreateConnection, createConnectionHandler);

if (config.https.enabled === true) {
  const options = {
    key: fs.readFileSync(config.https.key_file),
    cert: fs.readFileSync(config.https.cert_file),
  };

  https
    .createServer(options, function(req, res) {
      app.handle(req, res);
    })
    .listen(app.get('port'));
} else {
  app.listen(app.get('port'));
}