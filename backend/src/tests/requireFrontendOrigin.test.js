const { createRequireFrontendOrigin } = require('../middlewares/requireFrontendOrigin');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

test('allows safe methods without an Origin header', () => {
  const middleware = createRequireFrontendOrigin('https://app.example.com/');
  const next = jest.fn();
  middleware({ method: 'GET', get: () => undefined }, mockRes(), next);
  expect(next).toHaveBeenCalledTimes(1);
});

test('requires the exact configured frontend origin for mutations', () => {
  const middleware = createRequireFrontendOrigin('https://app.example.com');
  const res = mockRes();
  const next = jest.fn();
  middleware({ method: 'POST', get: () => 'https://attacker.example.com' }, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith({ erro: 'Origem da requisição não permitida.' });
  expect(next).not.toHaveBeenCalled();
});

test('allows mutations from the configured frontend origin', () => {
  const middleware = createRequireFrontendOrigin('https://app.example.com');
  const next = jest.fn();
  middleware({ method: 'DELETE', get: () => 'https://app.example.com' }, mockRes(), next);
  expect(next).toHaveBeenCalledTimes(1);
});
