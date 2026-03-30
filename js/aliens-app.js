import * as THREE from 'three';
import { ParticleSystem } from './particles.js';
import { AudioManager } from './audio.js';
import { Player } from './aliens-player.js';
import { AlienFormation } from './aliens-enemies.js';
import { LaserManager } from './aliens-lasers.js';
import { ShieldManager } from './aliens-shields.js';
import { PowerUpManager } from './aliens-powerups.js';

const ARENA_SIZE = 100;
const clock = new THREE.Clock();

let renderer, scene;
let player;
let particleSystem;
let audio;
let alienFormation;
let laserManager;
let shieldManager;
let powerUpManager;
let ufo;

const Phase = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAME_OVER: 'game_over', WAVE_TRANSITION: 'wave_transition' };
let phase = Phase.MENU;

const state = {
    score: 0,
    highScore: parseInt(localStorage.getItem('aliens_highscore') || '0', 10),
    wave: 1,
    _scoreMultiplier: 1,
};

let waveTransitionTimer = 0;
let screenShakeTimer = 0;
let screenShakeIntensity = 0;
const cameraBasePos = new THREE.Vector3();

function initScene(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020010);

    const ambient = new THREE.AmbientLight(0x334466, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0x6688cc, 0.8);
    dirLight.position.set(20, 60, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    scene.add(dirLight);

    const topLight = new THREE.PointLight(0x4444aa, 0.4, 120);
    topLight.position.set(0, 50, -15);
    scene.add(topLight);

    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function createArenaFloor() {
    const gridHelper = new THREE.GridHelper(ARENA_SIZE, 50, 0x00ffaa, 0x003322);
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.4;
    scene.add(gridHelper);

    const floorGeo = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE);
    const floorMat = new THREE.MeshPhongMaterial({
        color: 0x050510,
        emissive: 0x010108,
        shininess: 80,
        transparent: true,
        opacity: 0.95,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(ARENA_SIZE, 0.1, ARENA_SIZE));
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.5 });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    edgeLines.position.y = 0.05;
    scene.add(edgeLines);
}

function createStarField() {
    const count = 2000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const radius = 150 + Math.random() * 200;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = Math.abs(radius * Math.cos(phi)) + 20;
        positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
        const brightness = 0.4 + Math.random() * 0.6;
        colors[i3] = brightness;
        colors[i3 + 1] = brightness;
        colors[i3 + 2] = brightness * (0.8 + Math.random() * 0.2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, opacity: 0.8 });
    scene.add(new THREE.Points(geo, mat));
}

// --- UFO Bonus Ship ---

class UFO {
    constructor(scene) {
        this.scene = scene;
        this.active = false;
        this.group = new THREE.Group();
        this.timer = 15 + Math.random() * 20;
        this.direction = 1;
        this.speed = 12;
        this.points = 0;

        const bodyGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0xff2200, emissive: 0x660000, shininess: 40 });
        const mesh = new THREE.InstancedMesh(bodyGeo, bodyMat, this._getUFOVoxels().length);
        const dummy = new THREE.Object3D();
        const voxels = this._getUFOVoxels();
        for (let i = 0; i < voxels.length; i++) {
            dummy.position.copy(voxels[i]);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = true;
        this.group.add(mesh);
        this.mesh = mesh;

        const glow = new THREE.PointLight(0xff2200, 2, 12);
        glow.position.set(0, -0.5, 0);
        this.group.add(glow);

        this.group.visible = false;
        scene.add(this.group);
        this.boundingRadius = 3;
    }

    _getUFOVoxels() {
        const pattern = [
            '......####......',
            '....########....',
            '..############..',
            '.##.###..###.##.',
            '################',
            '..###.####.###..',
            '....##....##....',
        ];
        const w = 16, h = 7;
        const voxels = [];
        const vs = 0.4;
        for (let row = 0; row < h; row++) {
            const line = pattern[row];
            for (let col = 0; col < w; col++) {
                if (col < line.length && line[col] === '#') {
                    for (let z = 0; z < 3; z++) {
                        voxels.push(new THREE.Vector3(
                            (col - w / 2 + 0.5) * vs,
                            (h - 1 - row) * vs,
                            (z - 1) * vs
                        ));
                    }
                }
            }
        }
        return voxels;
    }

    reset() {
        this.active = false;
        this.group.visible = false;
        this.timer = 15 + Math.random() * 20;
    }

    update(dt) {
        if (this.active) {
            this.group.position.x += this.direction * this.speed * dt;
            this.group.rotation.y += dt * 0.5;
            if (Math.abs(this.group.position.x) > 60) {
                this.active = false;
                this.group.visible = false;
                this.timer = 15 + Math.random() * 20;
            }
            return;
        }

        this.timer -= dt;
        if (this.timer <= 0) {
            this._spawn();
        }
    }

    _spawn() {
        this.active = true;
        this.group.visible = true;
        this.direction = Math.random() > 0.5 ? 1 : -1;
        this.group.position.set(
            -this.direction * 58,
            55,
            -15
        );
        this.points = [50, 100, 150, 200, 300][Math.floor(Math.random() * 5)];
    }

    getWorldPos() {
        return this.group.position.clone();
    }

    hit(particleSystem, audioMgr) {
        if (!this.active) return 0;
        this.active = false;
        this.group.visible = false;
        this.timer = 20 + Math.random() * 15;
        if (particleSystem) {
            particleSystem.emit(this.group.position.clone(), 30, {
                color: new THREE.Color(0xff4400),
                speed: 12, spread: 1.5, life: 1, size: 0.4, gravity: true,
            });
        }
        if (audioMgr) audioMgr.play('explosion', { radius: 4 });
        return this.points;
    }
}

