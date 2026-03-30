import * as THREE from 'three';
import { initScene, getScene, render } from './scene.js';
import { CameraController } from './camera.js';
import { VoxelWorld } from './voxel-world.js';
import { generateTerrain, terrainConfig } from './terrain-gen.js';
import { buildChunkMesh, chunkMaterial } from './chunk-mesher.js';
import { GameState, GamePhase } from './game-state.js';
import { HUD } from './hud.js';
import { UI, showToast, initTheme } from './ui.js';
import { Projectile, ProjectileRenderer } from './projectile.js';
import { createExplosion, calculateDamage, createExplosionVisual } from './explosion.js';
import { checkAndApplyGravity, updateFallingTank, applyKnockback, startMoving, updateMovingTank } from './physics.js';
import { ParticleSystem } from './particles.js';
import { AIController } from './ai.js';
import { WEAPON_DEFS } from './weapons.js';
import { AudioManager } from './audio.js';

const clock = new THREE.Clock();
let cameraController;
let voxelWorld;
let gameState;
let hud;
let ui;
let particleSystem;
let projectile;
let projectileRenderer;
let aiController;
let audio;
let explosionVisuals = [];
let debugEl;
let allTanks = [];

const MAP_SIZES = {
    small:  { x: 256, y: 48, z: 256 },
    medium: { x: 512, y: 60, z: 512 },
    large:  { x: 1024, y: 96, z: 1024 },
};

function init() {
    initTheme();

    const canvas = document.getElementById('game-canvas');
    initScene(canvas);
    const scene = getScene();

    cameraController = new CameraController();
    audio = new AudioManager();
    particleSystem = new ParticleSystem(scene);
    projectile = new Projectile();
    projectileRenderer = new ProjectileRenderer(scene, particleSystem);
    gameState = new GameState();
    hud = new HUD(gameState);
    ui = new UI();

    gameState.onPhaseChange = onPhaseChange;

    ui.onStartGame = (config) => startGame(config);
    hud.onFire = () => fireProjectile();
    hud.onMove = () => moveTank();
    hud.onSkip = () => skipTurn();
    hud.onFollowToggle = (active) => {
        const tank = gameState.turnManager.getCurrentTank();
        if (active && tank) {
            cameraController.setFollowTank(tank);
        } else {
            cameraController.clearFollowTank();
        }
    };

    hud.hide();
    ui.showMenu();

    debugEl = document.createElement('div');
    debugEl.id = 'debug-overlay';
    document.body.appendChild(debugEl);

    requestAnimationFrame(gameLoop);
}

function startGame(config) {
    const scene = getScene();

    if (voxelWorld) {
        voxelWorld.chunkMeshes.forEach(m => {
            scene.remove(m);
            m.geometry.dispose();
        });
        voxelWorld.chunkMeshes.clear();
    }
    gameState.tankRenderers.forEach(r => r.dispose(scene));
    gameState.tankRenderers.clear();

    if (config) {
        gameState.config = { ...gameState.config, ...config };
    }

    const mapDef = MAP_SIZES[gameState.config.mapSize] || MAP_SIZES.medium;
    voxelWorld = new VoxelWorld(mapDef.x, mapDef.y, mapDef.z, 0.5);
    voxelWorld.setMesher(buildChunkMesh, chunkMaterial);
    const seed = Math.floor(Math.random() * 100000);
    generateTerrain(voxelWorld, seed);
    buildAllChunks(scene);

    gameState.setReferences(voxelWorld, scene, cameraController);
    gameState.initGame();

    allTanks = [];
    for (const p of gameState.players) {
        allTanks.push(...p.tanks);
    }

    aiController = new AIController(gameState.config.aiDifficulty);

    const center = voxelWorld.voxelToWorld(
        Math.floor(voxelWorld.sizeX / 2), 15,
        Math.floor(voxelWorld.sizeZ / 2)
    );
    cameraController.setTarget(new THREE.Vector3(center.x, center.y, center.z));

    ui.hideAll();
    hud.show();
    hud.syncFromTank();
    showToast(`${gameState.turnManager.getCurrentPlayer().name}'s turn`);
}

