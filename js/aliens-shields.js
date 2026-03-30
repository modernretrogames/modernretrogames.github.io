import * as THREE from 'three';

const SHIELD_COUNT = 4;
const SHIELD_Y = 18;
const SHIELD_SPACING = 20;
const VOXEL_SIZE = 0.5;

const SHIELD_W = 16;
const SHIELD_H = 12;
const SHIELD_D = 3;

function createArchPattern() {
    const pattern = new Uint8Array(SHIELD_W * SHIELD_H * SHIELD_D);

    for (let y = 0; y < SHIELD_H; y++) {
        for (let x = 0; x < SHIELD_W; x++) {
            let solid = false;

            if (y < SHIELD_H - 3) {
                solid = true;
            } else {
                const cx = SHIELD_W / 2;
                const dist = Math.abs(x - cx + 0.5);
                const threshold = (SHIELD_H - 1 - y) * 1.8 + 2;
                solid = dist >= threshold * 0.5;
            }

            if (y >= SHIELD_H - 2) {
                const cx = SHIELD_W / 2;
                const dist = Math.abs(x - cx + 0.5);
                if (dist < 3) solid = false;
            }

            if (solid) {
                for (let z = 0; z < SHIELD_D; z++) {
                    pattern[x + z * SHIELD_W + y * SHIELD_W * SHIELD_D] = 1;
                }
            }
        }
    }
    return pattern;
}

class Shield {
    constructor(scene, centerX) {
        this.scene = scene;
        this.centerX = centerX;
        this.w = SHIELD_W;
        this.h = SHIELD_H;
        this.d = SHIELD_D;
        this.data = createArchPattern();
        this.group = new THREE.Group();
        this.group.position.set(centerX, SHIELD_Y, -15);
        scene.add(this.group);

        this.mesh = null;
        this._rebuild();
    }

    _rebuild() {
        if (this.mesh) {
            this.group.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }

        const positions = [];
        for (let y = 0; y < this.h; y++) {
            for (let z = 0; z < this.d; z++) {
                for (let x = 0; x < this.w; x++) {
                    if (this.data[x + z * this.w + y * this.w * this.d]) {
                        positions.push(new THREE.Vector3(
                            (x - this.w / 2 + 0.5) * VOXEL_SIZE,
                            (y + 0.5) * VOXEL_SIZE,
                            (z - this.d / 2 + 0.5) * VOXEL_SIZE
                        ));
                    }
                }
            }
        }

        if (positions.length === 0) return;

        const geo = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
        const mat = new THREE.MeshPhongMaterial({
            color: 0x00ff88,
            emissive: 0x003322,
            transparent: true,
            opacity: 0.85,
            shininess: 20,
        });

        this.mesh = new THREE.InstancedMesh(geo, mat, positions.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < positions.length; i++) {
            dummy.position.copy(positions[i]);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.group.add(this.mesh);
    }

    checkHit(worldPos, radius) {
        const local = worldPos.clone().sub(this.group.position);

        const vx = Math.round(local.x / VOXEL_SIZE + this.w / 2 - 0.5);
        const vy = Math.round(local.y / VOXEL_SIZE - 0.5);
        const vz = Math.round(local.z / VOXEL_SIZE + this.d / 2 - 0.5);

        const r = Math.ceil(radius / VOXEL_SIZE);
        let hit = false;

        for (let dy = -r; dy <= r; dy++) {
            for (let dz = -r; dz <= r; dz++) {
                for (let dx = -r; dx <= r; dx++) {
                    const ax = vx + dx;
                    const ay = vy + dy;
                    const az = vz + dz;
                    if (ax < 0 || ax >= this.w || ay < 0 || ay >= this.h || az < 0 || az >= this.d) continue;
                    const idx = ax + az * this.w + ay * this.w * this.d;
                    if (this.data[idx]) {
                        this.data[idx] = 0;
                        hit = true;
                    }
                }
            }
        }

        if (hit) this._rebuild();
        return hit;
    }

    resetData() {
        this.data = createArchPattern();
        this._rebuild();
    }

    dispose() {
        if (this.mesh) {
            this.group.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
        this.scene.remove(this.group);
    }
}

export class ShieldManager {
    constructor(scene) {
        this.scene = scene;
        this.shields = [];

        const totalWidth = (SHIELD_COUNT - 1) * SHIELD_SPACING;
        const startX = -totalWidth / 2;

        for (let i = 0; i < SHIELD_COUNT; i++) {
            const x = startX + i * SHIELD_SPACING;
            this.shields.push(new Shield(scene, x));
        }
    }

    reset() {
        for (const s of this.shields) {
            s.resetData();
        }
    }

    checkLaserHit(worldPos, radius) {
        for (const shield of this.shields) {
            if (shield.checkHit(worldPos, radius)) {
                return true;
            }
        }
        return false;
    }

    update(dt) {
        // shields are static, no per-frame update needed
    }

    dispose() {
        for (const s of this.shields) {
            s.dispose();
        }
    }
}
