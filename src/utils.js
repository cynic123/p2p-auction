const crypto = require('crypto');

module.exports = {
  generateId: () => crypto.randomBytes(16).toString('hex'),
  serialize: (obj) => Buffer.from(JSON.stringify(obj), 'utf-8'),
  deserialize: (buffer) => JSON.parse(buffer.toString('utf-8')),

  generateVectorClock: (nodeId) => ({ [nodeId]: Date.now() }),

  mergeVectorClocks: (clockA, clockB) => {
    const mergedClock = { ...clockA };
    for (const nodeId in clockB) {
      if (!mergedClock[nodeId] || clockB[nodeId] > mergedClock[nodeId]) {
        mergedClock[nodeId] = clockB[nodeId];
      }
    }
    return mergedClock;
  },

  isClockAhead: (clockA, clockB) => {
    for (const nodeId in clockB) {
      if (clockA[nodeId] > clockB[nodeId]) {
        return true;
      }
    }
    return false;
  }
};