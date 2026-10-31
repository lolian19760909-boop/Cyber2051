// Derived from SillyTavern 1.19.0 public/scripts/openai.js; AGPL-3.0. See SOURCE.json and LICENSE.
const default_impersonation_prompt = '[Write your next reply from the point of view of {{user}}, using the chat history so far as a guideline for the writing style of {{user}}. Don\'t write as {{char}} or system. Don\'t describe actions of {{char}}.]';

const default_new_chat_prompt = '[Start a new Chat]';

const default_new_group_chat_prompt = '[Start a new group chat. Group members: {{group}}]';

const default_new_example_chat_prompt = '[Example Chat]';

const default_continue_nudge_prompt = '[Continue your last message without repeating its original content.]';

const default_scenario_format = '{{scenario}}';

const default_personality_format = '{{personality}}';

const default_group_nudge_prompt = '[Write the next reply only as {{char}}.]';
export const NATIVE_PROMPT_DEFAULTS={impersonation_prompt:default_impersonation_prompt,new_chat_prompt:default_new_chat_prompt,new_group_chat_prompt:default_new_group_chat_prompt,new_example_chat_prompt:default_new_example_chat_prompt,continue_nudge_prompt:default_continue_nudge_prompt,scenario_format:default_scenario_format,personality_format:default_personality_format,group_nudge_prompt:default_group_nudge_prompt,wi_format:'{0}'};
