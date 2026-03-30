import * as THREE from 'three';

const VOXEL_SIZE = 0.35;
const COLS = 11;
const ROWS = 5;
const COL_SPACING = 5.0;
const ROW_SPACING = 4.0;
const BASE_MOVE_SPEED = 2.5;
const DROP_STEP = 2.0;
const BASE_Y = 40;
const ARENA_HALF = 48;
const FIRE_INTERVAL_BASE = 3.0;

const ALIEN_TYPES = {
    squid: {
        points: 10,
        color: new THREE.Color(0x00ff66),
        emissive: new THREE.Color(0x004422),
        frames: [SQUID_FRAME_A(), SQUID_FRAME_B()],
    },
    crab: {
        points: 20,
        color: new THREE.Color(0x00ccff),
        emissive: new THREE.Color(0x002244),
        frames: [CRAB_FRAME_A(), CRAB_FRAME_B()],
    },
    octopus: {
        points: 30,
        color: new THREE.Color(0xff44cc),
        emissive: new THREE.Color(0x440022),
        frames: [OCTOPUS_FRAME_A(), OCTOPUS_FRAME_B()],
    },
};

function SQUID_FRAME_A() {
    const w = 8, h = 8, d = 3;
    const v = new Uint8Array(w * h * d);
    const pattern = [
        '...##...',
        '..####..',
        '.######.',
        '##.##.##',
        '########',
        '..#..#..',
        '.#.##.#.',
        '#.#..#.#',
    ];
    fillVoxels(v, w, h, d, pattern);
    return { data: v, w, h, d };
}

function SQUID_FRAME_B() {
    const w = 8, h = 8, d = 3;
    const v = new Uint8Array(w * h * d);
    const pattern = [
        '...##...',
        '..####..',
        '.######.',
        '##.##.##',
        '########',
        '.#.##.#.',
        '#......#',
        '.#....#.',
    ];
    fillVoxels(v, w, h, d, pattern);
    return { data: v, w, h, d };
}

function CRAB_FRAME_A() {
    const w = 11, h = 8, d = 3;
    const v = new Uint8Array(w * h * d);
    const pattern = [
        '..#.....#..',
        '...#...#...',
        '..#######..',
        '.##.###.##.',
        '###########',
        '#.#######.#',
        '#.#.....#.#',
        '...##.##...',
    ];
    fillVoxels(v, w, h, d, pattern);
    return { data: v, w, h, d };
}

function CRAB_FRAME_B() {
    const w = 11, h = 8, d = 3;
    const v = new Uint8Array(w * h * d);
    const pattern = [
        '..#.....#..',
        '#..#...#..#',
        '#.#######.#',
        '###.###.###',
        '###########',
        '.#########.',
        '..#.....#..',
        '.#.......#.',
    ];
    fillVoxels(v, w, h, d, pattern);
    return { data: v, w, h, d };
}

function OCTOPUS_FRAME_A() {
    const w = 12, h = 8, d = 3;
    const v = new Uint8Array(w * h * d);
    const pattern = [
        '....####....',
        '.##########.',
        '############',
        '###..##..###',
        '############',
        '..###..###..',
        '.##.####.##.',
        '#..#....#..#',
    ];
    fillVoxels(v, w, h, d, pattern);
    return { data: v, w, h, d };
}

function OCTOPUS_FRAME_B() {
    const w = 12, h = 8, d = 3;
    const v = new Uint8Array(w * h * d);
    const pattern = [
        '....####....',
        '.##########.',
        '############',
        '###..##..###',
        '############',
        '..###..###..',
        '.##..##..##.',
        '..##....##..',
    ];
    fillVoxels(v, w, h, d, pattern);
    return { data: v, w, h, d };
}

function fillVoxels(arr, w, h, d, pattern) {
    for (let row = 0; row < h; row++) {
        const line = pattern[row] || '';
        for (let col = 0; col < w; col++) {
            if (col < line.length && line[col] === '#') {
                const vy = h - 1 - row;
                for (let dz = 0; dz < d; dz++) {
                    arr[col + dz * w + vy * w * d] = 1;
                }
            }
        }
    }
}

