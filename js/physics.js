import * as THREE from 'three';
import { VoxelType } from './voxel-world.js';

const GRAVITY = 9.81;
const FALL_DAMAGE_THRESHOLD = 2.0;
const FALL_DAMAGE_PER_UNIT = 5;

export function checkTankSupport(tank, world) {
    const vc = world.worldToVoxel(tank.position.x, tank.position.y - 0.1, tank.position.z);

    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const v = world.getVoxel(vc.x + dx, vc.y, vc.z + dz);
            if (v !== VoxelType.AIR && v !== VoxelType.WATER) {
                return true;
            }
        }
    }
    return false;
}

export function startFalling(tank) {
    if (tank.falling) return;
    tank.falling = true;
    tank.fallVelocity = 0;
    tank.fallStartY = tank.position.y;
}

export function updateFallingTank(tank, world, dt) {
    if (!tank.falling || !tank.alive) return null;

    tank.fallVelocity += GRAVITY * dt;
    tank.position.y -= tank.fallVelocity * dt;

    if (tank.position.y < -5) {
        tank.falling = false;
        tank.alive = false;
        return { type: 'destroyed', tankId: tank.id };
    }

    if (checkTankSupport(tank, world)) {
        const vc = world.worldToVoxel(tank.position.x, tank.position.y - 0.1, tank.position.z);
        let highestY = vc.y;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                for (let dy = vc.y; dy < vc.y + 5; dy++) {
                    const v = world.getVoxel(vc.x + dx, dy, vc.z + dz);
                    if (v !== VoxelType.AIR && v !== VoxelType.WATER) {
                        highestY = Math.max(highestY, dy);
                    }
                }
            }
        }

        const wp = world.voxelToWorld(vc.x, highestY + 1, vc.z);
        tank.position.y = wp.y;
        tank.falling = false;

        const fallDistance = tank.fallStartY - tank.position.y;
        tank.fallVelocity = 0;

        if (fallDistance > FALL_DAMAGE_THRESHOLD) {
            const damage = Math.round((fallDistance - FALL_DAMAGE_THRESHOLD) * FALL_DAMAGE_PER_UNIT);
            if (damage > 0) {
                tank.takeDamage(damage);
                return { type: 'fall_damage', tankId: tank.id, damage, died: !tank.alive };
            }
        }

        return { type: 'landed', tankId: tank.id };
    }

    return null;
}

const _cornerOffsets = [
    { lx: -0.8, lz:  1.1 },
    { lx:  0.8, lz:  1.1 },
    { lx: -0.8, lz: -1.1 },
    { lx:  0.8, lz: -1.1 },
];
const _offset = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function terrainHeightAt(world, wx, wz) {
    const vc = world.worldToVoxel(wx, 0, wz);
    const vx = Math.max(0, Math.min(world.sizeX - 1, vc.x));
    const vz = Math.max(0, Math.min(world.sizeZ - 1, vc.z));
    const topY = world.getHighestSolidY(vx, vz);
    return topY < 0 ? 0 : (topY + 1) * world.voxelSize;
}

export function alignTankToTerrain(tank, world) {
    const px = tank.position.x;
    const pz = tank.position.z;

    const h = _cornerOffsets.map(c => terrainHeightAt(world, px + c.lx, pz + c.lz));

    const avgRight = (h[1] + h[3]) / 2;
    const avgLeft  = (h[0] + h[2]) / 2;
    const avgFront = (h[0] + h[1]) / 2;
    const avgBack  = (h[2] + h[3]) / 2;

    const tangentX = new THREE.Vector3(1.6, avgRight - avgLeft, 0).normalize();
    const tangentZ = new THREE.Vector3(0, avgFront - avgBack, 2.2).normalize();
    const normal = new THREE.Vector3().crossVectors(tangentZ, tangentX).normalize();
    if (normal.y < 0) normal.negate();

    tank.hullQuaternion.setFromUnitVectors(_up, normal);

    let minCenterY = -Infinity;
    for (let i = 0; i < 4; i++) {
        _offset.set(_cornerOffsets[i].lx, 0, _cornerOffsets[i].lz);
        _offset.applyQuaternion(tank.hullQuaternion);
        minCenterY = Math.max(minCenterY, h[i] - _offset.y);
    }
    tank.position.y = minCenterY;
}

