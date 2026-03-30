import * as THREE from 'three';
import { VoxelWorld } from './voxel-world.js?v=2';
import { generateTerrain } from './terrain-gen.js';
import { buildChunkMesh, chunkMaterial } from './chunk-mesher.js?v=2';
import { ParticleSystem } from './particles.js';
import { AudioManager } from './audio.js';
import { MissilePlayer } from './missile-player.js?v=2';
import { CityManager } from './missile-cities.js';
import { InterceptorManager, Battery } from './missile-interceptors.js?v=2';
import { WarheadManager } from './missile-warheads.js';
import { MissilePowerUpManager } from './missile-powerups.js';

const WORLD_SIZE_X = 192;
const WORLD_SIZE_Y = 64;
const WORLD_SIZE_Z = 192;
const VOXEL_SIZE = 0.5;

const clock = new THREE.Clock();

let renderer, scene;
let world;
let player;
let particleSystem;
let audio;
let cityManager;
let interceptorManager;
let warheadManager;
let bomber;
let powerUpManager;
let waveTransitionTimer = 0;

const Phase = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'game_over',
    WAVE_TRANSITION: 'wave_transition',
};
let phase = Phase.MENU;

const BONUS_CITY_THRESHOLD = 10000;
const MAX_HIGH_SCORES = 10;
const HS_STORAGE_KEY = 'missile_highscores';

function loadHighScores() {
    try {
        const raw = localStorage.getItem(HS_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore corrupt data */ }
    return [];
}

function saveHighScores(scores) {
    localStorage.setItem(HS_STORAGE_KEY, JSON.stringify(scores));
}

function isHighScore(score) {
    const scores = loadHighScores();
    return scores.length < MAX_HIGH_SCORES || score > scores[scores.length - 1].score;
}

function insertHighScore(name, score, wave) {
    const scores = loadHighScores();
    const entry = { name: name.toUpperCase(), score, wave };
    scores.push(entry);
    scores.sort((a, b) => b.score - a.score);
    if (scores.length > MAX_HIGH_SCORES) scores.length = MAX_HIGH_SCORES;
    saveHighScores(scores);
    return scores.indexOf(entry);
}

function renderHighScoreTable(containerId, highlightIndex) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const scores = loadHighScores();
    if (scores.length === 0) {
        el.innerHTML = '<div class="hs-header">HIGH SCORES</div><div class="hs-empty">NO SCORES YET</div>';
        return;
    }
    let html = '<div class="hs-header">HIGH SCORES</div><table><tr><th>#</th><th>NAME</th><th>SCORE</th></tr>';
    scores.forEach((s, i) => {
        const cls = i === highlightIndex ? ' class="hs-current"' : '';
        html += `<tr${cls}><td>${i + 1}.</td><td>${s.name}</td><td>${s.score.toLocaleString()}</td></tr>`;
    });
    html += '</table>';
    el.innerHTML = html;
}

const state = {
    score: 0,
    wave: 1,
    nextBonusCityAt: BONUS_CITY_THRESHOLD,
    scoreMultiplier: 1,
};

let screenShakeTimer = 0;
let screenShakeIntensity = 0;

class Bomber {
    constructor(scene, particleSystem) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.active = false;
        this.timer = 20 + Math.random() * 25;
        this.direction = 1;
        this.speed = 15;
        this.points = 200;
        this.position = new THREE.Vector3();
        this.boundingRadius = 3;

