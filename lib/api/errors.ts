/**
 * API Error Handling
 *
 * Consistent error responses for Seance API
 */

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const errorResponse = (error: unknown) => {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: {
          message: error.message,
          code: error.code || 'UNKNOWN_ERROR',
          statusCode: error.statusCode,
        },
      },
      { status: error.statusCode }
    )
  }

  // Unknown error
  console.error('Unexpected error:', error)
  return Response.json(
    {
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
      },
    },
    { status: 500 }
  )
}

// Common errors
export const errors = {
  notFound: (resource: string) =>
    new ApiError(404, `${resource} not found`, 'NOT_FOUND'),
  badRequest: (message: string) =>
    new ApiError(400, message, 'BAD_REQUEST'),
  unauthorized: (message = 'Unauthorized') =>
    new ApiError(401, message, 'UNAUTHORIZED'),
  forbidden: (message = 'Forbidden') =>
    new ApiError(403, message, 'FORBIDDEN'),
  rateLimitExceeded: (message = 'Rate limit exceeded') =>
    new ApiError(429, message, 'RATE_LIMIT_EXCEEDED'),
  internalError: (message = 'Internal server error') =>
    new ApiError(500, message, 'INTERNAL_ERROR'),
}
