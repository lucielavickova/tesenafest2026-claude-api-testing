/**
 * Rules of the Bash allowlist of the ci-failure-triage subagent, used by
 * scripts/triage-bash-allowlist.mts. A separate module, so the unit tests can import it.
 */
import os from 'node:os';

const SPEC_URL = 'https://developer.todoist.com/openapi.json';
const NODE_SCRIPTS = ['scripts/check-no-token.mts', 'scripts/trace-summary.mts'];

/** Commands that only read files or print text. */
const READ_ONLY = new Set([
  'basename',
  'cat',
  'cd',
  'cut',
  'dirname',
  'echo',
  'grep',
  'head',
  'jq',
  'ls',
  'printf',
  'pwd',
  'sort',
  'tail',
  'tr',
  'uniq',
  'wc',
]);

/** gh subcommands that only read. */
const GH_READ = new Set([
  'run view',
  'run list',
  'run download',
  'pr view',
  'pr diff',
  'pr checks',
  'issue list',
  'issue view',
]);

/** git subcommands that only read. */
const GIT_READ = new Set([
  'blame',
  'diff',
  'grep',
  'log',
  'ls-files',
  'rev-parse',
  'show',
  'status',
]);

/** Options that make an otherwise read-only command write files or run other programs. */
const WRITING_OPTIONS: Record<string, RegExp> = {
  find: /^-(delete|exec|execdir|ok|okdir|fprint|fprint0|fprintf|fls)$/,
  sort: /^(-o|--output)/,
  git: /^(--output|-O|--open-files-in-pager|--ext-diff|--textconv)/,
};

interface Redirect {
  op: '>' | '>>' | '<';
  target: string;
}

interface Segment {
  words: string[];
  redirects: Redirect[];
}

class Blocked extends Error {}

/** Splits a command line into simple commands. Throws `Blocked` for shell features it rejects. */
function parse(command: string): Segment[] {
  const segments: Segment[] = [];
  let segment: Segment = { words: [], redirects: [] };
  let word: string | undefined;
  let pending: Redirect['op'] | undefined;

  const endWord = () => {
    if (word === undefined) return;
    if (pending) {
      segment.redirects.push({ op: pending, target: word });
      pending = undefined;
    } else {
      segment.words.push(word);
    }
    word = undefined;
  };
  const endSegment = () => {
    endWord();
    if (pending) throw new Blocked('a redirection without a target');
    if (segment.words.length > 0 || segment.redirects.length > 0) segments.push(segment);
    segment = { words: [], redirects: [] };
  };

  for (let i = 0; i < command.length; i++) {
    const c = command.charAt(i);
    const next = command.charAt(i + 1);

    if (c === "'") {
      const end = command.indexOf("'", i + 1);
      if (end === -1) throw new Blocked('an unterminated quote');
      word = (word ?? '') + command.slice(i + 1, end);
      i = end;
    } else if (c === '"') {
      let text = '';
      for (i++; i < command.length && command.charAt(i) !== '"'; i++) {
        const q = command.charAt(i);
        if (q === '$' || q === '`') throw new Blocked('variable or command substitution');
        if (q === '\\' && i + 1 < command.length) i++;
        text += command.charAt(i);
      }
      if (i >= command.length) throw new Blocked('an unterminated quote');
      word = (word ?? '') + text;
    } else if (c === '\\') {
      if (next === '\n') i++;
      else if (next !== '') word = (word ?? '') + command.charAt(++i);
    } else if (c === '$' || c === '`') {
      throw new Blocked('variable or command substitution');
    } else if (c === '#' && word === undefined) {
      while (i + 1 < command.length && command.charAt(i + 1) !== '\n') i++;
    } else if (c === ' ' || c === '\t') {
      endWord();
    } else if (c === '\n' || c === ';') {
      endSegment();
    } else if (c === '|') {
      if (next === '&') throw new Blocked('`|&`');
      if (next === '|') i++;
      endSegment();
    } else if (c === '&') {
      if (next === '&') {
        i++;
        endSegment();
      } else if (next === '>') {
        throw new Blocked('`&>`');
      } else {
        throw new Blocked('a background command (`&`)');
      }
    } else if (c === '(' || c === ')' || c === '{' || c === '}') {
      throw new Blocked('a subshell or a command group');
    } else if (c === '<') {
      if (next === '<' || next === '(')
        throw new Blocked('a here-document or process substitution');
      endWord();
      pending = '<';
    } else if (c === '>') {
      // A file descriptor right before the operator, as in `2>`, is not a word.
      if (word !== undefined && /^\d$/.test(word)) word = undefined;
      endWord();
      if (next === '(') throw new Blocked('process substitution');
      const op = next === '>' ? '>>' : '>';
      if (op === '>>') i++;
      if (command.charAt(i + 1) === '&') {
        // Duplicating a file descriptor (`2>&1`) writes no file.
        const fd = /^&\d/.exec(command.slice(i + 1));
        if (!fd) throw new Blocked('`>&` without a file descriptor');
        i += fd[0].length;
      } else {
        pending = op;
      }
    } else {
      word = (word ?? '') + c;
    }
  }
  endSegment();
  return segments;
}

