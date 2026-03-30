import * as THREE from 'three';
import { createExplosion } from './explosion.js';

const MAX_WARHEADS = 60;
const TRAIL_LENGTH = 20;

export class WarheadManager {
    constructor(scene, world, particleSystem, audioManager, cityManager, interceptorManager) {
        this.scene = scene;
        this.world = world;
        this.particleSystem = particleSystem;
        this.audio = audioManager;
        this.cityManager = cityManager;
        this.interceptorManager = interceptorManager;

        this.warheads = [];
        this.spawnTimer = 0;
        this.spawnInterval = 3;
        this.warheadsToSpawn = 0;
        this.totalSpawned = 0;
        this.totalForWave = 10;
        this.baseSpeed = 6;
        this.mirvChance = 0;

        this._initPool();
    }

    _initPool() {
        const trailGeo = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(MAX_WARHEADS * TRAIL_LENGTH * 3);
        const trailColors = new Float32Array(MAX_WARHEADS * TRAIL_LENGTH * 3);
        trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
        trailGeo.setDrawRange(0, 0);

        const trailMat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
        });
        this.trailLines = new THREE.LineSegments(trailGeo, trailMat);
        this.trailLines.frustumCulled = false;
        this.scene.add(this.trailLines);

        const tipGeo = new THREE.ConeGeometry(0.25, 0.8, 6);
        const tipMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
        this.tipMesh = new THREE.InstancedMesh(tipGeo, tipMat, MAX_WARHEADS);
        this.tipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.tipMesh.count = 0;
        this.tipMesh.frustumCulled = false;
        this.scene.add(this.tipMesh);

        for (let i = 0; i < MAX_WARHEADS; i++) {
            this.warheads.push({
                active: false,
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                targetCity: -1,
                targetPos: new THREE.Vector3(),
                trail: [],
                isMirv: false,
                mirvSplit: false,
                splitAltitude: 0,
            });
        }
    }

    configureWave(wave) {
        this.totalForWave = 8 + wave * 3;
        this.warheadsToSpawn = this.totalForWave;
        this.totalSpawned = 0;
        this.spawnInterval = Math.max(0.5, 3 - wave * 0.2);
        this.spawnTimer = 1.5;
        this.baseSpeed = 6 + wave * 1.0;
        this.mirvChance = Math.min(0.5, (wave - 3) * 0.1);
    }

    _spawnWarhead(targetCityIndex, isMirvChild, startPos) {
        const w = this._getFromPool();
        if (!w) return null;

        const city = targetCityIndex >= 0
            ? this.cityManager.cities[targetCityIndex]
            : null;

        if (!city && !isMirvChild) return null;

        w.active = true;
        w.targetCity = targetCityIndex;
        w.trail = [];
        w.mirvSplit = false;

        if (isMirvChild && startPos) {
            w.position.copy(startPos);
            w.isMirv = false;
        } else {
            const spawnX = city.worldX + (Math.random() - 0.5) * 80;
            const spawnZ = city.worldZ + (Math.random() - 0.5) * 40 - 30;
            const spawnY = 80 + Math.random() * 30;
            w.position.set(spawnX, spawnY, spawnZ);
            w.isMirv = Math.random() < this.mirvChance;
            w.splitAltitude = 30 + Math.random() * 20;
        }

        w.targetPos.set(city.worldX, city.worldY, city.worldZ);

        const dir = new THREE.Vector3().subVectors(w.targetPos, w.position).normalize();
        const speed = this.baseSpeed * (0.8 + Math.random() * 0.4);
        w.velocity.copy(dir).multiplyScalar(speed);

        return w;
    }

    _getFromPool() {
        for (const w of this.warheads) {
            if (!w.active) return w;
        }
        return null;
    }

    update(dt, state) {
        this._spawnTick(dt);
        this._updateWarheads(dt, state);
        this._rebuildTrails();
    }

    _spawnTick(dt) {
        if (this.warheadsToSpawn <= 0) return;

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = this.spawnInterval * (0.7 + Math.random() * 0.6);

            const aliveCities = this.cityManager.getAliveCities();
            if (aliveCities.length === 0) return;

            const targetCity = aliveCities[Math.floor(Math.random() * aliveCities.length)];
            this._spawnWarhead(targetCity.index, false, null);
            this.warheadsToSpawn--;
            this.totalSpawned++;
        }
    }

    _updateWarheads(dt, state) {
        const dummy = new THREE.Object3D();
        let tipCount = 0;

        for (const w of this.warheads) {
            if (!w.active) continue;

            w.position.addScaledVector(w.velocity, dt);
            w.trail.push(w.position.clone());
            if (w.trail.length > TRAIL_LENGTH) w.trail.shift();

            if (w.isMirv && !w.mirvSplit && w.position.y <= w.splitAltitude) {
                this._splitMirv(w);
                continue;
            }

            if (this._checkBlastCollision(w)) {
                this._destroyWarhead(w, state, true);
                continue;
            }

            if (w.position.y <= w.targetPos.y + 1) {
                this._warheadImpact(w, state);
                continue;
            }

            dummy.position.copy(w.position);
            const dir = w.velocity.clone().normalize();
            dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            this.tipMesh.setMatrixAt(tipCount, dummy.matrix);
            tipCount++;
        }

        this.tipMesh.count = tipCount;
        if (tipCount > 0) {
            this.tipMesh.instanceMatrix.needsUpdate = true;
        }
    }

    _splitMirv(w) {
        w.mirvSplit = true;
        w.active = false;

        if (this.particleSystem) {
            this.particleSystem.emit(w.position, 15, {
                color: new THREE.Color(1, 1, 0.5),
                speed: 5,
                spread: 1,
                life: 0.5,
                size: 0.2,
                gravity: false,
            });
        }

        const aliveCities = this.cityManager.getAliveCities();
        const splitCount = 3;
        for (let i = 0; i < splitCount; i++) {
            let targetIdx = w.targetCity;
            if (aliveCities.length > 1 && i > 0) {
                const alt = aliveCities[Math.floor(Math.random() * aliveCities.length)];
                targetIdx = alt.index;
            }
            const child = this._spawnWarhead(targetIdx, true, w.position.clone());
            if (child) {
                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * 4,
                    0,
                    (Math.random() - 0.5) * 4
                );
                child.position.add(offset);
            }
        }
    }

    _checkBlastCollision(w) {
        const blasts = this.interceptorManager.getActiveBlasts();
        for (const blast of blasts) {
            const dist = w.position.distanceTo(blast.position);
            if (dist <= blast.radius) {
                return true;
            }
        }
        return false;
    }

    _destroyWarhead(w, state, scored) {
        w.active = false;

        if (this.particleSystem) {
            this.particleSystem.emit(w.position, 40, {
                color: new THREE.Color(1, 0.4, 0.1),
                speed: 12,
                spread: 1.2,
                life: 1.2,
                size: 0.3,
            });
            this.particleSystem.emit(w.position, 20, {
                color: new THREE.Color(1, 1, 0.5),
                speed: 8,
                spread: 0.8,
                life: 0.5,
                size: 0.2,
                gravity: false,
            });
        }

        if (this.audio) {
            this.audio.play('interceptDetonate');
        }

        if (scored && state) {
            state.score += 25 * (state.scoreMultiplier || 1);
        }
    }

    _warheadImpact(w, state) {
        w.active = false;

        const offsetX = -(this.world.sizeX * this.world.voxelSize) / 2;
        const offsetZ = -(this.world.sizeZ * this.world.voxelSize) / 2;
        const localX = w.position.x - offsetX;
        const localZ = w.position.z - offsetZ;
        const impactPoint = new THREE.Vector3(localX, Math.max(w.position.y, 1), localZ);

        createExplosion(this.world, impactPoint, 3, this.particleSystem);

        if (this.audio) {
            this.audio.play('explosion', { radius: 5 });
        }

        if (this._onScreenShake) {
            this._onScreenShake(0.4, 0.4);
        }

        if (w.targetCity >= 0 && w.targetCity < this.cityManager.cities.length) {
            const city = this.cityManager.cities[w.targetCity];
            if (city.alive) {
                const dx = w.position.x - city.worldX;
                const dz = w.position.z - city.worldZ;
                const dist = Math.hypot(dx, dz);
                if (dist < 8) {
                    const wasPreviouslyAlive = city.alive;
                    this.cityManager.damageCity(w.targetCity, 50);
                    if (wasPreviouslyAlive && !city.alive && this.audio) {
                        this.audio.play('cityDestroyed');
                        if (this._onScreenShake) {
                            this._onScreenShake(0.8, 0.6);
                        }
                    }
                }
            }
        }
    }

    _rebuildTrails() {
        const positions = this.trailLines.geometry.attributes.position.array;
        const colors = this.trailLines.geometry.attributes.color.array;
        let segIdx = 0;

        for (const w of this.warheads) {
            if (!w.active || w.trail.length < 2) continue;

            for (let i = 0; i < w.trail.length - 1; i++) {
                const a = w.trail[i];
                const b = w.trail[i + 1];
                const alpha = (i + 1) / w.trail.length;

                const idx = segIdx * 6;
                positions[idx] = a.x;
                positions[idx + 1] = a.y;
                positions[idx + 2] = a.z;
                positions[idx + 3] = b.x;
                positions[idx + 4] = b.y;
                positions[idx + 5] = b.z;

                colors[idx] = 1 * alpha;
                colors[idx + 1] = 0.15 * alpha;
                colors[idx + 2] = 0.1 * alpha;
                colors[idx + 3] = 1 * alpha;
                colors[idx + 4] = 0.15 * alpha;
                colors[idx + 5] = 0.1 * alpha;

                segIdx++;
            }
        }

        this.trailLines.geometry.setDrawRange(0, segIdx * 2);
        this.trailLines.geometry.attributes.position.needsUpdate = true;
        this.trailLines.geometry.attributes.color.needsUpdate = true;
    }

    activeCount() {
        let c = 0;
        for (const w of this.warheads) {
            if (w.active) c++;
        }
        return c;
    }

    waveComplete() {
        return this.warheadsToSpawn <= 0 && this.activeCount() === 0;
    }

    clear() {
        for (const w of this.warheads) {
            w.active = false;
        }
        this.warheadsToSpawn = 0;
        this.totalSpawned = 0;
        this.trailLines.geometry.setDrawRange(0, 0);
    }
}
