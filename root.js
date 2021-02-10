const config = require('./../config.js');
const proxy = require('./../lib/HTTPClient.js');
const IDM = require('./../lib/idm.js').IDM;
const AZF = require('./../lib/azf.js').AZF;
const jsonwebtoken = require('jsonwebtoken');

const log = require('./../lib/logger').logger.getLogger('Root');

const Root = (function() {
  //{token: {userInfo: {}, date: Date, verb1: [res1, res2, ..], verb2: [res3, res4, ...]}}
  const tokensCache = {};

  const pep = function(req, res) {
    const tokenHeader = req.headers.authorization;
    let authToken = tokenHeader
      ? tokenHeader.split('Bearer ')[1]
      : req.headers['x-auth-token'];

    if (authToken === undefined && req.headers.authorization !== undefined) {
      const headerAuth = req.headers.authorization.split(' ')[1];
      authToken = new Buffer(headerAuth, 'base64').toString();
    }

    const organizationToken = req.headers[config.organizations.header]
      ? req.headers[config.organizations.header]
      : null;

    if (authToken === undefined) {
      log.error('Auth-token not found in request header');
      const authHeader = 'IDM uri = ' + config.idm_host;
      res.set('WWW-Authenticate', authHeader);
      res.status(401).send('Auth-token not found in request header');
    } else {
      if (config.magic_key && config.magic_key === authToken) {
        const options = {
          host: config.app.host,
          port: config.app.port,
          path: req.url,
          method: req.method,
          headers: proxy.getClientIp(req, req.headers),
        };
        const protocol = config.app.ssl ? 'https' : 'http';
        proxy.sendData(protocol, options, req.body, res);
        return;
      }

      let action;
      let resource;
      let authzforce;

      if (config.authorization.enabled) {
        if (config.authorization.pdp === 'authzforce') {
          authzforce = true;
        } else {
          action = req.method;
          resource = req.path;
        }
      }

      if (config.pep.token.secret) {
        jsonwebtoken.verify(authToken, config.pep.token.secret, function(
          err,
          userInfo
        ) {
          if (err) {
            if (err.name === 'TokenExpiredError') {
              res.status(401).send('Invalid token: jwt token has expired');
            } else {
              log.error('Error in JWT ', err.message);
              log.error('Or JWT secret bad configured');
              log.error('Validate Token with Keyrock');
              checkToken(
                req,
                res,
                authToken,
                null,
                action,
                resource,
                authzforce,
                organizationToken
              );
            }
          } else if (config.authorization.enabled) {
            if (config.authorization.pdp === 'authzforce') {
              authorizeAzf(req, res, authToken, userInfo);
            } else if (config.authorization.pdp === 'idm') {
              checkToken(
                req,
                res,
                authToken,
                userInfo.exp,
                action,
                resource,
                authzforce,
                organizationToken
              );
            } else {
              res.status(401).send('User access-token not authorized');
            }
          } else {
            setHeaders(req, userInfo);
            redirRequest(req, res, userInfo);
          }
        });
      } else {
        checkToken(
          req,
          res,
          authToken,
          null,
          action,
          resource,
          authzforce,
          organizationToken
        );
      }
    }
  };

  const checkToken = function(
    req,
    res,
    authToken,
    jwtExpiration,
    action,
    resource,
    authzforce,
    organizationToken
  ) {
    IDM.checkToken(
      authToken,
      jwtExpiration,
      action,
      resource,
      authzforce,
      organizationToken,
      function(userInfo) {
        setHeaders(req, userInfo);
        if (config.authorization.enabled) {
          if (config.authorization.pdp === 'authzforce') {
            authorizeAzf(req, res, authToken, userInfo);
          } else if (userInfo.authorization_decision === 'Permit') {
            redirRequest(req, res, userInfo);
          } else {
            res.status(401).send('User access-token not authorized');
          }
        } else {
          redirRequest(req, res, userInfo);
        }
      },
      function(status, e) {
        if (status === 404 || status === 401) {
          log.error(e);
          res.status(401).send(e);
        } else {
          log.error('Error in IDM communication ', e);
          res.status(503).send('Error in IDM communication');
        }
      },
      tokensCache
    );
  };

  const setHeaders = function(req, userInfo) {
    // Set headers with user information
    req.headers['X-Nick-Name'] = userInfo.id ? userInfo.id : '';
    req.headers['X-Display-Name'] = userInfo.displayName
      ? userInfo.displayName
      : '';
    req.headers['X-Roles'] = userInfo.roles
      ? JSON.stringify(userInfo.roles)
      : [];
    req.headers['X-Organizations'] = userInfo.organizations
      ? JSON.stringify(userInfo.organizations)
      : [];
    req.headers['X-Eidas-Profile'] = userInfo.eidas_profile
      ? JSON.stringify(userInfo.eidas_profile)
      : {};
    req.headers['X-App-Id'] = userInfo.app_id;
  };

  const authorizeAzf = function(req, res, authToken, userInfo) {
    // Check decision through authzforce
    AZF.checkPermissions(
      authToken,
      userInfo,
      req,
      function() {
        redirRequest(req, res, userInfo);
      },
      function(status, e) {
        if (status === 401) {
          log.error('User access-token not authorized: ', e);
          res.status(401).send('User token not authorized');
        } else if (status === 404) {
          log.error('Domain not found: ', e);
          res.status(404).send(e);
        } else {
          log.error('Error in AZF communication ', e);
          res.status(503).send('Error in AZF communication');
        }
      },
      tokensCache
    );
  };

  const publicFunc = function(req, res) {
    redirRequest(req, res);
  };

  const redirRequest = function(req, res, userInfo) {
    if (userInfo) {
      log.info('Access-token OK. Redirecting to app...');
    } else {
      log.info('Public path. Redirecting to app...');
    }

    const protocol = config.app.ssl ? 'https' : 'http';

    const options = {
      host: config.app.host,
      port: config.app.port,
      path: req.url,
      method: req.method,
      headers: proxy.getClientIp(req, req.headers),
    };

    if (req.path === '/ShellInABox.js') {
        res.status(200).sendFile('/opt/fiware-pep-proxy/shellinabox/ShellInABox.js');
    } else if (req.path === '/' && req.method == 'GET') {
        res.status(200).sendFile('/opt/fiware-pep-proxy/shellinabox/root_page.html');
    } else {
        proxy.sendData(protocol, options, req.body, res);
    }
  };

  return {
    pep,
    public: publicFunc,
  };
})();

exports.Root = Root;