type Defined<T> = { [K in keyof T]-?: Exclude<T[K], undefined> };

/**
 * Drops keys whose value is undefined. Use when applying a partial update, so a field
 * that wasn't sent never overwrites an existing value.
 */
export function definedOnly<T extends object>(obj: T): Partial<Defined<T>> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<
    Defined<T>
  >;
}
