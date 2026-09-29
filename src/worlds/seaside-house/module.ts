import type { WorldModule } from '@/contracts/world';
import { dropSeasideTextures, prepareSeasideTextures } from './art/textures';
import { SeasideHouseScene } from './Scene';

const worldModule: WorldModule = {
  Scene: SeasideHouseScene,
  preload: (report) => prepareSeasideTextures(report),
  dispose: () => {
    dropSeasideTextures();
  },
};

export default worldModule;
