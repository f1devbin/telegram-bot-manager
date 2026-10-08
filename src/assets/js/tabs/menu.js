import { t } from '../i18n.js';
import { validateHttpsUrl, validateUserId } from '../validators.js';
import { $, $$, toast, showError, withBusy, applyValidation, showCurl, radioValue, setRadio } from '../ui.js';

let app;

function chatId() {
  const input = $('#menu-chat-id');
  const value = input.value.trim();
  if (!applyValidation([[input, value ? validateUserId(value) : null]])) return null;
  return { chat_id: value ? Number(value) : undefined };
}

async function load() {
  const target = chatId();
  if (!target) return;
  const button = await app.api.call('getChatMenuButton', target);
  setRadio('menu-type', button.type);
  $('#menu-text').value = button.text ?? '';
  $('#menu-url').value = button.web_app?.url ?? '';
}

function collect() {
  const target = chatId();
  if (!target) return null;
  const type = radioValue('menu-type');
  if (type !== 'web_app') return { method: 'setChatMenuButton', params: { ...target, menu_button: { type } } };

  const text = $('#menu-text');
  const url = $('#menu-url');
  const valid = applyValidation([
    [text, text.value.trim() ? null : 'required'],
    [url, validateHttpsUrl(url.value)],
  ]);
  if (!valid) return null;
  return {
    method: 'setChatMenuButton',
    params: { ...target, menu_button: { type, text: text.value.trim(), web_app: { url: url.value.trim() } } },
  };
}

export default {
  id: 'menu',
  init(appState) {
    app = appState;
    const form = $('#menu-form');
    for (const radio of $$('input[name="menu-type"]')) {
      radio.addEventListener('change', () => { $('#menu-webapp-fields').hidden = radioValue('menu-type') !== 'web_app'; });
    }
    $('#menu-load').addEventListener('click', (event) => withBusy(event.currentTarget, () => load().catch(showError)));
    $('[data-curl]', form).addEventListener('click', () => showCurl(form, collect(), app.api.baseUrl));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const request = collect();
      if (!request) return;
      await withBusy(event.submitter, async () => {
        try {
          await app.api.call(request.method, request.params);
          toast(t('menu.saved'));
        } catch (error) {
          showError(error);
        }
      });
    });
  },
  load,
};
