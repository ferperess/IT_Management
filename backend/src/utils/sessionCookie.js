const SESSION_COOKIE_NAME = 'sgti_session';

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };
}

function sessionCookieOptions() {
  return { ...baseCookieOptions(), maxAge: 60 * 60 * 1000 };
}

function sessionClearCookieOptions() {
  return baseCookieOptions();
}

module.exports = { SESSION_COOKIE_NAME, sessionCookieOptions, sessionClearCookieOptions };
