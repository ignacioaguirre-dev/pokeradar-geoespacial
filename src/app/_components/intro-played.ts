// Module state outlives MapStage remounts (a client navigation away and back), so the flight plays once per page load
export const introPlayed = { current: false };
