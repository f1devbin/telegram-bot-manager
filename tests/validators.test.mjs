import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateToken, validateApiBase, normalizeApiBase, validateWebhookUrl, validateHttpsUrl,
  validateSecretToken, generateSecretToken, validateIpAddress, validateMaxConnections,
  validateLanguageCode, validateChatId, validateUserId, validateLength, parseChatId,
} from '../src/assets/js/validators.js';

const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0';

test('validateToken', () => {
  assert.equal(validateToken(TOKEN), null);
  assert.equal(validateToken(`  ${TOKEN}  `), null);
  assert.equal(validateToken('123456789'), 'token_format');
  assert.equal(validateToken('abc:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0'), 'token_format');
  assert.equal(validateToken('123:short'), 'token_format');
  assert.equal(validateToken(`${TOKEN}/getMe`), 'token_format');
});

test('validateApiBase', () => {
  assert.equal(validateApiBase('https://api.telegram.org'), null);
  assert.equal(validateApiBase('https://proxy.example.workers.dev/'), null);
  assert.equal(validateApiBase('http://localhost:8081'), null);
  assert.equal(validateApiBase('http://127.0.0.1:8081'), null);
  assert.equal(validateApiBase('http://example.com'), 'url_https');
  assert.equal(validateApiBase('not a url'), 'url_invalid');
  assert.equal(normalizeApiBase(' https://x.dev/// '), 'https://x.dev');
});

test('validateWebhookUrl', () => {
  assert.equal(validateWebhookUrl('https://example.com/bot'), null);
  assert.equal(validateWebhookUrl('https://example.com:8443/hook'), null);
  assert.equal(validateWebhookUrl('https://example.com:88/hook'), null);
  assert.equal(validateWebhookUrl('https://example.com:8080/hook'), 'url_port');
  assert.equal(validateWebhookUrl('http://example.com/hook'), 'url_https');
  assert.equal(validateWebhookUrl('example.com/hook'), 'url_invalid');
});

test('validateHttpsUrl', () => {
  assert.equal(validateHttpsUrl('https://t.me/mybot/app'), null);
  assert.equal(validateHttpsUrl('http://example.com'), 'url_https');
  assert.equal(validateHttpsUrl(''), 'url_invalid');
});

test('validateSecretToken', () => {
  assert.equal(validateSecretToken(''), null);
  assert.equal(validateSecretToken('abc_DEF-123'), null);
  assert.equal(validateSecretToken('with space'), 'secret_format');
  assert.equal(validateSecretToken('ключ'), 'secret_format');
  assert.equal(validateSecretToken('a'.repeat(256)), null);
  assert.equal(validateSecretToken('a'.repeat(257)), 'secret_format');
});

test('generateSecretToken', () => {
  const token = generateSecretToken();
  assert.equal(token.length, 48);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(generateSecretToken(), token);
  assert.equal(generateSecretToken(256).length, 256);
});

test('validateIpAddress', () => {
  assert.equal(validateIpAddress(''), null);
  assert.equal(validateIpAddress('149.154.167.220'), null);
  assert.equal(validateIpAddress('2001:db8::1'), null);
  assert.equal(validateIpAddress('256.1.1.1'), 'ip_format');
  assert.equal(validateIpAddress('01.1.1.1'), 'ip_format');
  assert.equal(validateIpAddress('example.com'), 'ip_format');
  assert.equal(validateIpAddress('1.2.3'), 'ip_format');
});

test('validateMaxConnections', () => {
  assert.equal(validateMaxConnections('40'), null);
  assert.equal(validateMaxConnections(1), null);
  assert.equal(validateMaxConnections(100), null);
  assert.equal(validateMaxConnections(0), 'max_connections');
  assert.equal(validateMaxConnections(101), 'max_connections');
  assert.equal(validateMaxConnections('4.5'), 'max_connections');
});

test('validateLanguageCode', () => {
  assert.equal(validateLanguageCode(''), null);
  assert.equal(validateLanguageCode('ru'), null);
  assert.equal(validateLanguageCode('RU'), 'language_code');
  assert.equal(validateLanguageCode('rus'), 'language_code');
});

test('validateChatId / validateUserId / parseChatId', () => {
  assert.equal(validateChatId('-1001234567890'), null);
  assert.equal(validateChatId('123'), null);
  assert.equal(validateChatId('@my_group'), null);
  assert.equal(validateChatId('my_group'), 'chat_id');
  assert.equal(validateUserId('42'), null);
  assert.equal(validateUserId('-42'), 'user_id');
  assert.equal(parseChatId(' -1001234567890 '), -1001234567890);
  assert.equal(parseChatId('@my_group'), '@my_group');
});

test('validateLength counts code points', () => {
  assert.equal(validateLength('😀'.repeat(64), 64), null);
  assert.equal(validateLength('a'.repeat(65), 64), 'too_long');
});
