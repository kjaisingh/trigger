import { isValidCondition, METRICS_BY_DOMAIN } from './domains/allowlist.js';
import { isPushEndpoint } from '../../supabase/functions/_shared/push.js';

export class PublicError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

function text(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new PublicError(`${label} must be between 1 and ${maxLength} characters.`);
  }
  return value.trim();
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PublicError(`${label} must be an object.`);
  }
  return value;
}

export function validatePrompt(body) {
  return text(object(body, 'Request').raw_prompt, 'raw_prompt', 500);
}

export function validateTrigger(body) {
  object(body, 'Request');
  const raw_prompt = validatePrompt(body);
  const domain = body.domain;
  if (domain === 'unsupported') {
    const unsupported_reason =
      body.unsupported_reason == null
        ? "This request isn't supported yet."
        : text(body.unsupported_reason, 'unsupported_reason', 300);
    return { raw_prompt, domain, unsupported_reason };
  }
  if (!Object.hasOwn(METRICS_BY_DOMAIN, domain)) {
    throw new PublicError('Unsupported domain.');
  }
  const inputSubject = object(body.subject, 'subject');
  const subject = {};
  if (domain === 'weather') subject.location = text(inputSubject.location, 'location', 100);
  if (domain === 'sports') {
    subject.team = text(inputSubject.team, 'team', 100);
    if (inputSubject.opponent != null && inputSubject.opponent !== '') {
      subject.opponent = text(inputSubject.opponent, 'opponent', 100);
    }
  }
  if (domain === 'crypto')
    subject.coin_id = text(inputSubject.coin_id, 'coin_id', 100).toLowerCase();
  if (!isValidCondition(domain, body.condition)) {
    throw new PublicError('Invalid condition for this domain.');
  }
  const channels = body.channels ?? ['push'];
  if (!Array.isArray(channels) || channels.length !== 1 || channels[0] !== 'push') {
    throw new PublicError('channels must contain only "push".');
  }
  if (typeof body.recurring !== 'boolean') {
    throw new PublicError('recurring must be a boolean.');
  }
  return {
    raw_prompt,
    domain,
    subject,
    condition: body.condition,
    channels,
    recurring: body.recurring,
  };
}

export function validatePushSubscription(value) {
  const subscription = object(value, 'subscription');
  const endpoint = validatePushEndpoint(subscription.endpoint);
  const keys = object(subscription.keys, 'keys');
  const p256dh = text(keys.p256dh, 'p256dh', 100);
  const auth = text(keys.auth, 'auth', 30);
  if (
    !/^[A-Za-z0-9_-]+={0,2}$/.test(p256dh) ||
    !/^[A-Za-z0-9_-]+={0,2}$/.test(auth) ||
    Buffer.from(p256dh, 'base64url').length !== 65 ||
    Buffer.from(p256dh, 'base64url')[0] !== 4 ||
    Buffer.from(auth, 'base64url').length !== 16
  )
    throw new PublicError('Invalid push encryption keys.');
  return {
    endpoint,
    keys: { p256dh, auth },
  };
}

export function validatePushEndpoint(value) {
  const endpoint = text(value, 'endpoint', 2048);
  if (!isPushEndpoint(endpoint)) throw new PublicError('Use a supported browser push endpoint.');
  return endpoint;
}
