const fs = require('fs');
const uniq = require('lodash/fp/uniq');
const matchAll = require('string.prototype.matchall')

/**
 * Given the contents of a Cargo.toml, extract the list of pallet names.
 */
function parseDeps(text: string) : string[] {
 return uniq(Array.from(matchAll(text, /'(pallet-[a-z-A-Z0-9]+)'/g)).map((match: any) => match[1]));
}

/**
 * Given a path to a Cargo.toml, extract the list of pallet names.
 */
export default function parseDepsFromFile(file: string) {
  return parseDeps(fs.readFileSync(file).toString());
}