export function applyKnockback(tank, impactPoint, strength) {
    const dir = new THREE.Vector3().subVectors(tank.position, impactPoint).normalize();
    const dist = tank.position.distanceTo(impactPoint);
    const force = Math.max(0, strength * (1 - dist / (strength * 2)));
    dir.y = Math.abs(dir.y) * 0.5;
    tank.position.addScaledVector(dir, force * 0.5);
}

const MOVE_SPEED_BASE = 6.0;
const MOVE_SPEED_UPHILL = 3.0;
const MOVE_SPEED_DOWNHILL = 9.0;
const MOVE_DISTANCE = 8.0;
const SLOPE_THRESHOLD = 0.15;
const MAX_CLIMBABLE_SLOPE = 1.2;

export function getTerrainSlopeInDirection(world, wx, wz, dirX, dirZ) {
    const sampleDist = 1.0;
    const hHere = terrainHeightAt(world, wx, wz);
    const hAhead = terrainHeightAt(world, wx + dirX * sampleDist, wz + dirZ * sampleDist);
    return (hAhead - hHere) / sampleDist;
}

export function getMoveSpeed(slope) {
    if (slope > SLOPE_THRESHOLD) {
        const t = Math.min(slope / MAX_CLIMBABLE_SLOPE, 1.0);
        return MOVE_SPEED_BASE + (MOVE_SPEED_UPHILL - MOVE_SPEED_BASE) * t;
    } else if (slope < -SLOPE_THRESHOLD) {
        const t = Math.min(-slope / MAX_CLIMBABLE_SLOPE, 1.0);
        return MOVE_SPEED_BASE + (MOVE_SPEED_DOWNHILL - MOVE_SPEED_BASE) * t;
    }
    return MOVE_SPEED_BASE;
}

export function startMoving(tank) {
    tank.moving = true;
    tank.moveDirection.copy(tank.getMoveDirection());
    tank.moveDistanceRemaining = MOVE_DISTANCE;
}

export function updateMovingTank(tank, world, dt) {
    if (!tank.moving || !tank.alive) return null;

    const slope = getTerrainSlopeInDirection(
        world, tank.position.x, tank.position.z,
        tank.moveDirection.x, tank.moveDirection.z
    );

    if (slope > MAX_CLIMBABLE_SLOPE) {
        tank.moving = false;
        tank.moveDistanceRemaining = 0;
        return { type: 'blocked', tankId: tank.id };
    }

    const speed = getMoveSpeed(slope);
    const step = speed * dt;
    const actualStep = Math.min(step, tank.moveDistanceRemaining);

    tank.position.x += tank.moveDirection.x * actualStep;
    tank.position.z += tank.moveDirection.z * actualStep;
    tank.moveDistanceRemaining -= actualStep;

    const vc = world.worldToVoxel(tank.position.x, tank.position.y, tank.position.z);
    if (!world.inBounds(vc.x, 0, vc.z)) {
        tank.position.x -= tank.moveDirection.x * actualStep;
        tank.position.z -= tank.moveDirection.z * actualStep;
        tank.moving = false;
        tank.moveDistanceRemaining = 0;
        return { type: 'edge', tankId: tank.id };
    }

    alignTankToTerrain(tank, world);

    if (tank.moveDistanceRemaining <= 0.01) {
        tank.moving = false;
        tank.moveDistanceRemaining = 0;
        return { type: 'finished', tankId: tank.id };
    }

    return null;
}

export { MOVE_DISTANCE };

export function checkAndApplyGravity(tanks, world) {
    const fallingTanks = [];
    for (const tank of tanks) {
        if (!tank.alive || tank.falling) continue;
        if (!checkTankSupport(tank, world)) {
            startFalling(tank);
            fallingTanks.push(tank);
        }
    }
    return fallingTanks;
}