        this.group = new THREE.Group();
        this._buildMesh();
        this.group.visible = false;
        scene.add(this.group);
    }

    _buildMesh() {
        const bodyGeo = new THREE.BoxGeometry(4, 0.6, 1.2);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x556666, emissive: 0x112222 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        this.group.add(body);

        const wingGeo = new THREE.BoxGeometry(1.5, 0.1, 6);
        const wingMat = new THREE.MeshPhongMaterial({ color: 0x445555, emissive: 0x112222 });
        const wing = new THREE.Mesh(wingGeo, wingMat);
        wing.position.set(-0.3, 0.1, 0);
        this.group.add(wing);

        const tailGeo = new THREE.BoxGeometry(0.6, 1.2, 0.4);
        const tail = new THREE.Mesh(tailGeo, wingMat);
        tail.position.set(-1.8, 0.6, 0);
        this.group.add(tail);

        const light = new THREE.PointLight(0xff4400, 1, 15);
        light.position.set(2, -0.3, 0);
        this.group.add(light);
        this.engineLight = light;
    }

    reset() {
        this.active = false;
        this.group.visible = false;
        this.timer = 20 + Math.random() * 25;
    }

    update(dt) {
        if (this.active) {
            this.position.x += this.direction * this.speed * dt;
            this.group.position.copy(this.position);
            this.group.rotation.y = this.direction > 0 ? 0 : Math.PI;

            this.engineLight.intensity = 0.8 + Math.sin(performance.now() * 0.01) * 0.4;

            if (Math.abs(this.position.x) > 80) {
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
        this.position.set(
            -this.direction * 75,
            40 + Math.random() * 15,
            -20 + Math.random() * 10
        );
        this.group.position.copy(this.position);
        this.points = [150, 200, 300, 500][Math.floor(Math.random() * 4)];
    }

    checkHit(blasts) {
        if (!this.active) return 0;
        for (const blast of blasts) {
            const dist = this.position.distanceTo(blast.position);
            if (dist <= blast.radius + this.boundingRadius) {
                return this._destroy();
            }
        }
        return 0;
    }

    _destroy() {
        this.active = false;
        this.group.visible = false;
        this.timer = 20 + Math.random() * 15;

        if (this.particleSystem) {
            this.particleSystem.emit(this.position.clone(), 50, {
                color: new THREE.Color(1, 0.5, 0.1),
                speed: 15,
                spread: 1.5,
                life: 1.5,
                size: 0.4,
            });
            this.particleSystem.emit(this.position.clone(), 30, {
                color: new THREE.Color(0.4, 0.4, 0.4),
                speed: 8,
                spread: 1.2,
                life: 3,
                size: 0.5,
                gravity: false,
            });
        }

        return this.points;
    }
}

function initScene(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020008);
    scene.fog = new THREE.FogExp2(0x020008, 0.004);

    const ambient = new THREE.AmbientLight(0x223344, 0.5);
    scene.add(ambient);

    const moonLight = new THREE.DirectionalLight(0x445577, 0.6);
    moonLight.position.set(40, 80, -30);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    moonLight.shadow.camera.near = 1;
    moonLight.shadow.camera.far = 250;
    moonLight.shadow.camera.left = -80;
    moonLight.shadow.camera.right = 80;
    moonLight.shadow.camera.top = 80;
    moonLight.shadow.camera.bottom = -80;
    scene.add(moonLight);

    const horizonGlow = new THREE.PointLight(0xff4400, 0.3, 200);
    horizonGlow.position.set(0, 5, -60);
    scene.add(horizonGlow);

    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function createStarField() {
    const count = 3000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const radius = 200 + Math.random() * 300;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.5;
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = Math.abs(radius * Math.cos(phi)) + 30;
        positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
        const brightness = 0.3 + Math.random() * 0.7;
        colors[i3] = brightness;
        colors[i3 + 1] = brightness * (0.9 + Math.random() * 0.1);
        colors[i3 + 2] = brightness * (0.7 + Math.random() * 0.3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.6, vertexColors: true, transparent: true, opacity: 0.9 });
    scene.add(new THREE.Points(geo, mat));
}

function initWorld() {
    world = new VoxelWorld(WORLD_SIZE_X, WORLD_SIZE_Y, WORLD_SIZE_Z, VOXEL_SIZE);
    world.setMesher(buildChunkMesh, chunkMaterial);

    const offsetX = -(WORLD_SIZE_X * VOXEL_SIZE) / 2;
    const offsetZ = -(WORLD_SIZE_Z * VOXEL_SIZE) / 2;
    world.setWorldOffset(offsetX, offsetZ);

    generateTerrain(world, 777);

    const cs = world.chunkSize;
    const chunksX = Math.ceil(WORLD_SIZE_X / cs);
    const chunksY = Math.ceil(WORLD_SIZE_Y / cs);
    const chunksZ = Math.ceil(WORLD_SIZE_Z / cs);

    for (let cy = 0; cy < chunksY; cy++) {
        for (let cz = 0; cz < chunksZ; cz++) {
            for (let cx = 0; cx < chunksX; cx++) {
                world.dirtyChunks.add(`${cx},${cy},${cz}`);
            }
        }
    }

    cityManager = new CityManager(world, scene);
    cityManager.generateCities(6);

    world.rebuildDirtyChunks(scene);
}

