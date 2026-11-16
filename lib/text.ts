/** Lowercase + strip diacritics, so "kenga", "këngë" and "KENGE" all match. */
export function normalize(str: string) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9@&\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Noizy, DJ Gimi O & Stresi" -> ["Noizy", "DJ Gimi O", "Stresi"] */
export function splitArtists(a?: string) {
  return (a || '')
    .split(/[,;/]|\s+(?:&|ft\.?|feat\.?|x)\s+/i)
    .map((x) => x.trim())
    .filter((x) => x.length > 1);
}
