export class AppError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = this.constructor.name
  }
}

export class NetworkError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
  }
}

export class AuthError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
  }
}

export class PermissionError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
  }
}
