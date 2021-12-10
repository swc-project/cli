import fs from "fs";
import type { Stats } from "fs";

export interface MockHelpers {
  resetMockStats: () => void;
  setMockStats: (stats: Record<string, Stats | Error>) => void;
}

const fsMock = jest.createMockFromModule<typeof fs & MockHelpers>("fs");

let mockStats: Record<string, Stats | Error> = {};

function setMockStats(stats: Record<string, Stats | Error>) {
  Object.entries(stats).forEach(([path, stats]) => {
    mockStats[path] = stats;
  });
}
function resetMockStats() {
  mockStats = {};
}

export function stat(path: string, cb: (err?: Error, stats?: Stats) => void) {
  const result = mockStats[path];
  if (result instanceof Error) {
    cb(result, undefined);
  } else {
    cb(undefined, result);
  }
}

fsMock.setMockStats = setMockStats;
fsMock.resetMockStats = resetMockStats;

fsMock.stat = stat as typeof fs.stat;

export default fsMock;
