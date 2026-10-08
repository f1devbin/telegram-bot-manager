import { t } from '../i18n.js';
import { LIMITS } from '../data.js';
import { validateLength } from '../validators.js';
import {
  $, $$, toast, showError, withBusy, applyValidation, showCurl, confirmAction, radioValue, setValue, describeError,
} from '../ui.js';

let app;
let original = { name: '', short: '', description: '' };

const FIELDS = [
  { key: 'name', input: 'profile-name', method: 'setMyName', param: 'name', max: LIMITS.name },
  { key: 'short', input: 'profile-short', method: 'setMyShortDescription', param: 'short_description', max: LIMITS.shortDescription },
  { key: 'description', input: 'profile-description', method: 'setMyDescription', param: 'description', max: LIMITS.description },
];

const language = () => $('#profile-lang').value;

async function load() {
  const params = { language_code: language() || undefined };
  const [name, short, description] = await Promise.all([
    app.api.call('getMyName', params),
    app.api.call('getMyShortDescription', params),
    app.api.call('getMyDescription', params),
  ]);
  original = { name: name.name ?? '', short: short.short_description ?? '', description: description.description ?? '' };
  for (const field of FIELDS) setValue($(`#${field.input}`), original[field.key]);
}

// Only changed fields are sent: setMyName in particular has a strict rate limit.
function collectRequests() {
  const valid = applyValidation(FIELDS.map((f) => {
    const input = $(`#${f.input}`);
    return [input, validateLength(input.value, f.max), { max: f.max }];
  }));
  if (!valid) return null;
  return FIELDS
    .filter((f) => $(`#${f.input}`).value !== original[f.key])
    .map((f) => ({
      field: f,
      method: f.method,
      params: { [f.param]: $(`#${f.input}`).value, language_code: language() || undefined },
    }));
}

function initProfileForm() {
  const form = $('#profile-form');
  $('#profile-lang').addEventListener('change', () => load().catch(showError));

  $('[data-curl]', form).addEventListener('click', () => {
    const requests = collectRequests();
    if (requests && requests.length === 0) toast(t('profile.noChanges'), 'info');
    showCurl(form, requests ?? [], app.api.baseUrl);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const requests = collectRequests();
    if (!requests) return;
    if (requests.length === 0) {
      toast(t('profile.noChanges'), 'info');
      return;
    }
    await withBusy(event.submitter, async () => {
      const failed = [];
      for (const request of requests) {
        try {
          await app.api.call(request.method, request.params);
          original[request.field.key] = request.params[request.field.param];
        } catch (error) {
          failed.push(`${t(`profile.fields.${request.field.key}`)}: ${describeError(error)}`);
        }
      }
      if (failed.length === 0) toast(t('profile.saved'));
      else toast(failed.join('\n'), 'error');
      if (requests.some((r) => r.field.key === 'name') && !language()) {
        try {
          app.me = await app.api.call('getMe');
          $('#bot-name').textContent = app.me.first_name;
        } catch { /* sidebar refresh is best effort */ }
      }
    });
  });
}

function initPhotoForm() {
  const form = $('#photo-form');
  const fileInput = $('#photo-file');

  for (const radio of $$('input[name="photo-type"]')) {
    radio.addEventListener('change', () => {
      const animated = radioValue('photo-type') === 'animated';
      $('#photo-frame-field').hidden = !animated;
      $('#photo-hint-static').hidden = animated;
      $('#photo-hint-animated').hidden = !animated;
      fileInput.accept = animated ? 'video/mp4' : 'image/jpeg,image/png';
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = fileInput.files[0];
    if (!applyValidation([[fileInput, file ? null : 'file_required']])) return;
    const animated = radioValue('photo-type') === 'animated';
    const photo = animated
      ? { type: 'animated', animation: 'attach://profile_photo', main_frame_timestamp: Number($('#photo-frame').value) || 0 }
      : { type: 'static', photo: 'attach://profile_photo' };

    await withBusy(event.submitter, async () => {
      try {
        await app.api.call('setMyProfilePhoto', { photo }, { profile_photo: file });
        toast(t('photo.saved'));
        fileInput.value = '';
        app.loadAvatar();
      } catch (error) {
        showError(error);
      }
    });
  });

  $('#photo-remove').addEventListener('click', (event) => {
    if (!confirmAction(t('photo.removeConfirm'))) return;
    withBusy(event.currentTarget, async () => {
      try {
        await app.api.call('removeMyProfilePhoto');
        toast(t('photo.removed'));
        app.loadAvatar();
      } catch (error) {
        showError(error);
      }
    });
  });
}

export default {
  id: 'profile',
  init(appState) {
    app = appState;
    initProfileForm();
    initPhotoForm();
  },
  load,
};
