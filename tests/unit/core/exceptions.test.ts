import {
  PayloadError,
  BadRequest,
  InvalidAttributes,
  TransactionDeclined,
  Unauthorized,
  Forbidden,
  NotFound,
  TooManyRequests,
  InternalServerError,
  ServiceUnavailable,
  UnknownResponse,
} from '../../../src/core/exceptions';

describe('Exceptions', () => {
  describe('PayloadError', () => {
    it('should create with message and details', () => {
      const error = new PayloadError('test error', {
        status_code: 400,
        error_type: 'bad_request',
        error_description: 'test error',
      });
      expect(error.message).toBe('test error');
      expect(error.statusCode).toBe(400);
      expect(error.errorType).toBe('bad_request');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('fromResponse', () => {
    it('should create BadRequest for 400', () => {
      const error = PayloadError.fromResponse(400, { error_description: 'bad' });
      expect(error).toBeInstanceOf(BadRequest);
      expect(error.statusCode).toBe(400);
    });

    it('should create InvalidAttributes for 400 with invalid_attributes type', () => {
      const error = PayloadError.fromResponse(400, {
        error_type: 'invalid_attributes',
        error_description: 'invalid fields',
      });
      expect(error).toBeInstanceOf(InvalidAttributes);
    });

    it('should create TransactionDeclined for 400 with transaction_declined type', () => {
      const error = PayloadError.fromResponse(400, {
        error_type: 'transaction_declined',
        error_description: 'declined',
        transaction: { id: 'txn_1', status: 'declined' },
      });
      expect(error).toBeInstanceOf(TransactionDeclined);
      expect((error as TransactionDeclined).transaction).toEqual({ id: 'txn_1', status: 'declined' });
    });

    it('should create Unauthorized for 401', () => {
      const error = PayloadError.fromResponse(401, { error_description: 'unauthorized' });
      expect(error).toBeInstanceOf(Unauthorized);
    });

    it('should create Forbidden for 403', () => {
      const error = PayloadError.fromResponse(403, { error_description: 'forbidden' });
      expect(error).toBeInstanceOf(Forbidden);
    });

    it('should create NotFound for 404', () => {
      const error = PayloadError.fromResponse(404, { error_description: 'not found' });
      expect(error).toBeInstanceOf(NotFound);
    });

    it('should create TooManyRequests for 429', () => {
      const error = PayloadError.fromResponse(429, { error_description: 'rate limited' });
      expect(error).toBeInstanceOf(TooManyRequests);
    });

    it('should create InternalServerError for 500', () => {
      const error = PayloadError.fromResponse(500, { error_description: 'server error' });
      expect(error).toBeInstanceOf(InternalServerError);
    });

    it('should create ServiceUnavailable for 503', () => {
      const error = PayloadError.fromResponse(503, { error_description: 'unavailable' });
      expect(error).toBeInstanceOf(ServiceUnavailable);
    });

    it('should create UnknownResponse for unmapped status codes', () => {
      const error = PayloadError.fromResponse(418, { error_description: 'teapot' });
      expect(error).toBeInstanceOf(UnknownResponse);
    });
  });
});
