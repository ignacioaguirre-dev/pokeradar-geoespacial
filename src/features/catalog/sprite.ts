// PokéAPI's static front sprite, derived from the id: the markers and the list need no detail request
export function spriteUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}
