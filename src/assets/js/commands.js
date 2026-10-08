// Text <-> BotCommand[] conversion for the commands editor.
// Line format: "command - description", optional trailing "[ephemeral]". Lines starting with # are ignored.
import { LIMITS } from './data.js';

const EPHEMERAL_MARK = '[ephemeral]';
const COMMAND_RE = /^[a-z0-9_]+$/;
// Prefer a spaced dash ("cmd - text"), fall back to a bare one ("cmd-text").
const SPACED_SEPARATOR_RE = /\s+[-–—]\s+/;
const SEPARATOR_RE = /\s*[-–—]\s*/;

export function parseCommands(text) {
  const commands = [];
  const errors = [];
  const seen = new Set();

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    const lineNo = index + 1;
    if (line === '' || line.startsWith('#')) return;

    const match = line.match(SPACED_SEPARATOR_RE) ?? line.match(SEPARATOR_RE);
    if (!match) {
      errors.push({ line: lineNo, code: 'cmd_format' });
      return;
    }

    const command = line.slice(0, match.index).trim().replace(/^\//, '').toLowerCase();
    let description = line.slice(match.index + match[0].length).trim();
    let isEphemeral = false;
    if (description.toLowerCase().endsWith(EPHEMERAL_MARK)) {
      isEphemeral = true;
      description = description.slice(0, -EPHEMERAL_MARK.length).trim();
    }

    if (!command || command.length > LIMITS.commandName || !COMMAND_RE.test(command)) {
      errors.push({ line: lineNo, code: 'cmd_name', value: command });
      return;
    }
    const descLength = [...description].length;
    if (descLength < 1 || descLength > LIMITS.commandDescription) {
      errors.push({ line: lineNo, code: 'cmd_description', value: command });
      return;
    }
    if (seen.has(command)) {
      errors.push({ line: lineNo, code: 'cmd_duplicate', value: command });
      return;
    }
    seen.add(command);

    const item = { command, description };
    if (isEphemeral) item.is_ephemeral = true;
    commands.push(item);
  });

  if (commands.length > LIMITS.commands) {
    errors.push({ line: 0, code: 'cmd_limit' });
  }
  return { commands, errors };
}

export function formatCommands(commands) {
  return commands
    .map((c) => `${c.command} - ${c.description}${c.is_ephemeral ? ` ${EPHEMERAL_MARK}` : ''}`)
    .join('\n');
}
