import dotenv from 'dotenv';

// Load .env for local runs. In CI the variables come from the workflow and are not overridden.
dotenv.config({ quiet: true });

const TOKEN_VARIABLE = 'TODOIST_API_TOKEN';

/**
 * Returns the Todoist API token, or undefined when it is not set.
 * Used where a missing token is fine, for example when redacting artifacts.
 */
export function findApiToken(): string | undefined {
  const token = process.env[TOKEN_VARIABLE]?.trim();
  return token === undefined || token === '' ? undefined : token;
}

/** Returns the Todoist API token. Throws a clear error (without any value) when it is missing. */
export function getApiToken(): string {
  const token = findApiToken();
  if (token === undefined) {
    throw new Error(
      `${TOKEN_VARIABLE} is not set. Locally, copy .env.example to .env and fill it in. ` +
        'In CI, add it as a GitHub Actions secret.',
    );
  }
  return token;
}
