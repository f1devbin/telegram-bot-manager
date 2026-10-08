// Telegram Bot API reference data. Keep in sync with https://core.telegram.org/bots/api
export const BOT_API_VERSION = '10.3';

export const DEFAULT_API_BASE = 'https://api.telegram.org';

// Update types grouped for the allowed_updates picker.
// `optIn: true` — not delivered unless explicitly listed in allowed_updates.
export const UPDATE_GROUPS = [
  {
    id: 'messages',
    types: [
      { type: 'message' },
      { type: 'edited_message' },
      { type: 'channel_post' },
      { type: 'edited_channel_post' },
      { type: 'guest_message' },
    ],
  },
  {
    id: 'interactions',
    types: [
      { type: 'callback_query' },
      { type: 'inline_query' },
      { type: 'chosen_inline_result' },
      { type: 'message_reaction', optIn: true },
      { type: 'message_reaction_count', optIn: true },
      { type: 'stopped_message_generation' },
    ],
  },
  {
    id: 'members',
    types: [
      { type: 'my_chat_member' },
      { type: 'chat_member', optIn: true },
      { type: 'chat_join_request' },
      { type: 'chat_boost' },
      { type: 'removed_chat_boost' },
    ],
  },
  {
    id: 'payments',
    types: [
      { type: 'shipping_query' },
      { type: 'pre_checkout_query' },
      { type: 'purchased_paid_media' },
      { type: 'subscription' },
    ],
  },
  {
    id: 'business',
    types: [
      { type: 'business_connection' },
      { type: 'business_message' },
      { type: 'edited_business_message' },
      { type: 'deleted_business_messages' },
    ],
  },
  {
    id: 'other',
    types: [
      { type: 'poll' },
      { type: 'poll_answer' },
      { type: 'managed_bot' },
    ],
  },
];

export const UPDATE_TYPES = UPDATE_GROUPS.flatMap((g) => g.types.map((t) => t.type));
export const OPT_IN_UPDATE_TYPES = UPDATE_GROUPS.flatMap((g) => g.types.filter((t) => t.optIn).map((t) => t.type));

// ChatAdministratorRights. `target`: where the right applies.
export const ADMIN_RIGHTS = [
  { key: 'is_anonymous', target: 'both' },
  { key: 'can_manage_chat', target: 'both' },
  { key: 'can_delete_messages', target: 'both' },
  { key: 'can_manage_video_chats', target: 'both' },
  { key: 'can_restrict_members', target: 'both' },
  { key: 'can_promote_members', target: 'both' },
  { key: 'can_change_info', target: 'both' },
  { key: 'can_invite_users', target: 'both' },
  { key: 'can_post_stories', target: 'both' },
  { key: 'can_edit_stories', target: 'both' },
  { key: 'can_delete_stories', target: 'both' },
  { key: 'can_send_welcome_messages', target: 'both' },
  { key: 'can_post_messages', target: 'channels' },
  { key: 'can_edit_messages', target: 'channels' },
  { key: 'can_manage_direct_messages', target: 'channels' },
  { key: 'can_pin_messages', target: 'groups' },
  { key: 'can_manage_topics', target: 'groups' },
  { key: 'can_manage_tags', target: 'groups' },
];

export function rightsFor(forChannels) {
  const target = forChannels ? 'channels' : 'groups';
  return ADMIN_RIGHTS.filter((r) => r.target === 'both' || r.target === target);
}

// Bot-only User fields returned by getMe.
export const ME_FLAGS = [
  'can_join_groups',
  'can_read_all_group_messages',
  'supports_inline_queries',
  'can_connect_to_business',
  'has_main_web_app',
  'has_topics_enabled',
  'allows_users_to_create_topics',
  'supports_guest_queries',
  'supports_join_request_queries',
  'can_manage_bots',
];

export const COMMAND_SCOPES = [
  { type: 'default' },
  { type: 'all_private_chats' },
  { type: 'all_group_chats' },
  { type: 'all_chat_administrators' },
  { type: 'chat', chatId: true },
  { type: 'chat_administrators', chatId: true },
  { type: 'chat_member', chatId: true, userId: true },
];

// ISO 639-1 codes offered in language pickers (any two-letter code is accepted by the API).
export const LANGUAGE_CODES = [
  ['ar', 'العربية'], ['be', 'Беларуская'], ['bn', 'বাংলা'], ['cs', 'Čeština'], ['de', 'Deutsch'],
  ['en', 'English'], ['es', 'Español'], ['fa', 'فارسی'], ['fr', 'Français'], ['he', 'עברית'],
  ['hi', 'हिन्दी'], ['id', 'Bahasa Indonesia'], ['it', 'Italiano'], ['ja', '日本語'], ['kk', 'Қазақ'],
  ['ko', '한국어'], ['ms', 'Bahasa Melayu'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['pt', 'Português'],
  ['ro', 'Română'], ['ru', 'Русский'], ['sr', 'Српски'], ['sv', 'Svenska'], ['th', 'ไทย'],
  ['tr', 'Türkçe'], ['uk', 'Українська'], ['uz', 'Oʻzbek'], ['vi', 'Tiếng Việt'], ['zh', '中文'],
];

export const LIMITS = {
  name: 64,
  shortDescription: 120,
  description: 512,
  commands: 100,
  commandName: 32,
  commandDescription: 256,
  secretToken: 256,
  maxConnectionsMin: 1,
  maxConnectionsMax: 100,
};

export const WEBHOOK_PORTS = [443, 80, 88, 8443];
