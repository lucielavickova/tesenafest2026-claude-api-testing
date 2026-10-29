/**
 * Reads a Playwright trace zip for scripts/trace-summary.mts. A separate module, so the unit tests
 * can import it. Request headers are never read, because they hold the API token.
 */
import { unzipSync } from 'fflate';

const MAX_BODY_LENGTH = 1000;
/** A Todoist token is 40 hex characters. Bodies should not hold one, but never print it. */
const TOKEN_PATTERN = /\b[0-9a-f]{40}\b/g;
/** Colors in Playwright error messages. */
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

interface TraceEvent {
  type?: string;
  callId?: string;
  title?: string;
  error?: { message?: string };
}

interface NetworkEvent {
  snapshot?: {
    request?: { method?: string; url?: string; postData?: { text?: string; _file?: string } };
    response?: { status?: number; content?: { _file?: string } };
  };
}

function lines<T>(text: string): T[] {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as T);
}

function shorten(text: string): string {
  const safe = text
    .replace(ANSI_PATTERN, '')
    .replace(TOKEN_PATTERN, '[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();
  return safe.length > MAX_BODY_LENGTH ? `${safe.slice(0, MAX_BODY_LENGTH)}...` : safe;
}

export function summarize(zip: Uint8Array): string {
  const files = unzipSync(zip);
  const text = (name: string) => new TextDecoder().decode(files[name]);
  /** A body is stored inline or as a file under resources/. */
  const body = (inline: string | undefined, file: string | undefined) => {
    if (inline) return inline;
    return file && files[file] ? text(file) : '';
  };
  const out: string[] = [];

  const steps = Object.keys(files)
    .filter((name) => name.endsWith('.trace'))
    .flatMap((name) => lines<TraceEvent>(text(name)));
  const failed = new Map(
    steps
      .filter((event) => event.type === 'after' && event.error)
      .map((event) => [event.callId, event.error?.message ?? '']),
  );
  out.push('Steps:');
  for (const event of steps.filter((e) => e.type === 'before' && e.title)) {
    const error = failed.get(event.callId);
    out.push(error === undefined ? `  ${event.title ?? ''}` : `  FAILED ${event.title ?? ''}`);
    if (error) out.push(`    ${shorten(error)}`);
  }

  out.push('API calls:');
  for (const name of Object.keys(files)
    .filter((n) => n.endsWith('.network'))
    .sort()) {
    for (const { snapshot } of lines<NetworkEvent>(text(name))) {
      const request = snapshot?.request;
      const response = snapshot?.response;
      out.push(
        `  ${request?.method ?? '?'} ${request?.url ?? '?'} -> ${String(response?.status ?? '?')}`,
      );
      const requestBody = body(request?.postData?.text, request?.postData?._file);
      if (requestBody) out.push(`    request:  ${shorten(requestBody)}`);
      const responseBody = body(undefined, response?.content?._file);
      if (responseBody) out.push(`    response: ${shorten(responseBody)}`);
    }
  }
  return out.join('\n');
}
