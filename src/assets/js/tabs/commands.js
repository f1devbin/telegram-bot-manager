import { t } from '../i18n.js';
import { COMMAND_SCOPES, LIMITS } from '../data.js';
import { parseCommands, formatCommands } from '../commands.js';
import { validateChatId, validateUserId, parseChatId } from '../validators.js';
import { $, el, toast, showError, withBusy, applyValidation, showCurl, confirmAction } from '../ui.js';

let app;

const scopeDef = () => COMMAND_SCOPES.find((s) => s.type === $('#cmd-scope').value);

// Returns { scope, language_code } or null when chat_id/user_id are invalid.
function collectTarget() {
  const def = scopeDef();
  const chatInput = $('#cmd-chat-id');
  const userInput = $('#cmd-user-id');
  const valid = applyValidation([
    [chatInput, def.chatId ? validateChatId(chatInput.value) : null],
    [userInput, def.userId ? validateUserId(userInput.value) : null],
  ]);
  if (!valid) return null;

  const scope = { type: def.type };
  if (def.chatId) scope.chat_id = parseChatId(chatInput.value);
  if (def.userId) scope.user_id = Number(userInput.value.trim());
  return {
    scope: def.type === 'default' ? undefined : scope,
    language_code: $('#cmd-lang').value || undefined,
  };
}

function validateText() {
  const { commands, errors } = parseCommands($('#cmd-text').value);
  $('#cmd-count').textContent = `${commands.length}/${LIMITS.commands}`;
  $('#cmd-count').classList.toggle('over', commands.length > LIMITS.commands);
  $('#cmd-errors').replaceChildren(...errors.map((e) => el('li', {},
    e.line ? `${t('commands.line', { n: e.line })}: ` : '',
    t(`validation.${e.code}`, { value: e.value ?? '', max: LIMITS.commandName }))));
  return { commands, errors };
}

function onScopeChange() {
  const def = scopeDef();
  $('#cmd-chat-field').hidden = !def.chatId;
  $('#cmd-user-field').hidden = !def.userId;
  $('#cmd-scope-hint').textContent = t(`scopes.${def.type}.hint`);
  if (!def.chatId) load().catch(showError);
}

async function load() {
  const target = collectTarget();
  if (!target) return;
  const commands = await app.api.call('getMyCommands', target);
  $('#cmd-text').value = formatCommands(commands);
  validateText();
}

function collectSet() {
  const target = collectTarget();
  if (!target) return null;
  const { commands, errors } = validateText();
  if (errors.length) {
    $('#cmd-text').focus();
    return null;
  }
  return { method: 'setMyCommands', params: { commands, ...target } };
}

export default {
  id: 'commands',
  init(appState) {
    app = appState;
    const form = $('#commands-form');
    $('#cmd-scope').replaceChildren(...COMMAND_SCOPES.map((s) => el('option', { value: s.type }, `${t(`scopes.${s.type}.label`)} (${s.type})`)));
    $('#cmd-scope').addEventListener('change', onScopeChange);
    $('#cmd-lang').addEventListener('change', () => load().catch(showError));
    $('#cmd-text').addEventListener('input', validateText);
    $('#cmd-scope-hint').textContent = t('scopes.default.hint');
    validateText();

    $('#cmd-load').addEventListener('click', (event) => withBusy(event.currentTarget, () => load().catch(showError)));
    $('[data-curl]', form).addEventListener('click', () => showCurl(form, collectSet(), app.api.baseUrl));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const request = collectSet();
      if (!request) return;
      await withBusy(event.submitter, async () => {
        try {
          await app.api.call(request.method, request.params);
          toast(t('commands.saved', { n: request.params.commands.length }));
        } catch (error) {
          showError(error);
        }
      });
    });

    $('#cmd-delete').addEventListener('click', (event) => {
      const target = collectTarget();
      if (!target || !confirmAction(t('commands.deleteConfirm'))) return;
      withBusy(event.currentTarget, async () => {
        try {
          await app.api.call('deleteMyCommands', target);
          $('#cmd-text').value = '';
          validateText();
          toast(t('commands.deleted'));
        } catch (error) {
          showError(error);
        }
      });
    });
  },
  load,
};
