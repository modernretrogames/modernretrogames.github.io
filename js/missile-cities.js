import * as THREE from 'three';
import { VoxelType } from './voxel-world.js';
import { SeededRandom } from './utils.js';

const CITY_COLORS = [
    0x4488ff,
    0x44ffaa,
    0xff8844,
    0xff44aa,
    0xaaff44,
    0xffdd44,
];

export class CityManager {
    constructor(world, scene) {
        this.world = world;
        this.scene = scene;
        this.cities = [];
        this.cityMarkers = [];
    }

    generateCities(count = 6) {
        this.cities = [];
        for (const m of this.cityMarkers) {
            this.scene.remove(m);
        }
        this.cityMarkers = [];

        const worldW = this.world.sizeX;
        const worldZ = this.world.sizeZ;
        const centerX = Math.floor(worldW / 2);
        const centerZ = Math.floor(worldZ / 2);

        const arcRadius = Math.floor(Math.min(worldW, worldZ) * 0.3);
        const rng = new SeededRandom(12345);

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI - Math.PI / 2;
            const vx = centerX + Math.floor(Math.cos(angle) * arcRadius);
            const vz = centerZ + Math.floor(Math.sin(angle) * arcRadius * 0.6) - Math.floor(arcRadius * 0.3);

            this._flattenArea(vx, vz, 8);

            const groundY = this.world.getHighestSolidY(vx, vz);
            if (groundY < 0) continue;

            this._buildCity(vx, groundY + 1, vz, rng, i);

            const wp = this.world.voxelToWorld(vx, groundY, vz);
            const worldHalfX = (worldW * this.world.voxelSize) / 2;
            const worldHalfZ = (worldZ * this.world.voxelSize) / 2;

            this.cities.push({
                index: i,
                voxelX: vx,
                voxelZ: vz,
                groundY: groundY,
                worldX: wp.x - worldHalfX,
                worldZ: wp.z - worldHalfZ,
                worldY: wp.y,
                alive: true,
                health: 100,
                radius: 4,
                color: CITY_COLORS[i % CITY_COLORS.length],
            });

            this._addCityBeacon(wp.x - worldHalfX, wp.y, wp.z - worldHalfZ, CITY_COLORS[i % CITY_COLORS.length]);
        }

        return this.cities;
    }

    _flattenArea(cx, cz, radius) {
        let totalHeight = 0;
        let count = 0;
        for (let dz = -radius; dz <= radius; dz++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dz * dz > radius * radius) continue;
                const h = this.world.getHighestSolidY(cx + dx, cz + dz);
                if (h > 0) {
                    totalHeight += h;
                    count++;
                }
            }
        }
        if (count === 0) return;
        const avgHeight = Math.floor(totalHeight / count);

        for (let dz = -radius; dz <= radius; dz++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dz * dz > radius * radius) continue;
                const x = cx + dx;
                const z = cz + dz;
                const currentH = this.world.getHighestSolidY(x, z);

                if (currentH > avgHeight) {
                    for (let y = currentH; y > avgHeight; y--) {
                        this.world.setVoxel(x, y, z, VoxelType.AIR);
                    }
                } else if (currentH < avgHeight) {
                    for (let y = currentH + 1; y <= avgHeight; y++) {
                        this.world.setVoxel(x, y, z, VoxelType.ROCK);
                    }
                }
                this.world.setVoxel(x, avgHeight, z, VoxelType.ROCK);
            }
        }
    }

    _buildCity(cx, baseY, cz, rng, cityIndex) {
        const buildingCount = 4 + Math.floor(rng.next() * 3);

        for (let b = 0; b < buildingCount; b++) {
            const bx = cx + Math.floor(rng.nextRange(-5, 5));
            const bz = cz + Math.floor(rng.nextRange(-5, 5));
            const bw = 2 + Math.floor(rng.next() * 2);
            const bd = 2 + Math.floor(rng.next() * 2);
            const bh = 3 + Math.floor(rng.next() * 6);

            for (let dy = 0; dy < bh; dy++) {
                for (let dz = 0; dz < bd; dz++) {
                    for (let dx = 0; dx < bw; dx++) {
                        const vx = bx + dx;
                        const vy = baseY + dy;
                        const vz = bz + dz;
                        if (this.world.inBounds(vx, vy, vz)) {
                            this.world.setVoxel(vx, vy, vz, VoxelType.ROCK);
                        }
                    }
                }
            }
        }
    }

    _addCityBeacon(wx, wy, wz, color) {
        const beaconGeo = new THREE.CylinderGeometry(0.1, 0.3, 3, 6);
        const beaconMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.4,
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(wx, wy + 6, wz);
        this.scene.add(beacon);
        this.cityMarkers.push(beacon);

        const light = new THREE.PointLight(color, 0.5, 20);
        light.position.set(wx, wy + 4, wz);
        this.scene.add(light);
        this.cityMarkers.push(light);
    }

    resetAllCities() {
        for (const city of this.cities) {
            city.alive = true;
            city.health = 100;
        }
    }

    destroyCity(index) {
        if (index < 0 || index >= this.cities.length) return;
        this.cities[index].alive = false;
        this.cities[index].health = 0;
    }

    damageCity(index, amount) {
        if (index < 0 || index >= this.cities.length) return;
        const city = this.cities[index];
        if (!city.alive) return;
        city.health -= amount;
        if (city.health <= 0) {
            this.destroyCity(index);
        }
    }

    getAliveCities() {
        return this.cities.filter(c => c.alive);
    }

    allDestroyed() {
        return this.cities.length > 0 && this.cities.every(c => !c.alive);
    }

    getClosestCity(wx, wz) {
        let closest = null;
        let minDist = Infinity;
        for (const city of this.cities) {
            if (!city.alive) continue;
            const dx = city.worldX - wx;
            const dz = city.worldZ - wz;
            const dist = Math.hypot(dx, dz);
            if (dist < minDist) {
                minDist = dist;
                closest = city;
            }
        }
        return closest;
    }

    updateBeacons(dt) {
        const time = performance.now() * 0.001;
        for (let i = 0; i < this.cities.length; i++) {
            const city = this.cities[i];
            const markerIdx = i * 2;
            if (markerIdx + 1 >= this.cityMarkers.length) continue;
            const beacon = this.cityMarkers[markerIdx];
            const light = this.cityMarkers[markerIdx + 1];

            if (!city.alive) {
                beacon.visible = false;
                light.visible = false;
                continue;
            }

            const pulse = 0.3 + Math.sin(time * 2 + i) * 0.15;
            beacon.material.opacity = pulse;
            beacon.rotation.y += dt * 0.5;
        }
    }
}
