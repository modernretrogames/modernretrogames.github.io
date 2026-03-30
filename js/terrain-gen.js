import { seed as noiseSeed, fbm, ridgedFbm } from './noise.js';
import { VoxelType } from './voxel-world.js';

export const terrainConfig = {
    baseHeight: 6,
    hillHeight: 22,
    noiseScale: 0.012,
    octaves: 6,
    lacunarity: 2.0,
    persistence: 0.48,
    grassDepth: 1,
    dirtDepth: 4,
    waterLevel: 11,
    warpStrength: 6.0,
    ridgeBlend: 0.35,
    sandDepth: 2,
};

export function generateTerrain(world, seedValue = 42) {
    noiseSeed(seedValue);

    const cfg = terrainConfig;
    const waterY = cfg.waterLevel;

    for (let z = 0; z < world.sizeZ; z++) {
        for (let x = 0; x < world.sizeX; x++) {
            const nx = x * cfg.noiseScale;
            const nz = z * cfg.noiseScale;

            const warpX = fbm(nx + 7.8, nz + 3.2, 3, 2.0, 0.5) * cfg.warpStrength * cfg.noiseScale;
            const warpZ = fbm(nx + 1.4, nz + 9.6, 3, 2.0, 0.5) * cfg.warpStrength * cfg.noiseScale;

            const wx = nx + warpX;
            const wz = nz + warpZ;

            const base = fbm(wx, wz, cfg.octaves, cfg.lacunarity, cfg.persistence);
            const ridged = ridgedFbm(wx * 1.2, wz * 1.2, 5, 2.2, 0.45);

            const combined = base * (1 - cfg.ridgeBlend) + ridged * cfg.ridgeBlend;

            const height = Math.floor(cfg.baseHeight + (combined + 1) * 0.5 * cfg.hillHeight);
            const h = Math.min(height, world.sizeY - 1);

            const nearWater = h <= waterY + cfg.sandDepth && h >= waterY - 1;

            for (let y = 0; y <= h; y++) {
                let type;
                if (nearWater && y >= h - cfg.sandDepth) {
                    type = VoxelType.SAND;
                } else if (y >= h - cfg.grassDepth + 1) {
                    type = VoxelType.GRASS;
                } else if (y >= h - cfg.grassDepth - cfg.dirtDepth + 1) {
                    type = VoxelType.DIRT;
                } else {
                    type = VoxelType.ROCK;
                }
                world.data[world._index(x, y, z)] = type;
            }

            for (let y = h + 1; y <= waterY; y++) {
                if (y < world.sizeY) {
                    world.data[world._index(x, y, z)] = VoxelType.WATER;
                }
            }
        }
    }
}
