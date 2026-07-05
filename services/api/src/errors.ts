/**
 * Matches components/schemas/Error in packages/api-contracts/openapi.yaml —
 * every non-2xx response body from this API is exactly `{ code, message }`,
 * no exceptions, so clients never have to branch on response shape.
 */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }

  toEnvelope(): { code: string; message: string } {
    return { code: this.code, message: this.message };
  }
}

export function badRequest(message: string, code = 'VALIDATION_ERROR'): ApiError {
  return new ApiError(400, code, message);
}

export function unauthorized(message = 'Missing or invalid credentials'): ApiError {
  return new ApiError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = 'Forbidden'): ApiError {
  return new ApiError(403, 'FORBIDDEN', message);
}

export function conflict(message: string, code = 'CONFLICT'): ApiError {
  return new ApiError(409, code, message);
}

export function notFound(message: string): ApiError {
  return new ApiError(404, 'NOT_FOUND', message);
}