function initBatteries() {
    const offsetX = -(WORLD_SIZE_X * VOXEL_SIZE) / 2;
    const offsetZ = -(WORLD_SIZE_Z * VOXEL_SIZE) / 2;
    const centerX = Math.floor(WORLD_SIZE_X / 2);
    const centerZ = Math.floor(WORLD_SIZE_Z / 2);

    const batteryPositions = [
        { vx: centerX - 30, vz: centerZ + 10, name: 'LEFT' },
        { vx: centerX, vz: centerZ + 15, name: 'CENTER' },
        { vx: centerX + 30, vz: centerZ + 10, name: 'RIGHT' },
    ];

    const batteries = batteryPositions.map(bp => {
        const groundY = world.getHighestSolidY(bp.vx, bp.vz);
        const wp = world.voxelToWorld(bp.vx, groundY + 1, bp.vz);
        return new Battery(wp.x + offsetX, wp.y + 1, wp.z + offsetZ, bp.name);
    });

    interceptorManager.setBatteries(batteries);

    for (const battery of batteries) {
        const padGeo = new THREE.CylinderGeometry(1.2, 1.5, 0.6, 8);
        const padMat = new THREE.MeshPhongMaterial({ color: 0x556677, emissive: 0x111122 });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.copy(battery.position);
        pad.position.y -= 0.3;
        scene.add(pad);

        const tubeGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.5, 6);
        const tubeMat = new THREE.MeshPhongMaterial({ color: 0x889999, emissive: 0x112233 });
        const tube = new THREE.Mesh(tubeGeo, tubeMat);
        tube.position.copy(battery.position);
        tube.position.y += 0.5;
        scene.add(tube);
    }
}

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

function init() {
    const canvas = document.getElementById('game-canvas');
    initScene(canvas);
    createStarField();

    initWorld();

    player = new MissilePlayer(canvas, world);
    particleSystem = new ParticleSystem(scene);
    audio = new AudioManager();

    interceptorManager = new InterceptorManager(scene, particleSystem, audio);
    initBatteries();
    warheadManager = new WarheadManager(scene, world, particleSystem, audio, cityManager, interceptorManager);
    warheadManager._onScreenShake = triggerScreenShake;
    interceptorManager.setWarheadManager(warheadManager);
    bomber = new Bomber(scene, particleSystem);
    powerUpManager = new MissilePowerUpManager(scene, world, particleSystem);

    const centerX = Math.floor(WORLD_SIZE_X / 2);
    const centerZ = Math.floor(WORLD_SIZE_Z / 2);
    const spawnY = world.getHighestSolidY(centerX, centerZ);
    const spawnWp = world.voxelToWorld(centerX, spawnY + 1, centerZ);
    const offsetX = -(WORLD_SIZE_X * VOXEL_SIZE) / 2;
    const offsetZ = -(WORLD_SIZE_Z * VOXEL_SIZE) / 2;
    player.reset(new THREE.Vector3(spawnWp.x + offsetX, spawnWp.y, spawnWp.z + offsetZ));

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
    document.getElementById('submit-initials-btn').addEventListener('click', submitInitials);

    const inputs = [
        document.getElementById('initial-0'),
        document.getElementById('initial-1'),
        document.getElementById('initial-2'),
    ];
    inputs.forEach((inp, i) => {
        inp.addEventListener('input', () => {
            inp.value = inp.value.replaceAll(/[^A-Za-z]/g, '').toUpperCase();
            if (inp.value.length === 1 && i < 2) inputs[i + 1].focus();
        });
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && inp.value === '' && i > 0) {
                inputs[i - 1].focus();
            }
            if (e.key === 'Enter') submitInitials();
        });
    });

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
}

