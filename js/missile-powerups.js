import * as THREE from 'three';

const COLLECT_RADIUS = 4;
const SPIN_SPEED = 2;
const EXPIRE_TIME = 20;
const FALL_SPEED = 25;
const BEACON_HEIGHT = 50;
const CUBE_SIZE = 0.8;
const SPAWN_INTERVAL_MIN = 15;
const SPAWN_INTERVAL_MAX = 25;
const MAX_ACTIVE = 3;

const POWERUP_TYPES = [
    { id: 'ammo', name: '+5 AMMO', color: 0x44ff88, weight: 3, duration: 0 },
    { id: 'score_x2', name: 'SCORE x2', color: 0xffcc00, weight: 1, duration: 15 },
];

function pickType() {
    const totalWeight = POWERUP_TYPES.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * totalWeight;
    for (const t of POWERUP_TYPES) {
        r -= t.weight;
        if (r <= 0) return t;
    }
    return POWERUP_TYPES[0];
}

export class MissilePowerUpManager {
    constructor(scene, world, particleSystem) {
        this.scene = scene;
        this.world = world;
        this.particles = particleSystem;
        this.crates = [];
        this.spawnTimer = 10 + Math.random() * 5;
        this.scoreMultiplier = 1;
        this._multiplierTimer = 0;
    }

    update(dt, playerPos, interceptorManager, audio) {
        this.spawnTimer -= dt;
        const activeCount = this.crates.filter(c => c.active).length;
        if (this.spawnTimer <= 0 && activeCount < MAX_ACTIVE) {
            this._spawnCrate();
            this.spawnTimer = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
        }

        for (const crate of this.crates) {
            if (!crate.active) continue;
            this._updateCrate(crate, dt);
            if (!crate.active) continue;

            if (crate.state === 'landed') {
                const dx = crate.position.x - playerPos.x;
                const dz = crate.position.z - playerPos.z;
                if (Math.hypot(dx, dz) < COLLECT_RADIUS) {
                    this._collect(crate, interceptorManager, audio);
                }
            }
        }

        if (this._multiplierTimer > 0) {
            this._multiplierTimer -= dt;
            if (this._multiplierTimer <= 0) {
                this.scoreMultiplier = 1;
            }
        }

        this.crates = this.crates.filter(c => {
            if (!c.active) {
                this.scene.remove(c.group);
                return false;
            }
            return true;
        });

        this._updateHUD();
    }

