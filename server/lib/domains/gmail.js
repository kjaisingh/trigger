export async function resolveSubject(subject) {
  const from = subject?.from;
  if (!from) {
    throw new Error('Gmail triggers need a sender to watch for.');
  }

  return { from };
}
