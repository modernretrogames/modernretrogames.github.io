import * as THREE from 'three';
import { Player } from './player.js';
import { TurnManager } from './turn-manager.js';
import { TankRenderer } from './tank-renderer.js';
import { getDefaultAmmo, WEAPON_DEFS } from './weapons.js';
import { alignTankToTerrain } from './physics.js';

export const GamePhase = {
    MENU: 'menu',
    SETUP: 'setup',
    PLAYING: 'playing',
    AIMING: 'aiming',
    MOVING: 'moving',
    FIRING: 'firing',
    RESOLVING: 'resolving',
    GAME_OVER: 'game_over',
};

export class GameState {
    constructor() {
        this.phase = GamePhase.MENU;
        this.players = [];
        this.turnManager = new TurnManager();
        this.tankRenderers = new Map();
        this.voxelWorld = null;
        this.scene = null;
        this.cameraController = null;
        this.wind = new THREE.Vector2(0, 0);
        this.config = {
            aiOpponents: 1,
            tanksPerPlayer: 2,
            aiDifficulty: 'medium',
            mapSize: 'medium',
        };
        this.onPhaseChange = null;
        this.turnTimer = 0;
        this.turnTimeLimit = 30;
    }

    setReferences(voxelWorld, scene, cameraController) {
        this.voxelWorld = voxelWorld;
        this.scene = scene;
        this.cameraController = cameraController;
    }

    setPhase(newPhase) {
        const old = this.phase;
        this.phase = newPhase;
        if (this.onPhaseChange) {
            this.onPhaseChange(old, newPhase);
        }
    }

    initGame() {
        this.players = [];
        this.tankRenderers.forEach(r => r.dispose(this.scene));
        this.tankRenderers.clear();

        const humanPlayer = new Player(0, 'Player 1', false);
        humanPlayer.createTanks(this.config.tanksPerPlayer);
        this.players.push(humanPlayer);

        for (let i = 0; i < this.config.aiOpponents; i++) {
            const aiPlayer = new Player(i + 1, `AI ${i + 1}`, true);
            aiPlayer.createTanks(this.config.tanksPerPlayer);
            this.players.push(aiPlayer);
        }

        this._placeTanks();

        for (const player of this.players) {
            for (const tank of player.tanks) {
                tank.ammo = getDefaultAmmo();
                const renderer = new TankRenderer(tank);
                renderer.syncToTank();
                this.scene.add(renderer.group);
                this.tankRenderers.set(tank.id, renderer);
            }
        }

        this.turnManager.init(this.players);
        this._generateWind();
        this.setPhase(GamePhase.AIMING);
        this._focusCurrentTank();
    }

    _placeTanks() {
        const world = this.voxelWorld;
        const margin = Math.floor(world.sizeX * 0.1);
        const playerCount = this.players.length;

        for (let pi = 0; pi < playerCount; pi++) {
            const player = this.players[pi];
            const side = pi / (playerCount - 1 || 1);
            const baseX = Math.floor(margin + side * (world.sizeX - 2 * margin));

            for (let ti = 0; ti < player.tanks.length; ti++) {
                const tank = player.tanks[ti];
                const spreadZ = Math.floor(world.sizeZ * 0.3);
                const centerZ = Math.floor(world.sizeZ / 2);
                const offsetZ = (ti - (player.tanks.length - 1) / 2) * Math.floor(spreadZ / Math.max(player.tanks.length - 1, 1));
                const vx = baseX + Math.floor((Math.random() - 0.5) * 10);
                const vz = centerZ + offsetZ + Math.floor((Math.random() - 0.5) * 10);

                const clampedX = Math.max(2, Math.min(world.sizeX - 3, vx));
                const clampedZ = Math.max(2, Math.min(world.sizeZ - 3, vz));

                const topY = world.getHighestSolidY(clampedX, clampedZ);
                const wp = world.voxelToWorld(clampedX, topY + 1, clampedZ);

                tank.position.set(wp.x, wp.y, wp.z);
                alignTankToTerrain(tank, world);

                if (pi === 0) {
                    tank.turretAngle = 0;
                } else {
                    tank.turretAngle = Math.PI;
                }
            }
        }
    }

    _generateWind() {
        const angle = Math.random() * Math.PI * 2;
        const strength = Math.random() * 5;
        this.wind.set(Math.cos(angle) * strength, Math.sin(angle) * strength);
    }

    _focusCurrentTank() {
        const tank = this.turnManager.getCurrentTank();
        if (tank && this.cameraController) {
            this.cameraController.setTarget(tank.position.clone().add(new THREE.Vector3(0, 2, 0)));
        }
    }

    nextTurn() {
        const hasNext = this.turnManager.nextTurn();
        const winner = this.turnManager.checkWinCondition();
        if (winner !== false) {
            this.winner = winner;
            this.setPhase(GamePhase.GAME_OVER);
            return;
        }
        if (!hasNext) {
            this.setPhase(GamePhase.GAME_OVER);
            return;
        }
        this._generateWind();
        this.turnTimer = 0;
        this.setPhase(GamePhase.AIMING);
        this._focusCurrentTank();
    }

    update(dt) {
        const currentTank = this.turnManager.getCurrentTank();
        const currentTankId = currentTank ? currentTank.id : -1;

        for (const [id, renderer] of this.tankRenderers) {
            const tank = renderer.tank;
            if (tank.alive && !tank.falling && this.voxelWorld) {
                alignTankToTerrain(tank, this.voxelWorld);
            }
            renderer.syncToTank();
            renderer.updateHealthBar(this.cameraController?.camera);
            if (!tank.alive) {
                renderer.setVisible(false);
            }
            const isActive = this.phase === GamePhase.AIMING && id === currentTankId;
            renderer.setActive(isActive);
            renderer.updateActiveEffect(dt);
        }

        if (this.phase === GamePhase.AIMING) {
            this.turnTimer += dt;
        }
    }

    getCurrentWeapon() {
        const tank = this.turnManager.getCurrentTank();
        if (!tank) return WEAPON_DEFS[0];
        return WEAPON_DEFS[tank.activeWeaponIndex] || WEAPON_DEFS[0];
    }
}
