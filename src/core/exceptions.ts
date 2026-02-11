/**
 * Payload SDK Exception Hierarchy
 *
 * Maps HTTP status codes to typed exceptions following the Payload ARM pattern.
 * Each exception carries the original response details for debugging.
 */

export interface ErrorDetails {
  status_code?: number;
  error_type?: string;
  error_description?: string;
  details?: Record<string, unknown>;
  transaction?: Record<string, unknown>;
}

export class PayloadError extends Error {
  public readonly statusCode: number | undefined;
  public readonly errorType: string | undefined;
  public readonly errorDescription: string | undefined;
  public readonly details: Record<string, unknown> | undefined;

  constructor(message: string, errorDetails?: ErrorDetails) {
    super(message);
    this.name = 'PayloadError';
    this.statusCode = errorDetails?.status_code;
    this.errorType = errorDetails?.error_type;
    this.errorDescription = errorDetails?.error_description;
    this.details = errorDetails?.details;
  }

  static fromResponse(statusCode: number, body: Record<string, unknown>): PayloadError {
    const errorDetails: ErrorDetails = {
      status_code: statusCode,
      error_type: body.error_type as string,
      error_description: body.error_description as string,
      details: body.details as Record<string, unknown>,
      transaction: body.transaction as Record<string, unknown>,
    };

    const message = (body.error_description as string) || `HTTP ${statusCode} Error`;

    const ErrorClass = STATUS_CODE_MAP[statusCode];
    if (ErrorClass) {
      if (statusCode === 400 && body.error_type === 'transaction_declined') {
        return new TransactionDeclined(message, errorDetails);
      }
      if (statusCode === 400 && body.error_type === 'invalid_attributes') {
        return new InvalidAttributes(message, errorDetails);
      }
      return new ErrorClass(message, errorDetails);
    }
    return new UnknownResponse(message, errorDetails);
  }
}

export class UnknownResponse extends PayloadError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, details);
    this.name = 'UnknownResponse';
  }
}

export class BadRequest extends PayloadError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, details);
    this.name = 'BadRequest';
  }
}

export class InvalidAttributes extends BadRequest {
  constructor(message: string, details?: ErrorDetails) {
    super(message, details);
    this.name = 'InvalidAttributes';
  }
}

export class TransactionDeclined extends BadRequest {
  public readonly transaction: Record<string, unknown> | undefined;

  constructor(message: string, details?: ErrorDetails) {
    super(message, details);
    this.name = 'TransactionDeclined';
    this.transaction = details?.transaction;
  }
}

export class Unauthorized extends PayloadError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, details);
    this.name = 'Unauthorized';
  }
}

export class Forbidden extends PayloadError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, details);
    this.name = 'Forbidden';
  }
}

export class NotFound extends PayloadError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, details);
    this.name = 'NotFound';
  }
}

export class TooManyRequests extends PayloadError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, details);
    this.name = 'TooManyRequests';
  }
}

export class InternalServerError extends PayloadError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, details);
    this.name = 'InternalServerError';
  }
}

export class ServiceUnavailable extends PayloadError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, details);
    this.name = 'ServiceUnavailable';
  }
}

const STATUS_CODE_MAP: Record<number, new (message: string, details?: ErrorDetails) => PayloadError> = {
  400: BadRequest,
  401: Unauthorized,
  403: Forbidden,
  404: NotFound,
  429: TooManyRequests,
  500: InternalServerError,
  503: ServiceUnavailable,
};

export const Exceptions = {
  PayloadError,
  UnknownResponse,
  BadRequest,
  InvalidAttributes,
  TransactionDeclined,
  Unauthorized,
  Forbidden,
  NotFound,
  TooManyRequests,
  InternalServerError,
  ServiceUnavailable,
};
