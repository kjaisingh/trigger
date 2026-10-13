import { isValidCondition, METRICS_BY_DOMAIN } from './domains/allowlist.js';

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
  const subject = object(body.subject, 'subject');
  if (domain === 'weather') text(subject.location, 'location', 100);
  if (domain === 'sports') {
    text(subject.team, 'team', 100);
    if (subject.opponent != null && subject.opponent !== '') {
      text(subject.opponent, 'opponent', 100);
    }
  }
  if (domain === 'crypto') text(subject.coin_id, 'coin_id', 100);
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
  const endpoint = text(subscription.endpoint, 'endpoint', 2048);
  if (!endpoint.startsWith('https://')) throw new PublicError('endpoint must use HTTPS.');
  const keys = object(subscription.keys, 'keys');
  return {
    endpoint,
    keys: { p256dh: text(keys.p256dh, 'p256dh', 512), auth: text(keys.auth, 'auth', 512) },
  };
}

export function validatePushEndpoint(value) {
  const endpoint = text(value, 'endpoint', 2048);
  if (!endpoint.startsWith('https://')) throw new PublicError('endpoint must use HTTPS.');
  return endpoint;
}
