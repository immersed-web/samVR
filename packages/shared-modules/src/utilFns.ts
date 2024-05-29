
export function extractMessageFromCatch(e: unknown, fallbackMessage?: string) {
  if (e instanceof Error) {
    // console.log('error was instance of Error:', e, e.name, e.stack);
    // console.log(e.message);
    return e.message;
  } else if (typeof e === 'string') {
    // console.log('error was of type string', e);
    return e;
  } else if (fallbackMessage) {
    return fallbackMessage;
  }
  return 'there was an error!'
}

export function exclude<Object, Key extends keyof Object>(
  user: Object,
  ...keys: Key[]
): Omit<Object, Key> {
  for (const key of keys) {
    delete user[key];
  }
  return user;
}

// export function slugifyString(text: string) {

// }