function buildAllChunks(scene) {
    const cs = voxelWorld.chunkSize;
    const chunksX = Math.ceil(voxelWorld.sizeX / cs);
    const chunksY = Math.ceil(voxelWorld.sizeY / cs);
    const chunksZ = Math.ceil(voxelWorld.sizeZ / cs);

    for (let cy = 0; cy < chunksY; cy++) {
        for (let cz = 0; cz < chunksZ; cz++) {
            for (let cx = 0; cx < chunksX; cx++) {
                const geo = buildChunkMesh(voxelWorld, cx, cy, cz);
                if (geo) {
                    const mesh = new THREE.Mesh(geo, chunkMaterial);
                    mesh.receiveShadow = true;
                    mesh.castShadow = true;
                    const wp = voxelWorld.voxelToWorld(cx * cs, cy * cs, cz * cs);
                    mesh.position.set(wp.x, wp.y, wp.z);
                    mesh.userData.chunkKey = `${cx},${cy},${cz}`;
                    scene.add(mesh);
                    voxelWorld.chunkMeshes.set(mesh.userData.chunkKey, mesh);
                }
            }
        }
    }
}

function onPhaseChange(oldPhase, newPhase) {
    if (newPhase === GamePhase.AIMING) {
        const player = gameState.turnManager.getCurrentPlayer();
        if (player.isAI) {
            handleAITurn();
        }
    }
    if (newPhase === GamePhase.GAME_OVER) {
        hud.hide();
        ui.showGameOver(gameState.winner);
    }
}

function handleAITurn() {
    const player = gameState.turnManager.getCurrentPlayer();
    showToast(`${player.name} is thinking...`);

    setTimeout(() => {
        const result = aiController.takeTurn(player, gameState);
        if (!result) {
            skipTurn();
            return;
        }

        const tank = gameState.turnManager.getCurrentTank();

        if (result.action === 'move') {
            tank.turretAngle = result.azimuth;
            setTimeout(() => {
                moveTank();
            }, 500);
            return;
        }

        tank.turretAngle = result.azimuth;
        tank.barrelElevation = result.elevation;
        tank.activeWeaponIndex = result.weaponIndex;

        setTimeout(() => {
            fireProjectile(result.power);
        }, 800);
    }, 1000);
}

function fireProjectile(forcePower) {
    const tank = gameState.turnManager.getCurrentTank();
    if (!tank) return;

    const weapon = WEAPON_DEFS[tank.activeWeaponIndex] || WEAPON_DEFS[0];
    if (tank.ammo[tank.activeWeaponIndex] <= 0) {
        showToast('No ammo for this weapon!');
        return;
    }
    if (tank.ammo[tank.activeWeaponIndex] !== Infinity) {
        tank.ammo[tank.activeWeaponIndex]--;
    }

    const power = forcePower !== undefined ? forcePower : hud.getPower();
    const origin = tank.getBarrelTip();
    const direction = tank.getFireDirection();

    if (weapon.special === 'shotgun') {
        fireShotgun(tank, origin, direction, power, weapon);
        return;
    }

    if (cameraController.isFollowing) {
        cameraController.clearFollowTank();
        hud.setFollowing(false);
    }

    particleSystem.emit(origin, 15, {
        color: new THREE.Color(1, 0.7, 0.2),
        speed: 8,
        spread: 0.4,
        life: 0.3,
        size: 0.2,
    });
    particleSystem.emit(origin, 10, {
        color: new THREE.Color(0.6, 0.6, 0.6),
        speed: 4,
        spread: 0.6,
        life: 1,
        size: 0.3,
        gravity: false,
    });

    projectile.fire(origin, direction, power, weapon, gameState.wind);
    projectile.owner = tank.id;
    gameState.setPhase(GamePhase.FIRING);
    audio.play('fire', { pitch: weapon.projectileSpeed });
    showToast('Fire!');
}

function fireShotgun(tank, origin, direction, power, weapon) {
    gameState.setPhase(GamePhase.FIRING);
    audio.play('fire', { pitch: 1.5 });

    const pellets = [];
    for (let i = 0; i < 5; i++) {
        const p = new Projectile();
        const spread = new THREE.Vector3(
            direction.x + (Math.random() - 0.5) * 0.15,
            direction.y + (Math.random() - 0.5) * 0.1,
            direction.z + (Math.random() - 0.5) * 0.15
        ).normalize();
        p.fire(origin.clone(), spread, power, weapon, gameState.wind);
        p.owner = tank.id;
        p.isChild = true;
        pellets.push(p);
    }
    projectile._shotgunPellets = pellets;
    projectile.active = false;
    projectile._isShotgunMode = true;
}

function handleClusterSplit(position, velocity) {
    const weapon = projectile.weapon;
    const children = [];
    for (let i = 0; i < 5; i++) {
        const child = new Projectile();
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            Math.random() * 3,
            (Math.random() - 0.5) * 8
        );
        child.position.copy(position);
        child.velocity.copy(velocity).add(offset);
        child.active = true;
        child.weapon = weapon;
        child.owner = projectile.owner;
        child.isChild = true;
        child.hasPassedApex = true;
        child.wind = projectile.wind;
        children.push(child);
    }
    projectile.active = false;
    projectile.children = children;
}

