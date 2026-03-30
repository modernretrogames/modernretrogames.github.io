import * as THREE from 'three';
import { VoxelType } from './voxel-world.js';

export const chunkMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

const FACES = [
    { dir: [ 0,  1,  0], corners: [[0,1,0],[1,1,0],[1,1,1],[0,1,1]], normal: [0,1,0] },
    { dir: [ 0, -1,  0], corners: [[1,0,0],[0,0,0],[0,0,1],[1,0,1]], normal: [0,-1,0] },
    { dir: [-1,  0,  0], corners: [[0,0,1],[0,0,0],[0,1,0],[0,1,1]], normal: [-1,0,0] },
    { dir: [ 1,  0,  0], corners: [[1,0,0],[1,0,1],[1,1,1],[1,1,0]], normal: [1,0,0] },
    { dir: [ 0,  0, -1], corners: [[0,0,0],[1,0,0],[1,1,0],[0,1,0]], normal: [0,0,-1] },
    { dir: [ 0,  0,  1], corners: [[1,0,1],[0,0,1],[0,1,1],[1,1,1]], normal: [0,0,1] },
];

const TYPE_COLORS = {
    [VoxelType.GRASS]:        { top: [0.36, 0.62, 0.20], side: [0.45, 0.35, 0.20], bottom: [0.40, 0.30, 0.18] },
    [VoxelType.DIRT]:         { top: [0.50, 0.38, 0.24], side: [0.45, 0.35, 0.20], bottom: [0.40, 0.30, 0.18] },
    [VoxelType.ROCK]:         { top: [0.55, 0.55, 0.55], side: [0.50, 0.50, 0.50], bottom: [0.45, 0.45, 0.45] },
    [VoxelType.SAND]:         { top: [0.85, 0.78, 0.55], side: [0.80, 0.73, 0.50], bottom: [0.75, 0.68, 0.45] },
    [VoxelType.BURNED_GRASS]: { top: [0.20, 0.18, 0.10], side: [0.22, 0.18, 0.10], bottom: [0.18, 0.15, 0.08] },
    [VoxelType.BURNED_DIRT]:  { top: [0.25, 0.20, 0.12], side: [0.22, 0.18, 0.10], bottom: [0.18, 0.15, 0.08] },
    [VoxelType.WATER]:        { top: [0.15, 0.35, 0.65], side: [0.12, 0.30, 0.58], bottom: [0.10, 0.25, 0.50] },
};

function getColor(voxelType, faceIndex) {
    const palette = TYPE_COLORS[voxelType];
    if (!palette) return [1, 0, 1];
    if (faceIndex === 0) return palette.top;
    if (faceIndex === 1) return palette.bottom;
    return palette.side;
}

export function buildChunkMesh(world, cx, cy, cz) {
    const cs = world.chunkSize;
    const vs = world.voxelSize;
    const startX = cx * cs;
    const startY = cy * cs;
    const startZ = cz * cs;

    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];

    let vertCount = 0;

    for (let y = 0; y < cs; y++) {
        const vy = startY + y;
        if (vy >= world.sizeY) continue;
        for (let z = 0; z < cs; z++) {
            const vz = startZ + z;
            if (vz >= world.sizeZ) continue;
            for (let x = 0; x < cs; x++) {
                const vx = startX + x;
                if (vx >= world.sizeX) continue;

                const voxel = world.getVoxel(vx, vy, vz);
                if (voxel === VoxelType.AIR) continue;

                const isWater = voxel === VoxelType.WATER;

                for (let fi = 0; fi < FACES.length; fi++) {
                    const face = FACES[fi];
                    const nx = vx + face.dir[0];
                    const ny = vy + face.dir[1];
                    const nz = vz + face.dir[2];

                    const neighbor = world.getVoxel(nx, ny, nz);

                    let drawFace;
                    if (isWater) {
                        drawFace = neighbor === VoxelType.AIR;
                    } else {
                        drawFace = neighbor === VoxelType.AIR || neighbor === VoxelType.WATER;
                    }
                    if (!drawFace) continue;

                    const col = getColor(voxel, fi);
                    const shade = 0.95 + Math.random() * 0.1;

                    for (const corner of face.corners) {
                        positions.push(
                            (x + corner[0]) * vs,
                            (y + corner[1]) * vs,
                            (z + corner[2]) * vs
                        );
                        normals.push(face.normal[0], face.normal[1], face.normal[2]);
                        colors.push(
                            col[0] * shade,
                            col[1] * shade,
                            col[2] * shade
                        );
                    }

                    indices.push(
                        vertCount, vertCount + 2, vertCount + 1,
                        vertCount, vertCount + 3, vertCount + 2
                    );
                    vertCount += 4;
                }
            }
        }
    }

    if (vertCount === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
}
