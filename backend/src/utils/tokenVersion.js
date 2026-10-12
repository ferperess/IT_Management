const { createHmac } = require('crypto');

function tokenVersion(passwordHash, secret) {
  return createHmac('sha256', secret)
    .update(`sgti:credential-version:${passwordHash}`)
    .digest('hex');
}

module.exports = { tokenVersion };