// --- Screen shake ---

function triggerScreenShake(intensity, duration) {
    screenShakeIntensity = intensity;
    screenShakeTimer = duration;
}

function applyScreenShake(dt) {
    if (screenShakeTimer > 0) {
        screenShakeTimer -= dt;
        const shakeX = (Math.random() - 0.5) * screenShakeIntensity;
        const shakeY = (Math.random() - 0.5) * screenShakeIntensity;
        player.camera.position.x += shakeX;
        player.camera.position.y += shakeY;
    }
}

// --- Init & Game Logic ---

function init() {
    const canvas = document.getElementById('game-canvas');
    initScene(canvas);

    player = new Player(canvas);
    particleSystem = new ParticleSystem(scene);
    audio = new AudioManager();

    createArenaFloor();
    createStarField();

    alienFormation = new AlienFormation(scene);
    laserManager = new LaserManager(scene, particleSystem, audio);
    shieldManager = new ShieldManager(scene);
    powerUpManager = new PowerUpManager(scene, particleSystem);
    ufo = new UFO(scene);

    window._alienFormation = alienFormation;
    window._laserManager = laserManager;
    window._shieldManager = shieldManager;
    window._powerUpManager = powerUpManager;

    setupUI();
    updateHUD();
    showMenu();

    requestAnimationFrame(gameLoop);
}

function setupUI() {
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', startGame);
    document.getElementById('resume-btn').addEventListener('click', resumeGame);
    document.getElementById('quit-btn').addEventListener('click', quitToMenu);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (phase === Phase.PLAYING) pauseGame();
            else if (phase === Phase.PAUSED) resumeGame();
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (e.button === 0 && phase === Phase.PLAYING && player.isLocked) {
            tryFire();
        }
    });

    document.getElementById('menu-highscore').textContent =
        state.highScore > 0 ? `HIGH SCORE: ${state.highScore}` : '';
}

