export function safeReturnPath(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\r\n]/.test(value)
  )
    return '/dashboard';
  const url = new URL(value, 'https://trigger.local');
  return url.origin === 'https://trigger.local' && url.pathname !== '/auth'
    ? `${url.pathname}${url.search}${url.hash}`
    : '/dashboard';
}
