import * as THREE from 'three';
import { degToRad } from './utils.js';
import { WEAPON_DEFS } from './weapons.js';
import { getTerrainSlopeInDirection } from './physics.js';

const DIFFICULTY_ERROR = {
    easy:   { azimuth: 15, power: 0.20 },
    medium: { azimuth: 5,  power: 0.10 },
    hard:   { azimuth: 1,  power: 0.03 },
};

export class AIController {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
    }

    takeTurn(aiPlayer, gameState) {
        const tank = gameState.turnManager.getCurrentTank();
        if (!tank) return null;

        const target = this._selectTarget(tank, gameState);
        if (!target) return null;

        if (this._shouldMove(tank, target, gameState)) {
            const dx = target.position.x - tank.position.x;
            const dz = target.position.z - tank.position.z;
            const azimuthToTarget = Math.atan2(dx, dz);
            return { action: 'move', azimuth: azimuthToTarget };
        }

        const { azimuth, elevation, power } = this._calculateTrajectory(tank, target, gameState);

        const err = DIFFICULTY_ERROR[this.difficulty] || DIFFICULTY_ERROR.medium;
        const azimuthError = (Math.random() - 0.5) * 2 * degToRad(err.azimuth);
        const powerError = 1 + (Math.random() - 0.5) * 2 * err.power;

        const weaponIndex = this._selectWeapon(tank, target, gameState);

        return {
            action: 'fire',
            azimuth: azimuth + azimuthError,
            elevation,
            power: Math.max(0.1, Math.min(1.0, power * powerError)),
            weaponIndex,
        };
    }

    _shouldMove(tank, target, gameState) {
        const dist = tank.position.distanceTo(target.position);

        if (this.difficulty === 'easy') {
            return dist > 60 && Math.random() < 0.3;
        }

        if (dist > 80) return Math.random() < 0.5;

        if (dist < 10) {
            const dx = target.position.x - tank.position.x;
            const dz = target.position.z - tank.position.z;
            const awayAzimuth = Math.atan2(-dx, -dz);
            const dirX = Math.sin(awayAzimuth);
            const dirZ = Math.cos(awayAzimuth);
            const slope = getTerrainSlopeInDirection(
                gameState.voxelWorld, tank.position.x, tank.position.z, dirX, dirZ
            );
            if (slope < 1.2) return Math.random() < 0.4;
        }

        const { power } = this._calculateTrajectory(tank, target, gameState);
        if (power > 0.95) return Math.random() < 0.6;

        return false;
    }

    _selectTarget(tank, gameState) {
        let bestTarget = null;
        let bestScore = -Infinity;

        for (const player of gameState.players) {
            if (player.id === tank.playerId) continue;
            for (const enemyTank of player.tanks) {
                if (!enemyTank.alive) continue;
                const dist = tank.position.distanceTo(enemyTank.position);
                const healthScore = (100 - enemyTank.health) / 100;
                const distScore = 1 / (1 + dist * 0.1);

                let score;
                if (this.difficulty === 'easy') {
                    score = distScore;
                } else {
                    score = distScore * 0.6 + healthScore * 0.4;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = enemyTank;
                }
            }
        }
        return bestTarget;
    }

    _calculateTrajectory(sourceTank, targetTank, gameState) {
        const src = sourceTank.position;
        const tgt = targetTank.position;

        const dx = tgt.x - src.x;
        const dz = tgt.z - src.z;
        const azimuth = Math.atan2(dx, dz);

        const horizontalDist = Math.sqrt(dx * dx + dz * dz);
        const dy = tgt.y - src.y;

        const g = 9.81;
        let elevation = Math.PI / 4;
        let power = 0.5;

        const v0Squared = (g * horizontalDist * horizontalDist) /
            (2 * (horizontalDist * Math.tan(elevation) - dy) * Math.cos(elevation) * Math.cos(elevation));

        if (v0Squared > 0) {
            const v0 = Math.sqrt(v0Squared);
            power = v0 / 50;
        }

        power = Math.max(0.15, Math.min(1.0, power));

        if (this.difficulty === 'hard' && gameState.wind) {
            const windEffect = new THREE.Vector2(gameState.wind.x, gameState.wind.y);
            const flightTime = horizontalDist / (power * 50 * Math.cos(elevation));
            const windOffset = windEffect.multiplyScalar(flightTime * 0.5);
            const correctedAzimuth = Math.atan2(dx - windOffset.x, dz - windOffset.y);
            return { azimuth: correctedAzimuth, elevation, power };
        }

        return { azimuth, elevation, power };
    }

    _selectWeapon(tank, target, gameState) {
        if (this.difficulty === 'easy') return 0;

        const dist = tank.position.distanceTo(target.position);

        for (let i = WEAPON_DEFS.length - 1; i >= 1; i--) {
            if (tank.ammo[i] > 0) {
                const weapon = WEAPON_DEFS[i];
                if (weapon.special === 'shotgun' && dist < 15) return i;
                if (target.health <= weapon.damage * 0.8 && i <= 2) return i;
            }
        }

        if (tank.ammo[1] > 0 && target.health > 50) return 1;

        return 0;
    }
}
