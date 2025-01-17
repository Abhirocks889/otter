/** Reviver type */
export type ReviverType<T, V extends { [key: string]: any} = { [key: string]: any}, D extends { [key: string]: any} = { [key: string]: any}> = (data: V, dictionary?: D) => T | undefined;

/**
 * Used in case of maps (dictionaries): All values of the map must be of the same type. reviveWithType will be called
 * for each of these elements.
 * @param dictionaries
 * @param reviver
 */
export function reviveMap<T>(data: { [key: string]: any }, dictionaries: any = null, reviver: ReviverType<T>) {
  if (!data) { return undefined; }

  const revived: { [key: string]: any } = {};
  for (const key in data) {
    // eslint-disable-next-line no-prototype-builtins
    if (data.hasOwnProperty(key)) {
      revived[key] = reviver(data[key], dictionaries);
    }
  }

  return revived;
}

/**
 * Used in case of arrays: It will call the reviveWithType for each element of the array.
 * @param data
 * @param dictionaries
 * @param reviver
 */
export function reviveArray<T>(data: any[], dictionaries: any = null, reviver: ReviverType<T>) {
  if (!data) { return undefined; }
  for (let i = 0; i < data.length; i++) {
    data[i] = reviver(data[i], dictionaries);
  }
  return data as T[];
}

/**
 * Used in case of arrays dictionarized Array
 * @param ids : list of the ids to be able to get the associated values from the dictionary
 * @param dictionary : Specific dictionary associated to T
 * @param reviver : Function to revive the Data object, once retrieved from the dictionary.
 * If not passed as argument, the map entry won't be revived
 * @returns Map of id : {revived dictionarized item}
 */
export function reviveDictionarizedArray<T>(ids: string[], dictionary: any, reviver?: ReviverType<T>) {
  if (!ids) { return undefined; }
  return ids.reduce<{[key: string]: T | undefined}>((map, id) => {
    map[id] = reviver ? reviver(dictionary[id], dictionary) : dictionary[id];
    return map;
  }, {});
}
