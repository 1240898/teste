import { jest } from '@jest/globals';
import { AppError } from '../../../src/shared/errors/AppError.js';
import { errorHandler } from '../../../src/shared/errors/errorHandler.js';

function respond(error) {
  const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
  errorHandler(error, {}, res, () => {});
  return {
    status: res.status.mock.calls[0][0],
    body: res.json.mock.calls[0][0],
  };
}

const details = [
  {
    path: '/kitchen/dimensions/height',
    code: 'INVALID_DIMENSION',
    message: 'height must be between 2 and 10 metres',
  },
];

describe('ALN-1 errorHandler details (UT10)', () => {
  test('a 4xx AppError with details sends them', () => {
    expect(
      respond(
        new AppError(
          'The kitchen configuration content is invalid',
          422,
          details,
        ),
      ),
    ).toEqual({
      status: 422,
      body: {
        error: {
          message: 'The kitchen configuration content is invalid',
          status: 422,
          details,
        },
      },
    });
  });

  test('an AppError without details keeps the existing body', () => {
    expect(respond(new AppError('Not found', 404)).body).toEqual({
      error: { message: 'Not found', status: 404 },
    });
  });

  test('a 500 never carries details', () => {
    const error = new AppError('database exploded', 500, details);
    expect(respond(error).body).toEqual({
      error: { message: 'Internal Server Error', status: 500 },
    });
  });
});