function showMenu() {
    phase = Phase.MENU;
    document.getElementById('menu-screen').classList.remove('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('missile-hud').classList.add('hidden');
    document.getElementById('crosshair').classList.add('hidden');
    player.exitPointerLock();
    renderHighScoreTable('highscore-table-menu', -1);
}

function startGame() {
    phase = Phase.PLAYING;
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('missile-hud').classList.remove('hidden');
    document.getElementById('crosshair').classList.remove('hidden');

    state.score = 0;
    state.wave = 1;
    state.nextBonusCityAt = BONUS_CITY_THRESHOLD;

    const centerX = Math.floor(WORLD_SIZE_X / 2);
    const centerZ = Math.floor(WORLD_SIZE_Z / 2);
    const spawnY = world.getHighestSolidY(centerX, centerZ);
    const spawnWp = world.voxelToWorld(centerX, spawnY + 1, centerZ);
    const offsetX = -(WORLD_SIZE_X * VOXEL_SIZE) / 2;
    const offsetZ = -(WORLD_SIZE_Z * VOXEL_SIZE) / 2;
    player.reset(new THREE.Vector3(spawnWp.x + offsetX, spawnWp.y, spawnWp.z + offsetZ));
    player.requestPointerLock();

    cityManager.resetAllCities();
    interceptorManager.refillAllBatteries();
    interceptorManager.clear();
    warheadManager.clear();
    warheadManager.configureWave(state.wave);
    bomber.reset();
    powerUpManager.clear();

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

    document.getElementById('final-score').innerHTML =
        `SCORE: ${state.score.toLocaleString()}<br><span style="font-size:18px;color:#888">WAVE ${state.wave} REACHED</span>`;

    const newHs = document.getElementById('new-highscore');
    const initialsEntry = document.getElementById('initials-entry');
    const restartBtn = document.getElementById('restart-btn');

    if (state.score > 0 && isHighScore(state.score)) {
        newHs.classList.remove('hidden');
        initialsEntry.classList.remove('hidden');
        restartBtn.classList.add('hidden');
        renderHighScoreTable('highscore-table-gameover', -1);

        const inputs = [
            document.getElementById('initial-0'),
            document.getElementById('initial-1'),
            document.getElementById('initial-2'),
        ];
        inputs.forEach(inp => { inp.value = ''; });
        setTimeout(() => inputs[0].focus(), 100);
    } else {
        newHs.classList.add('hidden');
        initialsEntry.classList.add('hidden');
        restartBtn.classList.remove('hidden');
        renderHighScoreTable('highscore-table-gameover', -1);
    }

    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('missile-hud').classList.add('hidden');
}

function submitInitials() {
    const inputs = [
        document.getElementById('initial-0'),
        document.getElementById('initial-1'),
        document.getElementById('initial-2'),
    ];
    let name = inputs.map(i => i.value.toUpperCase()).join('');
    if (name.length < 3) name = (name + '___').slice(0, 3);

    const rank = insertHighScore(name, state.score, state.wave);

    document.getElementById('initials-entry').classList.add('hidden');
    document.getElementById('restart-btn').classList.remove('hidden');
    renderHighScoreTable('highscore-table-gameover', rank);
}

function tryFire() {
    const aimTarget = player.getAimTarget();
    const fired = interceptorManager.fireTowardAim(player.position, aimTarget);
    if (fired) {
        audio.play('missileLaunch');
    }
}

function updateHUD() {
    document.getElementById('missile-hud-score').textContent = state.score;
    const topScore = loadHighScores()[0];
    document.getElementById('missile-hud-highscore').textContent = `HI: ${topScore ? topScore.score.toLocaleString() : 0}`;
    document.getElementById('missile-hud-wave').textContent = `WAVE ${state.wave}`;

    const citiesEl = document.getElementById('missile-hud-cities');
    citiesEl.innerHTML = '';
    if (cityManager) {
        for (const city of cityManager.cities) {
            const icon = document.createElement('span');
            icon.className = 'city-icon' + (city.alive ? '' : ' city-dead');
            icon.textContent = '\u25B2';
            citiesEl.appendChild(icon);
        }
    }

    const ammoEl = document.getElementById('missile-hud-ammo');
    ammoEl.innerHTML = '';
    if (interceptorManager) {
        for (const battery of interceptorManager.batteries) {
            const div = document.createElement('div');
            div.className = 'ammo-battery';
            const label = document.createElement('span');
            label.className = 'ammo-label';
            label.textContent = battery.name;
            const count = document.createElement('span');
            count.className = 'ammo-count';
            count.textContent = battery.ammo;
            count.style.color = battery.ammo > 0 ? '#ff8844' : '#444';
            div.appendChild(label);
            div.appendChild(count);
            ammoEl.appendChild(div);
        }
    }
}

function nextWave() {
    const aliveCities = cityManager.getAliveCities();
    const cityBonus = aliveCities.length * 100;
    const ammoBonus = interceptorManager.getTotalAmmo() * 5;
    state.score += cityBonus + ammoBonus;

    checkBonusCity();

    state.wave++;
    phase = Phase.WAVE_TRANSITION;
    waveTransitionTimer = 3;

    interceptorManager.clear();
    warheadManager.clear();

    showWaveAnnouncement(`WAVE ${state.wave}`);
    showBonusTally(cityBonus, ammoBonus);
    audio.play('waveStart');
    updateHUD();
}

function checkBonusCity() {
    if (state.score >= state.nextBonusCityAt) {
        state.nextBonusCityAt += BONUS_CITY_THRESHOLD;
        const deadCities = cityManager.cities.filter(c => !c.alive);
        if (deadCities.length > 0) {
            const restored = deadCities[0];
            restored.alive = true;
            restored.health = 100;
            showWaveAnnouncement('BONUS CITY!');
            audio.play('powerup');
        }
    }
}

function showBonusTally(cityBonus, ammoBonus) {
    const el = document.createElement('div');
    el.className = 'bonus-tally';
    el.innerHTML = `<div>CITIES: +${cityBonus}</div><div>AMMO: +${ammoBonus}</div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 500);
    }, 2500);
}

function showWaveAnnouncement(text) {
    const el = document.createElement('div');
    el.className = 'wave-announcement missile-wave-announcement';
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 500);
    }, 1500);
}

function gameLoop() {
    requestAnimationFrame(gameLoop);

    const dt = Math.min(clock.getDelta(), 0.05);

    if (phase === Phase.PLAYING) {
        player.update(dt);
        particleSystem.update(dt);
        cityManager.updateBeacons(dt);
        interceptorManager.update(dt);
        warheadManager.update(dt, state);

        powerUpManager.update(dt, player.position, interceptorManager, audio);
        state.scoreMultiplier = powerUpManager.getScoreMultiplier();

        bomber.update(dt);
        const bomberPts = bomber.checkHit(interceptorManager.getActiveBlasts());
        if (bomberPts > 0) {
            const pts = bomberPts * state.scoreMultiplier;
            state.score += pts;
            showWaveAnnouncement(`BOMBER: +${pts}`);
            audio.play('multiKill');
            triggerScreenShake(0.3, 0.3);
        }

        if (cityManager.allDestroyed()) {
            gameOver();
        } else if (warheadManager.waveComplete()) {
            nextWave();
        }

        world.rebuildDirtyChunks(scene);

        applyScreenShake(dt);
        updateHUD();

    } else if (phase === Phase.WAVE_TRANSITION) {
        particleSystem.update(dt);
        waveTransitionTimer -= dt;
        if (waveTransitionTimer <= 0) {
            phase = Phase.PLAYING;
            warheadManager.configureWave(state.wave);
            interceptorManager.refillAllBatteries();
            updateHUD();
        }
    } else {
        particleSystem.update(dt);
        if (player) player.update(dt);
    }

    renderer.render(scene, player.camera);
}

export { scene, world, player, particleSystem, audio, cityManager, interceptorManager, warheadManager, state, phase, Phase, triggerScreenShake, gameOver, showWaveAnnouncement, updateHUD, WORLD_SIZE_X, WORLD_SIZE_Z, VOXEL_SIZE };

document.addEventListener('DOMContentLoaded', init);
