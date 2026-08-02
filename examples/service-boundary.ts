import { err, mapError, ok, type Result } from './result';

export type User = Readonly<{
  id: string;
  email: string;
}>;

export type CreateUserInput = Readonly<{
  email: string;
  idempotencyKey: string;
}>;

export type CreateUserError =
  | { readonly code: 'invalid_email' }
  | { readonly code: 'email_taken'; readonly email: string }
  | { readonly code: 'repository_unavailable' };

type RepositoryFailure =
  | { readonly code: 'email_taken' }
  | { readonly code: 'unavailable' };

export interface UserRepository {
  /**
   * The adapter owns uniqueness, retry, and exception-to-Result mapping.
   * The idempotency key makes a repeated request return the same outcome.
   */
  create(input: {
    readonly email: string;
    readonly idempotencyKey: string;
  }): Promise<Result<User, RepositoryFailure>>;
}

export interface Logger {
  info(event: string, fields: Readonly<Record<string, unknown>>): void;
  warn(event: string, fields: Readonly<Record<string, unknown>>): void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (
  value: string,
): Result<string, { readonly code: 'invalid_email' }> => {
  const email = value.trim().toLowerCase();

  return EMAIL_PATTERN.test(email)
    ? ok(email)
    : err({ code: 'invalid_email' });
};

/**
 * A service boundary with one job:
 * normalize input, express expected failures, and emit useful outcomes.
 */
export const createUser = async (
  input: CreateUserInput,
  dependencies: {
    readonly users: UserRepository;
    readonly logger: Logger;
    readonly correlationId: string;
  },
): Promise<Result<User, CreateUserError>> => {
  const { users, logger, correlationId } = dependencies;
  const normalizedEmail = normalizeEmail(input.email);

  if (!normalizedEmail.ok) {
    logger.info('user.create.rejected', {
      correlationId,
      reason: normalizedEmail.error.code,
    });

    return normalizedEmail;
  }

  const persisted = await users.create({
    email: normalizedEmail.value,
    idempotencyKey: input.idempotencyKey,
  });

  const outcome = mapError(
    persisted,
    (failure): CreateUserError =>
      failure.code === 'email_taken'
        ? { code: 'email_taken', email: normalizedEmail.value }
        : { code: 'repository_unavailable' },
  );

  if (outcome.ok) {
    logger.info('user.create.succeeded', {
      correlationId,
      userId: outcome.value.id,
    });
  } else {
    logger.warn('user.create.failed', {
      correlationId,
      reason: outcome.error.code,
    });
  }

  return outcome;
};