function handleImpact(result) {
    const scene = getScene();
    const weapon = projectile.weapon || WEAPON_DEFS[0];
    const impactPos = result.position;

    createExplosion(voxelWorld, impactPos, weapon.blastRadius, particleSystem);
    voxelWorld.rebuildDirtyChunks(scene);

    const vis = createExplosionVisual(scene, impactPos, weapon.blastRadius);
    explosionVisuals.push(vis);

    audio.play('explosion', { radius: weapon.blastRadius });

    for (const tank of allTanks) {
        if (!tank.alive) continue;
        const dmg = calculateDamage(tank.position, impactPos, weapon);
        if (dmg > 0) {
            tank.takeDamage(dmg);
            showToast(`${dmg} damage!`);
            applyKnockback(tank, impactPos, weapon.blastRadius);
        }
    }

    cameraController.setTarget(impactPos.clone().add(new THREE.Vector3(0, 3, 0)));

    checkAndApplyGravity(allTanks, voxelWorld);

    gameState.setPhase(GamePhase.RESOLVING);
}

function moveTank() {
    const tank = gameState.turnManager.getCurrentTank();
    if (!tank) return;

    if (cameraController.isFollowing) {
        cameraController.clearFollowTank();
        hud.setFollowing(false);
    }

    startMoving(tank);
    gameState.setPhase(GamePhase.MOVING);
    showToast('Moving!');
}

function skipTurn() {
    if (cameraController.isFollowing) {
        cameraController.clearFollowTank();
        hud.setFollowing(false);
    }
    gameState.nextTurn();
    if (gameState.phase === GamePhase.AIMING) {
        hud.syncFromTank();
        showToast(`${gameState.turnManager.getCurrentPlayer().name}'s turn`);
    }
}

let frameCount = 0;
let fpsTime = 0;
let fps = 0;
let resolveTimer = 0;

function gameLoop() {
    requestAnimationFrame(gameLoop);

    const dt = Math.min(clock.getDelta(), 0.05);

    frameCount++;
    fpsTime += dt;
    if (fpsTime >= 1) {
        fps = frameCount;
        frameCount = 0;
        fpsTime = 0;
    }

    cameraController.update(dt);
    particleSystem.update(dt);

    for (let i = explosionVisuals.length - 1; i >= 0; i--) {
        const done = explosionVisuals[i].update(dt);
        if (done) {
            explosionVisuals[i].dispose();
            explosionVisuals.splice(i, 1);
        }
    }

    if (gameState.phase === GamePhase.FIRING) {
        updateProjectiles(dt);
    }

    if (gameState.phase === GamePhase.MOVING) {
        const tank = gameState.turnManager.getCurrentTank();
        if (tank && tank.moving) {
            cameraController.setTarget(tank.position.clone().add(new THREE.Vector3(0, 2, 0)));

            const rearOffset = tank.moveDirection.clone().multiplyScalar(-1.3);
            rearOffset.y += 0.3;
            const smokePos = tank.position.clone().add(rearOffset);
            particleSystem.emit(smokePos, 3, {
                color: new THREE.Color(0.5, 0.5, 0.5),
                speed: 1.2,
                spread: 0.5,
                life: 1.5,
                size: 0.25,
                gravity: false,
            });

            const result = updateMovingTank(tank, voxelWorld, dt);
            if (result) {
                if (result.type === 'blocked') {
                    showToast('Too steep to climb!');
                } else if (result.type === 'edge') {
                    showToast('Reached the map edge!');
                }
                checkAndApplyGravity(allTanks, voxelWorld);
                gameState.setPhase(GamePhase.RESOLVING);
            }
        } else {
            checkAndApplyGravity(allTanks, voxelWorld);
            gameState.setPhase(GamePhase.RESOLVING);
        }
    }

    if (gameState.phase === GamePhase.RESOLVING) {
        let anyFalling = false;
        for (const tank of allTanks) {
            if (tank.falling && tank.alive) {
                const result = updateFallingTank(tank, voxelWorld, dt);
                anyFalling = true;
                if (result) {
                    if (result.type === 'fall_damage') {
                        showToast(`Fall damage: ${result.damage}!`);
                    }
                    if (result.type === 'destroyed') {
                        showToast('Tank destroyed!');
                    }
                }
            }
        }

        if (!anyFalling) {
            resolveTimer += dt;
            if (resolveTimer > 1.0) {
                resolveTimer = 0;
                if (cameraController.isFollowing) {
                    cameraController.clearFollowTank();
                    hud.setFollowing(false);
                }
                gameState.nextTurn();
                if (gameState.phase === GamePhase.AIMING) {
                    hud.syncFromTank();
                    showToast(`${gameState.turnManager.getCurrentPlayer().name}'s turn`);
                }
            }
        } else {
            resolveTimer = 0;
        }
    }

    if (gameState) {
        gameState.update(dt);
    }

    if (hud && gameState.phase === GamePhase.AIMING) {
        hud.update();
    }

    render(cameraController.camera);

    if (debugEl) {
        debugEl.textContent = `FPS: ${fps} | Phase: ${gameState.phase}`;
    }
}

