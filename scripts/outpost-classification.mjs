/** Source-model names used only by offline preparation, never as runtime paths. */
export function isOutpostInterior(name) {
  return /^(FURNISHED INTERIORS|FURNISHINGS|ROOM_|V8 \/ (INNER|INTERIOR|CEILING))/.test(name)
    || /detailed cabin liner|end wall liner|interior pressure panel|Crew cabin jamb|Crew partition|Crew number|Washroom privacy|Wet room partition|Workshop divider|ceiling diffuser|ceiling light|lower-deck ceiling/.test(name);
}
