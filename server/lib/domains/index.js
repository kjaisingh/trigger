import * as weather from './weather.js';
import * as sports from './sports.js';
import * as crypto from './crypto.js';

export const DOMAINS = { weather, sports, crypto };

export async function resolveSubject(domain, subject) {
  const handler = DOMAINS[domain];
  if (!handler) {
    throw new Error(`Unsupported domain: ${domain}`);
  }
  return handler.resolveSubject(subject);
}