function updateProjectiles(dt) {
    if (projectile._isShotgunMode && projectile._shotgunPellets) {
        let anyActive = false;
        const impacts = [];
        for (const pellet of projectile._shotgunPellets) {
            if (!pellet.active) continue;
            anyActive = true;
            const result = pellet.update(dt, voxelWorld, allTanks);
            if (result) {
                if (result.type === 'terrain_hit' || result.type === 'tank_hit') {
                    impacts.push({ result, weapon: pellet.weapon });
                }
            }
        }

        if (impacts.length > 0) {
            for (const impact of impacts) {
                const scene = getScene();
                const weapon = impact.weapon || WEAPON_DEFS[0];
                createExplosion(voxelWorld, impact.result.position, weapon.blastRadius, particleSystem);
                voxelWorld.rebuildDirtyChunks(scene);
                const vis = createExplosionVisual(scene, impact.result.position, weapon.blastRadius);
                explosionVisuals.push(vis);
                audio.play('explosion', { radius: weapon.blastRadius });

                for (const tank of allTanks) {
                    if (!tank.alive) continue;
                    const dmg = calculateDamage(tank.position, impact.result.position, weapon);
                    if (dmg > 0) {
                        tank.takeDamage(dmg);
                        applyKnockback(tank, impact.result.position, weapon.blastRadius);
                    }
                }
            }
        }

        if (!anyActive) {
            projectile._isShotgunMode = false;
            projectile._shotgunPellets = null;
            checkAndApplyGravity(allTanks, voxelWorld);
            gameState.setPhase(GamePhase.RESOLVING);
        }
        return;
    }

    if (projectile.children.length > 0) {
        let anyActive = false;
        for (const child of projectile.children) {
            if (!child.active) continue;
            anyActive = true;
            const result = child.update(dt, voxelWorld, allTanks);
            if (result && (result.type === 'terrain_hit' || result.type === 'tank_hit')) {
                const scene = getScene();
                const weapon = child.weapon || WEAPON_DEFS[0];
                createExplosion(voxelWorld, result.position, weapon.blastRadius, particleSystem);
                voxelWorld.rebuildDirtyChunks(scene);
                const vis = createExplosionVisual(scene, result.position, weapon.blastRadius);
                explosionVisuals.push(vis);
                audio.play('explosion', { radius: weapon.blastRadius });

                for (const tank of allTanks) {
                    if (!tank.alive) continue;
                    const dmg = calculateDamage(tank.position, result.position, weapon);
                    if (dmg > 0) {
                        tank.takeDamage(dmg);
                        applyKnockback(tank, result.position, weapon.blastRadius);
                    }
                }
            }
        }

        if (!anyActive) {
            projectile.children = [];
            checkAndApplyGravity(allTanks, voxelWorld);
            gameState.setPhase(GamePhase.RESOLVING);
        }
        return;
    }

    if (projectile.active) {
        const result = projectile.update(dt, voxelWorld, allTanks);
        projectileRenderer.show(projectile);

        cameraController.setTarget(projectile.position.clone().add(new THREE.Vector3(0, 2, 0)));

        if (result) {
            projectileRenderer.hide();
            if (result.type === 'cluster_split') {
                handleClusterSplit(result.position, result.velocity);
                showToast('Cluster bomb splits!');
            } else if (result.type === 'terrain_hit' || result.type === 'tank_hit') {
                handleImpact(result);
            } else if (result.type === 'out_of_bounds') {
                showToast('Shot missed!');
                checkAndApplyGravity(allTanks, voxelWorld);
                gameState.setPhase(GamePhase.RESOLVING);
            }
        }
    } else if (projectile.children.length === 0 && !projectile._isShotgunMode) {
        projectileRenderer.hide();
        gameState.setPhase(GamePhase.RESOLVING);
    }
}

document.addEventListener('DOMContentLoaded', init);