function showMenu() {
    phase = Phase.MENU;
    document.getElementById('menu-screen').classList.remove('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('aliens-hud').classList.add('hidden');
    document.getElementById('crosshair').classList.add('hidden');
    player.exitPointerLock();

    alienFormation.formationGroup.visible = false;
    for (const s of shieldManager.shields) {
        s.group.visible = false;
    }
    ufo.group.visible = false;
}

function startGame() {
    phase = Phase.PLAYING;
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('aliens-hud').classList.remove('hidden');
    document.getElementById('crosshair').classList.remove('hidden');

    state.score = 0;
    state.wave = 1;
    state._scoreMultiplier = 1;

    player.reset();
    player.requestPointerLock();

    alienFormation.formationGroup.visible = true;
    alienFormation.reset(state.wave);
    laserManager.clear();
    shieldManager.reset();
    for (const s of shieldManager.shields) {
        s.group.visible = true;
    }
    powerUpManager.clear();
    ufo.reset();
    ufo.group.visible = false;

    audio.play('waveStart');
    updateHUD();
}

function pauseGame() {
    phase = Phase.PAUSED;
    document.getElementById('pause-screen').classList.remove('hidden');
    document.getElementById('crosshair').classList.add('hidden');
    player.exitPointerLock();
}

function resumeGame() {
    phase = Phase.PLAYING;
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('crosshair').classList.remove('hidden');
    player.requestPointerLock();
}

function quitToMenu() {
    showMenu();
}

function gameOver() {
    phase = Phase.GAME_OVER;
    document.getElementById('crosshair').classList.add('hidden');
    player.exitPointerLock();

    const isNew = state.score > state.highScore;
    if (isNew) {
        state.highScore = state.score;
        localStorage.setItem('aliens_highscore', state.score.toString());
    }

    document.getElementById('final-score').textContent = `SCORE: ${state.score}`;
    const newHs = document.getElementById('new-highscore');
    if (isNew) newHs.classList.remove('hidden');
    else newHs.classList.add('hidden');

    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('aliens-hud').classList.add('hidden');
}

function tryFire() {
    if (!player.canFire()) return;
    player.fire();

    const origin = player.getFireOrigin();
    const dir = player.getFireDirection();

    if (player.spreadShot) {
        laserManager.firePlayerSpread(origin, dir);
    } else {
        laserManager.firePlayerLaser(origin, dir);
    }
}

function updateHUD() {
    document.getElementById('hud-score').textContent = state.score;
    document.getElementById('hud-highscore').textContent = `HI: ${state.highScore}`;
    document.getElementById('hud-wave').textContent = `WAVE ${state.wave}`;

    const livesEl = document.getElementById('hud-lives');
    livesEl.innerHTML = '';
    for (let i = 0; i < player.lives; i++) {
        const icon = document.createElement('span');
        icon.className = 'life-icon';
        icon.textContent = '\u2665';
        livesEl.appendChild(icon);
    }
}

function nextWave() {
    state.wave++;
    phase = Phase.WAVE_TRANSITION;
    waveTransitionTimer = 2.0;
    laserManager.clear();
    audio.play('waveStart');

    showWaveAnnouncement(`WAVE ${state.wave}`);
}

function showWaveAnnouncement(text) {
    const el = document.createElement('div');
    el.className = 'wave-announcement';
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 500);
    }, 1500);
}

function checkUFOHit() {
    if (!ufo.active) return;
    for (const laser of laserManager.pool) {
        if (!laser.active || !laser.isPlayer) continue;
        const dist = laser.position.distanceTo(ufo.getWorldPos());
        if (dist < ufo.boundingRadius) {
            const pts = ufo.hit(particleSystem, audio);
            state.score += pts * state._scoreMultiplier;
            showWaveAnnouncement(`UFO: +${pts}`);
            laser.deactivate();
            updateHUD();
            return;
        }
    }
}

function gameLoop() {
    requestAnimationFrame(gameLoop);

    const dt = Math.min(clock.getDelta(), 0.05);

    if (phase === Phase.PLAYING) {
        player.update(dt);
        particleSystem.update(dt);

        alienFormation.update(dt, state);
        const laserResult = laserManager.update(dt, alienFormation, shieldManager, player, powerUpManager, state);

        if (laserResult) {
            if (laserResult.playerHit) {
                const wasHit = player.hit();
                if (wasHit) {
                    audio.play('playerDeath');
                    triggerScreenShake(0.3, 0.3);
                    particleSystem.emit(player.getFireOrigin(), 30, {
                        color: new THREE.Color(1, 0.3, 0.1),
                        speed: 8, spread: 1, life: 1, size: 0.3,
                    });
                }
                if (!player.alive) {
                    gameOver();
                    return;
                }
            }
            if (laserResult.scoreAdded) {
                updateHUD();
            }
        }

        shieldManager.update(dt);
        powerUpManager.update(dt, player, state, audio);

        ufo.update(dt);
        checkUFOHit();

        if (alienFormation.allDead()) {
            nextWave();
        }

        if (alienFormation.getFormationBottom() < 3) {
            gameOver();
            return;
        }

        applyScreenShake(dt);
        updateHUD();

    } else if (phase === Phase.WAVE_TRANSITION) {
        particleSystem.update(dt);
        waveTransitionTimer -= dt;
        if (waveTransitionTimer <= 0) {
            phase = Phase.PLAYING;
            alienFormation.reset(state.wave);
            shieldManager.reset();
            powerUpManager.clear();
            ufo.reset();
            updateHUD();
        }
    } else {
        particleSystem.update(dt);
    }

    renderer.render(scene, player.camera);
}

document.addEventListener('DOMContentLoaded', init);