function buildAlienMesh(frame, color, emissive) {
    const { data, w, h, d } = frame;
    const boxes = [];
    for (let y = 0; y < h; y++) {
        for (let z = 0; z < d; z++) {
            for (let x = 0; x < w; x++) {
                if (data[x + z * w + y * w * d]) {
                    boxes.push(new THREE.Vector3(
                        (x - w / 2 + 0.5) * VOXEL_SIZE,
                        (y - h / 2 + 0.5) * VOXEL_SIZE,
                        (z - d / 2 + 0.5) * VOXEL_SIZE
                    ));
                }
            }
        }
    }

    const geo = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
    const mat = new THREE.MeshPhongMaterial({
        color,
        emissive,
        shininess: 30,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < boxes.length; i++) {
        dummy.position.copy(boxes[i]);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    return mesh;
}

class Alien {
    constructor(type, col, row) {
        this.type = type;
        this.col = col;
        this.row = row;
        this.alive = true;
        this.id = `${col}_${row}`;
        this.group = new THREE.Group();

        const def = ALIEN_TYPES[type];
        this.points = def.points;
        this.meshA = buildAlienMesh(def.frames[0], def.color, def.emissive);
        this.meshB = buildAlienMesh(def.frames[1], def.color, def.emissive);
        this.group.add(this.meshA);
        this.group.add(this.meshB);
        this.meshB.visible = false;
        this.frame = 0;

        this.boundingRadius = Math.max(def.frames[0].w, def.frames[0].h) * VOXEL_SIZE * 0.5;
    }

    setFrame(f) {
        this.frame = f;
        this.meshA.visible = f === 0;
        this.meshB.visible = f === 1;
    }

    getWorldPos() {
        const pos = new THREE.Vector3();
        this.group.getWorldPosition(pos);
        return pos;
    }

    dispose(scene) {
        this.group.parent?.remove(this.group);
        this.meshA.geometry.dispose();
        this.meshA.material.dispose();
        this.meshB.geometry.dispose();
        this.meshB.material.dispose();
    }
}

export class AlienFormation {
    constructor(scene) {
        this.scene = scene;
        this.formationGroup = new THREE.Group();
        scene.add(this.formationGroup);

        this.aliens = [];
        this.direction = 1;
        this.moveSpeed = BASE_MOVE_SPEED;
        this.moveTimer = 0;
        this.moveInterval = 0.8;
        this.animTimer = 0;
        this.animFrame = 0;
        this.baseY = BASE_Y;

        this.fireTimers = new Map();
        this.pendingShots = [];

        this.reset(1);
    }

    reset(wave) {
        for (const a of this.aliens) {
            a.dispose(this.scene);
        }
        this.aliens = [];
        this.formationGroup.position.set(0, this.baseY, -15);
        this.direction = 1;
        this.animFrame = 0;
        this.moveTimer = 0;
        this.fireTimers.clear();
        this.pendingShots = [];

        const speedMul = 1 + (wave - 1) * 0.1;
        this.moveSpeed = BASE_MOVE_SPEED * speedMul;
        this.moveInterval = Math.max(0.2, 0.8 - (wave - 1) * 0.05);

        const typeMap = ['octopus', 'octopus', 'crab', 'crab', 'squid'];

        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const type = typeMap[row];
                const alien = new Alien(type, col, row);
                const x = (col - (COLS - 1) / 2) * COL_SPACING;
                const y = row * ROW_SPACING;
                alien.group.position.set(x, y, 0);
                this.formationGroup.add(alien.group);
                this.aliens.push(alien);
            }
        }

        for (let col = 0; col < COLS; col++) {
            const interval = FIRE_INTERVAL_BASE / speedMul;
            this.fireTimers.set(col, Math.random() * interval + interval * 0.5);
        }
    }

    allDead() {
        return this.aliens.every(a => !a.alive);
    }

    aliveCount() {
        return this.aliens.filter(a => a.alive).length;
    }

    update(dt, state) {
        this.animTimer += dt;
        if (this.animTimer > 0.5) {
            this.animTimer = 0;
            this.animFrame = 1 - this.animFrame;
            for (const a of this.aliens) {
                if (a.alive) a.setFrame(this.animFrame);
            }
        }

        const alive = this.aliens.filter(a => a.alive);
        if (alive.length === 0) return;

        const speedBoost = 1 + (1 - alive.length / (COLS * ROWS)) * 2;

        this.moveTimer += dt;
        const interval = this.moveInterval / speedBoost;
        if (this.moveTimer >= interval) {
            this.moveTimer = 0;

            let minX = Infinity, maxX = -Infinity;
            for (const a of alive) {
                const wx = this.formationGroup.position.x + a.group.position.x;
                minX = Math.min(minX, wx);
                maxX = Math.max(maxX, wx);
            }

            const step = this.direction * this.moveSpeed * interval;
            const nextMin = minX + step;
            const nextMax = maxX + step;

            if (nextMax > ARENA_HALF - 2 || nextMin < -(ARENA_HALF - 2)) {
                this.direction *= -1;
                this.formationGroup.position.y -= DROP_STEP;
            } else {
                this.formationGroup.position.x += step;
            }
        }

        this._updateFiring(dt, alive, state);
    }

    _updateFiring(dt, alive, state) {
        const wave = state ? state.wave : 1;
        const speedMul = 1 + (wave - 1) * 0.15;
        this.pendingShots = [];

        for (let col = 0; col < COLS; col++) {
            let timer = this.fireTimers.get(col) || 0;
            timer -= dt;
            if (timer <= 0) {
                const bottom = this._getBottomAlienInCol(col, alive);
                if (bottom) {
                    const pos = bottom.getWorldPos();
                    this.pendingShots.push(pos.clone());
                }
                const interval = (FIRE_INTERVAL_BASE / speedMul) * (0.5 + Math.random());
                this.fireTimers.set(col, interval);
            } else {
                this.fireTimers.set(col, timer);
            }
        }
    }

    _getBottomAlienInCol(col, alive) {
        let bottom = null;
        for (const a of alive) {
            if (a.col === col) {
                if (!bottom || a.row < bottom.row) {
                    bottom = a;
                }
            }
        }
        return bottom;
    }

    getAlienAt(position, radius) {
        for (const a of this.aliens) {
            if (!a.alive) continue;
            const wp = a.getWorldPos();
            const dist = wp.distanceTo(position);
            if (dist < a.boundingRadius + radius) {
                return a;
            }
        }
        return null;
    }

    removeAlien(alien) {
        alien.alive = false;
        alien.group.visible = false;
        return alien.points;
    }

    getFormationBottom() {
        let minY = Infinity;
        for (const a of this.aliens) {
            if (!a.alive) continue;
            const wp = a.getWorldPos();
            minY = Math.min(minY, wp.y);
        }
        return minY;
    }
}
