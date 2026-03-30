import * as THREE from 'three';

export const VoxelType = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    ROCK: 3,
    SAND: 4,
    BURNED_GRASS: 5,
    BURNED_DIRT: 6,
    WATER: 7,
};

export class VoxelWorld {
    constructor(sizeX, sizeY, sizeZ, voxelSize = 0.5) {
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.sizeZ = sizeZ;
        this.voxelSize = voxelSize;
        this.chunkSize = 16;

        this.data = new Uint8Array(sizeX * sizeY * sizeZ);

        this.dirtyChunks = new Set();
        this.chunkMeshes = new Map();

        this._mesherFn = null;
        this._mesherMaterial = null;

        this._worldOffsetX = 0;
        this._worldOffsetZ = 0;
    }

    setWorldOffset(offsetX, offsetZ) {
        this._worldOffsetX = offsetX;
        this._worldOffsetZ = offsetZ;
    }

    setMesher(buildFn, material) {
        this._mesherFn = buildFn;
        this._mesherMaterial = material;
    }

    _index(x, y, z) {
        return x + z * this.sizeX + y * this.sizeX * this.sizeZ;
    }

    inBounds(x, y, z) {
        return x >= 0 && x < this.sizeX &&
               y >= 0 && y < this.sizeY &&
               z >= 0 && z < this.sizeZ;
    }

    getVoxel(x, y, z) {
        if (!this.inBounds(x, y, z)) return VoxelType.AIR;
        return this.data[this._index(x, y, z)];
    }

    setVoxel(x, y, z, type) {
        if (!this.inBounds(x, y, z)) return;
        this.data[this._index(x, y, z)] = type;
        this.markChunkDirtyAt(x, y, z);
    }

    markChunkDirtyAt(x, y, z) {
        const cs = this.chunkSize;
        const cx = Math.floor(x / cs);
        const cy = Math.floor(y / cs);
        const cz = Math.floor(z / cs);
        this.dirtyChunks.add(`${cx},${cy},${cz}`);

        if (x % cs === 0 && cx > 0) this.dirtyChunks.add(`${cx - 1},${cy},${cz}`);
        if (x % cs === cs - 1) this.dirtyChunks.add(`${cx + 1},${cy},${cz}`);
        if (y % cs === 0 && cy > 0) this.dirtyChunks.add(`${cx},${cy - 1},${cz}`);
        if (y % cs === cs - 1) this.dirtyChunks.add(`${cx},${cy + 1},${cz}`);
        if (z % cs === 0 && cz > 0) this.dirtyChunks.add(`${cx},${cy},${cz - 1}`);
        if (z % cs === cs - 1) this.dirtyChunks.add(`${cx},${cy},${cz + 1}`);
    }

    getChunkForVoxel(x, y, z) {
        const cs = this.chunkSize;
        return {
            cx: Math.floor(x / cs),
            cy: Math.floor(y / cs),
            cz: Math.floor(z / cs),
        };
    }

    worldToVoxel(wx, wy, wz) {
        return {
            x: Math.floor(wx / this.voxelSize),
            y: Math.floor(wy / this.voxelSize),
            z: Math.floor(wz / this.voxelSize),
        };
    }

    voxelToWorld(vx, vy, vz) {
        return {
            x: vx * this.voxelSize,
            y: vy * this.voxelSize,
            z: vz * this.voxelSize,
        };
    }

    getHighestSolidY(vx, vz) {
        for (let y = this.sizeY - 1; y >= 0; y--) {
            const v = this.getVoxel(vx, y, vz);
            if (v !== VoxelType.AIR && v !== VoxelType.WATER) return y;
        }
        return -1;
    }

    rebuildDirtyChunks(scene) {
        if (this.dirtyChunks.size === 0) return;

        for (const key of this.dirtyChunks) {
            const [cx, cy, cz] = key.split(',').map(Number);
            this.rebuildChunk(cx, cy, cz, scene);
        }
        this.dirtyChunks.clear();
    }

    rebuildChunk(cx, cy, cz, scene) {
        if (!this._mesherFn || !this._mesherMaterial) return;

        const key = `${cx},${cy},${cz}`;
        const oldMesh = this.chunkMeshes.get(key);
        if (oldMesh) {
            scene.remove(oldMesh);
            oldMesh.geometry.dispose();
            this.chunkMeshes.delete(key);
        }

        const geo = this._mesherFn(this, cx, cy, cz);
        if (geo) {
            const mesh = new THREE.Mesh(geo, this._mesherMaterial);
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            const cs = this.chunkSize;
            const wp = this.voxelToWorld(cx * cs, cy * cs, cz * cs);
            mesh.position.set(wp.x + this._worldOffsetX, wp.y, wp.z + this._worldOffsetZ);
            mesh.userData.chunkKey = key;
            scene.add(mesh);
            this.chunkMeshes.set(key, mesh);
        }
    }
}
