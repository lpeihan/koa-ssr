
'use strict';

const Router = require('koa-router');

const users = require('./users');

const router = new Router();

router
  .use('/api/users', users.routes(), users.allowedMethods());

module.exports = router;