    _spawnCrate() {
        const worldSizeX = this.world.sizeX;
        const worldSizeZ = this.world.sizeZ;
        const offsetX = -(worldSizeX * this.world.voxelSize) / 2;
        const offsetZ = -(worldSizeZ * this.world.voxelSize) / 2;

        const margin = 20;
        const vx = margin + Math.floor(Math.random() * (worldSizeX - margin * 2));
        const vz = margin + Math.floor(Math.random() * (worldSizeZ - margin * 2));
        const groundY = this.world.getHighestSolidY(vx, vz);
        if (groundY < 0) return;

        const wp = this.world.voxelToWorld(vx, groundY + 1, vz);
        const worldX = wp.x + offsetX;
        const worldZ = wp.z + offsetZ;
        const landY = wp.y;

        const typeDef = pickType();

        const group = new THREE.Group();

        const cubeGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
        const cubeMat = new THREE.MeshPhongMaterial({
            color: typeDef.color,
            emissive: new THREE.Color(typeDef.color).multiplyScalar(0.4),
            transparent: true,
            opacity: 0.9,
        });
        const cube = new THREE.Mesh(cubeGeo, cubeMat);
        cube.position.y = CUBE_SIZE / 2 + 0.2;
        group.add(cube);

        const beaconGeo = new THREE.CylinderGeometry(0.05, 0.05, BEACON_HEIGHT, 4);
        const beaconMat = new THREE.MeshBasicMaterial({
            color: typeDef.color,
            transparent: true,
            opacity: 0.25,
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = BEACON_HEIGHT / 2;
        group.add(beacon);

        const light = new THREE.PointLight(typeDef.color, 1.5, 15);
        light.position.y = 1;
        group.add(light);

        const startY = 80 + Math.random() * 20;
        group.position.set(worldX, startY, worldZ);
        this.scene.add(group);

        this.crates.push({
            active: true,
            typeDef,
            position: new THREE.Vector3(worldX, startY, worldZ),
            landY,
            group,
            cube,
            light,
            state: 'falling',
            age: 0,
            spinAngle: 0,
        });
    }

    _updateCrate(crate, dt) {
        crate.spinAngle += SPIN_SPEED * dt;
        crate.cube.rotation.y = crate.spinAngle;
        crate.cube.rotation.x = Math.sin(crate.spinAngle * 0.7) * 0.3;
        crate.light.intensity = 1.2 + Math.sin(crate.age * 4) * 0.5;

        if (crate.state === 'falling') {
            crate.position.y -= FALL_SPEED * dt;
            if (crate.position.y <= crate.landY) {
                crate.position.y = crate.landY;
                crate.state = 'landed';
                if (this.particles) {
                    this.particles.emit(crate.position.clone(), 10, {
                        color: new THREE.Color(crate.typeDef.color),
                        speed: 4,
                        spread: 0.8,
                        life: 0.5,
                        size: 0.2,
                        gravity: false,
                    });
                }
            }
        } else {
            crate.age += dt;
            crate.position.y = crate.landY + Math.sin(crate.age * 2) * 0.3;

            if (crate.age > EXPIRE_TIME - 3) {
                crate.cube.visible = Math.sin(crate.age * 10) > 0;
            }
            if (crate.age >= EXPIRE_TIME) {
                crate.active = false;
            }
        }

        crate.group.position.copy(crate.position);
    }

    _collect(crate, interceptorManager, audio) {
        crate.active = false;

        if (this.particles) {
            this.particles.emit(crate.position.clone(), 25, {
                color: new THREE.Color(crate.typeDef.color),
                speed: 8,
                spread: 1.2,
                life: 0.8,
                size: 0.3,
                gravity: false,
            });
        }

        if (audio) audio.play('powerup');

        switch (crate.typeDef.id) {
            case 'ammo': {
                let lowest = null;
                for (const b of interceptorManager.batteries) {
                    if (!lowest || b.ammo < lowest.ammo) lowest = b;
                }
                if (lowest) {
                    lowest.ammo = Math.min(lowest.ammo + 5, lowest.maxAmmo);
                }
                break;
            }
            case 'score_x2':
                this.scoreMultiplier = 2;
                this._multiplierTimer = crate.typeDef.duration;
                break;
        }

        this._showPickupText(crate.typeDef.name, crate.typeDef.color);
    }

    _showPickupText(text, color) {
        const el = document.createElement('div');
        el.className = 'wave-announcement missile-wave-announcement';
        el.textContent = text;
        const hex = `#${new THREE.Color(color).getHexString()}`;
        el.style.color = hex;
        el.style.textShadow = `0 0 20px ${hex}80`;
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 500);
        }, 1500);
    }

    _updateHUD() {
        const el = document.getElementById('missile-hud-powerup');
        if (!el) return;
        if (this._multiplierTimer <= 0) {
            el.classList.add('hidden');
            return;
        }
        el.classList.remove('hidden');
        el.textContent = `SCORE x2: ${Math.ceil(this._multiplierTimer)}s`;
    }

    getScoreMultiplier() {
        return this.scoreMultiplier;
    }

    clear() {
        for (const crate of this.crates) {
            this.scene.remove(crate.group);
        }
        this.crates = [];
        this.scoreMultiplier = 1;
        this._multiplierTimer = 0;
        this.spawnTimer = 10 + Math.random() * 5;
    }
}