/** Turns `C:\x`, `/c/x` and `C:/x` into `c:/x`, so Windows and Git Bash paths compare equal. */
function normalizePath(p: string): string {
  let n = p.replace(/\\/g, '/');
  const drive = /^\/([a-zA-Z])\//.exec(n);
  if (drive) n = `${drive[1] ?? ''}:/${n.slice(3)}`;
  if (/^[a-zA-Z]:\//.test(n)) n = n.toLowerCase();
  return n.replace(/\/+$/, '');
}

export function defaultTempRoots(): string[] {
  return [os.tmpdir(), '/tmp'];
}

/** True for a path strictly inside one of the temp roots. */
function isTempPath(p: string, tempRoots: readonly string[]): boolean {
  const n = normalizePath(p);
  if (n.split('/').includes('..')) return false;
  return tempRoots.some((root) => n.startsWith(`${normalizePath(root)}/`));
}

/** The value of an option given as `-D x`, `--dir x` or `--dir=x`. */
function optionValue(args: readonly string[], names: readonly string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    if (names.includes(arg)) return args[i + 1];
    const long = names.find((name) => name.startsWith('--') && arg.startsWith(`${name}=`));
    if (long) return arg.slice(long.length + 1);
  }
  return undefined;
}

function checkSegment(segment: Segment, tempRoots: readonly string[]): string | undefined {
  for (const { op, target } of segment.redirects) {
    if (op !== '<' && target !== '/dev/null' && !isTempPath(target, tempRoots)) {
      return `output redirection to "${target}", only /dev/null or the temp directory is allowed`;
    }
  }

  const [name, ...args] = segment.words;
  if (name === undefined) return 'a redirection without a command';
  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(name)) return 'variable assignments';

  const writing = WRITING_OPTIONS[name];
  if (writing && args.some((arg) => writing.test(arg))) {
    return `"${name}" with an option that writes files or runs programs`;
  }

  if (READ_ONLY.has(name) || name === 'find') return undefined;

  switch (name) {
    case 'gh': {
      const sub = args.slice(0, 2).join(' ');
      if (!GH_READ.has(sub)) return `"gh ${sub}", only read commands of gh are allowed`;
      if (sub === 'run download') {
        const dir = optionValue(args, ['-D', '--dir']);
        if (dir === undefined || !isTempPath(dir, tempRoots)) {
          return '"gh run download" without -D <temp directory>';
        }
      }
      return undefined;
    }
    case 'git': {
      const sub = args[0] ?? '';
      return GIT_READ.has(sub) ? undefined : `"git ${sub}", only read commands of git are allowed`;
    }
    case 'unzip': {
      // List and print modes extract nothing. Options after the archive name are file names,
      // so only the options before it count.
      const archive = args.findIndex((arg) => !arg.startsWith('-'));
      const options = archive === -1 ? args : args.slice(0, archive);
      if (options.some((arg) => /^-[a-zA-Z]*[lpZ]/.test(arg))) return undefined;
      const dir = optionValue(args, ['-d']);
      return dir !== undefined && isTempPath(dir, tempRoots)
        ? undefined
        : '"unzip" without -d <temp directory>';
    }
    case 'mktemp':
      return args.length === 1 && args[0] === '-d' ? undefined : 'only "mktemp -d" is allowed';
    case 'node': {
      const script = (args[0] ?? '').replace(/^\.\//, '');
      return NODE_SCRIPTS.includes(script)
        ? undefined
        : `"node ${args[0] ?? ''}", only ${NODE_SCRIPTS.join(' and ')} are allowed`;
    }
    case 'curl': {
      if (!args.includes(SPEC_URL)) return `"curl" to another URL than ${SPEC_URL}`;
      for (let i = 0; i < args.length; i++) {
        const arg = args[i] ?? '';
        if (arg === SPEC_URL || /^-[sSfL]+$/.test(arg)) continue;
        if (arg === '--silent' || arg === '--fail' || arg === '--location') continue;
        if ((arg === '-o' || arg === '--output') && isTempPath(args[i + 1] ?? '', tempRoots)) {
          i++;
          continue;
        }
        return `"curl" with the option "${arg}"`;
      }
      return undefined;
    }
    case 'rm': {
      const paths = args.filter((arg) => !/^-[rf]+$/.test(arg));
      if (paths.length === 0) return '"rm" without a path';
      // No globs: `/tmp/*` would delete the whole temp directory, not only the agent's.
      const outside = paths.find(
        (p) => p.startsWith('-') || /[*?[]/.test(p) || !isTempPath(p, tempRoots),
      );
      return outside === undefined ? undefined : `"rm ${outside}", only the temp directory`;
    }
    default:
      return `"${name}" is not on the allowlist`;
  }
}

/** Returns why the command is blocked, or undefined when every part of it is allowed. */
export function checkCommand(
  command: string,
  tempRoots: readonly string[] = defaultTempRoots(),
): string | undefined {
  let segments: Segment[];
  try {
    segments = parse(command);
  } catch (error) {
    if (error instanceof Blocked) return error.message;
    throw error;
  }
  if (segments.length === 0) return 'an empty command';
  for (const segment of segments) {
    const reason = checkSegment(segment, tempRoots);
    if (reason !== undefined) return reason;
  }
  return undefined;
}
