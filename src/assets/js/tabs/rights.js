import { t } from '../i18n.js';
import { rightsFor } from '../data.js';
import { $, $$, el, toast, showError, withBusy, showCurl, confirmAction, radioValue } from '../ui.js';

let app;

const forChannels = () => radioValue('rights-target') === 'channels';

function render(rights = {}) {
  $('#rights-grid').replaceChildren(...rightsFor(forChannels()).map(({ key }) => el('label', { class: 'check-card', title: key },
    el('input', { type: 'checkbox', name: 'right', value: key, checked: Boolean(rights[key]) }),
    el('span', {}, t(`rights.${key}`), el('small', {}, el('code', {}, key))))));
}

async function load() {
  const rights = await app.api.call('getMyDefaultAdministratorRights', { for_channels: forChannels() || undefined });
  render(rights);
}

function collect() {
  const rights = Object.fromEntries($$('#rights-grid input[name="right"]').map((box) => [box.value, box.checked]));
  return { method: 'setMyDefaultAdministratorRights', params: { rights, for_channels: forChannels() || undefined } };
}

function toggleAll(checked) {
  for (const box of $$('#rights-grid input[name="right"]')) box.checked = checked;
}

export default {
  id: 'rights',
  init(appState) {
    app = appState;
    const form = $('#rights-form');
    render();
    for (const radio of $$('input[name="rights-target"]')) {
      radio.addEventListener('change', () => load().catch(showError));
    }
    $('#rights-all').addEventListener('click', () => toggleAll(true));
    $('#rights-none').addEventListener('click', () => toggleAll(false));
    $('[data-curl]', form).addEventListener('click', () => showCurl(form, collect(), app.api.baseUrl));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const request = collect();
      await withBusy(event.submitter, async () => {
        try {
          await app.api.call(request.method, request.params);
          toast(t('rights.saved'));
        } catch (error) {
          showError(error);
        }
      });
    });

    $('#rights-clear').addEventListener('click', (event) => {
      if (!confirmAction(t('rights.clearConfirm'))) return;
      withBusy(event.currentTarget, async () => {
        try {
          // Without the rights parameter Telegram clears the defaults.
          await app.api.call('setMyDefaultAdministratorRights', { for_channels: forChannels() || undefined });
          toast(t('rights.cleared'));
          await load();
        } catch (error) {
          showError(error);
        }
      });
    });
  },
  load,
};
