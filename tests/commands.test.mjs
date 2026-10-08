import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommands, formatCommands } from '../src/assets/js/commands.js';

test('parses common formats', () => {
  const { commands, errors } = parseCommands([
    'start - Start the bot',
    '/help — Show help',
    'Settings–Open settings',
    '',
    '# comment',
    'stop - Stop - and clean up',
  ].join('\n'));
  assert.deepEqual(errors, []);
  assert.deepEqual(commands, [
    { command: 'start', description: 'Start the bot' },
    { command: 'help', description: 'Show help' },
    { command: 'settings', description: 'Open settings' },
    { command: 'stop', description: 'Stop - and clean up' },
  ]);
});

test('parses ephemeral marker', () => {
  const { commands } = parseCommands('secret - Only you can see it [ephemeral]');
  assert.deepEqual(commands, [{ command: 'secret', description: 'Only you can see it', is_ephemeral: true }]);
});

test('reports errors with line numbers', () => {
  const { commands, errors } = parseCommands([
    'start',
    'bad-name! - x',
    'ok - fine',
    'ok - duplicate',
    'empty - ',
    `${'a'.repeat(33)} - too long`,
  ].join('\n'));
  assert.deepEqual(commands, [{ command: 'ok', description: 'fine' }]);
  assert.deepEqual(errors.map((e) => [e.line, e.code]), [
    [1, 'cmd_format'],
    [2, 'cmd_name'],
    [4, 'cmd_duplicate'],
    [5, 'cmd_description'],
    [6, 'cmd_name'],
  ]);
});

test('enforces 100 command limit', () => {
  const text = Array.from({ length: 101 }, (_, i) => `cmd${i} - Command ${i}`).join('\n');
  const { errors } = parseCommands(text);
  assert.deepEqual(errors, [{ line: 0, code: 'cmd_limit' }]);
});

test('format/parse round trip', () => {
  const commands = [
    { command: 'start', description: 'Start' },
    { command: 'tip', description: 'Private tip', is_ephemeral: true },
  ];
  assert.deepEqual(parseCommands(formatCommands(commands)).commands, commands);
});
