import { radToDeg, degToRad } from './utils.js';
import { WEAPON_DEFS } from './weapons.js';

export class HUD {
    constructor(gameState) {
        this.gameState = gameState;
        this.container = document.getElementById('hud');
        this._build();
        this.onFire = null;
        this.onMove = null;
        this.onSkip = null;
        this.onFollowToggle = null;
        this._following = false;
    }

    _build() {
        this.container.innerHTML = `
            <div class="hud-section">
                <div id="hud-player-name" style="font-size:15px;font-weight:600;margin-bottom:6px;"></div>
                <div id="hud-round" style="font-size:12px;color:var(--text-secondary);"></div>
                <div id="hud-timer" style="font-size:12px;color:var(--text-secondary);margin-top:2px;"></div>
            </div>

            <div class="hud-section" style="text-align:center;">
                <div class="hud-section-title">Wind</div>
                <canvas id="wind-canvas" width="60" height="60" style="display:block;margin:0 auto;"></canvas>
                <div id="wind-strength" style="margin-top:4px;font-size:12px;"></div>
            </div>

            <div class="hud-section">
                <div class="hud-section-title">Health</div>
                <div style="height:10px;background:var(--bg-tertiary);border-radius:5px;overflow:hidden;">
                    <div id="health-bar-fill" style="height:100%;background:var(--success);transition:width 0.3s;"></div>
                </div>
                <div id="health-text" style="font-size:12px;color:var(--text-secondary);margin-top:4px;"></div>
            </div>

            <div class="hud-section">
                <div class="hud-section-title">Weapon</div>
                <select id="weapon-select"></select>
                <div id="hud-ammo" style="font-size:12px;color:var(--text-secondary);margin-top:4px;"></div>
            </div>

            <div class="hud-section">
                <div class="hud-section-title">Aim</div>
                <div style="margin-bottom:10px;">
                    <label>Azimuth <span id="hud-azimuth">0</span>&deg;</label>
                    <input type="range" id="azimuth-slider" min="0" max="360" value="0">
                </div>
                <div style="margin-bottom:10px;">
                    <label>Elevation <span id="hud-elevation">30</span>&deg;</label>
                    <input type="range" id="elevation-slider" min="0" max="80" value="30">
                </div>
                <div>
                    <label>Power <span id="hud-power">50</span>%</label>
                    <input type="range" id="power-slider" min="5" max="100" value="50">
                </div>
            </div>

            <div class="hud-section" style="flex-grow:1;display:flex;flex-direction:column;justify-content:flex-end;">
                <div class="hud-actions">
                    <button class="btn btn-primary" id="fire-btn">Fire!</button>
                    <button class="btn btn-primary" id="move-btn">Move</button>
                    <button class="btn" id="follow-btn" style="font-size:12px;">Barrel Cam</button>
                    <button class="btn" id="skip-btn" style="font-size:12px;">Skip Turn</button>
                </div>
            </div>
        `;

        this.azimuthSlider = document.getElementById('azimuth-slider');
        this.elevationSlider = document.getElementById('elevation-slider');
        this.powerSlider = document.getElementById('power-slider');
        this.weaponSelect = document.getElementById('weapon-select');
        this.fireBtn = document.getElementById('fire-btn');
        this.moveBtn = document.getElementById('move-btn');
        this.skipBtn = document.getElementById('skip-btn');
        this.followBtn = document.getElementById('follow-btn');

        this._populateWeapons();
        this._bindEvents();
    }

    _populateWeapons() {
        this.weaponSelect.innerHTML = '';
        WEAPON_DEFS.forEach((w, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = w.name;
            this.weaponSelect.appendChild(opt);
        });
    }

    _bindEvents() {
        this.azimuthSlider.addEventListener('input', () => this._syncToTank());
        this.elevationSlider.addEventListener('input', () => this._syncToTank());
        this.powerSlider.addEventListener('input', () => this._updateLabels());

        this.weaponSelect.addEventListener('change', () => {
            const tank = this.gameState.turnManager.getCurrentTank();
            if (tank) tank.activeWeaponIndex = parseInt(this.weaponSelect.value);
            this._updateAmmoDisplay();
        });

        this.fireBtn.addEventListener('click', () => {
            if (this.onFire) this.onFire();
        });

        this.moveBtn.addEventListener('click', () => {
            if (this.onMove) this.onMove();
        });

        this.skipBtn.addEventListener('click', () => {
            if (this.onSkip) this.onSkip();
        });

        this.followBtn.addEventListener('click', () => {
            this._following = !this._following;
            this._updateFollowButton();
            if (this.onFollowToggle) this.onFollowToggle(this._following);
        });

        window.addEventListener('keydown', (e) => {
            if (this.gameState.phase !== 'aiming') return;
            const tank = this.gameState.turnManager.getCurrentTank();
            if (!tank || this.gameState.turnManager.getCurrentPlayer().isAI) return;

            const step = e.shiftKey ? 1 : 5;
            switch (e.key) {
                case 'ArrowLeft':
                    this.azimuthSlider.value = (parseInt(this.azimuthSlider.value) - step + 360) % 360;
                    this._syncToTank();
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    this.azimuthSlider.value = (parseInt(this.azimuthSlider.value) + step) % 360;
                    this._syncToTank();
                    e.preventDefault();
                    break;
                case 'ArrowUp':
                    this.elevationSlider.value = Math.min(80, parseInt(this.elevationSlider.value) + step);
                    this._syncToTank();
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                    this.elevationSlider.value = Math.max(0, parseInt(this.elevationSlider.value) - step);
                    this._syncToTank();
                    e.preventDefault();
                    break;
                case '+': case '=':
                    this.powerSlider.value = Math.min(100, parseInt(this.powerSlider.value) + 5);
                    this._updateLabels();
                    e.preventDefault();
                    break;
                case '-': case '_':
                    this.powerSlider.value = Math.max(5, parseInt(this.powerSlider.value) - 5);
                    this._updateLabels();
                    e.preventDefault();
                    break;
                case ' ':
                    if (this.onFire) this.onFire();
                    e.preventDefault();
                    break;
                case 'm':
                    if (this.onMove) this.onMove();
                    e.preventDefault();
                    break;
                case 'Escape':
                    if (this.onSkip) this.onSkip();
                    e.preventDefault();
                    break;
                case 'v':
                    this._following = !this._following;
                    this._updateFollowButton();
                    if (this.onFollowToggle) this.onFollowToggle(this._following);
                    e.preventDefault();
                    break;
            }

            if (e.key >= '1' && e.key <= '6') {
                const idx = parseInt(e.key) - 1;
                if (idx < WEAPON_DEFS.length) {
                    this.weaponSelect.value = idx;
                    if (tank) tank.activeWeaponIndex = idx;
                    this._updateAmmoDisplay();
                }
            }
        });
    }

    _syncToTank() {
        const tank = this.gameState.turnManager.getCurrentTank();
        if (!tank) return;
        tank.turretAngle = degToRad(parseInt(this.azimuthSlider.value));
        tank.barrelElevation = degToRad(parseInt(this.elevationSlider.value));
        this._updateLabels();
    }

    _updateLabels() {
        document.getElementById('hud-azimuth').textContent = this.azimuthSlider.value;
        document.getElementById('hud-elevation').textContent = this.elevationSlider.value;
        document.getElementById('hud-power').textContent = this.powerSlider.value;
    }

    _updateAmmoDisplay() {
        const tank = this.gameState.turnManager.getCurrentTank();
        if (!tank) return;
        const idx = tank.activeWeaponIndex;
        const ammo = tank.ammo[idx];
        document.getElementById('hud-ammo').textContent =
            ammo === Infinity ? 'Unlimited' : `Ammo: ${ammo}`;
    }

    _updateFollowButton() {
        if (this._following) {
            this.followBtn.textContent = 'Barrel Cam (ON)';
            this.followBtn.classList.add('btn-primary');
        } else {
            this.followBtn.textContent = 'Barrel Cam';
            this.followBtn.classList.remove('btn-primary');
        }
    }

    setFollowing(active) {
        this._following = active;
        this._updateFollowButton();
    }

    getPower() {
        return parseInt(this.powerSlider.value) / 100;
    }

    show() {
        this.container.classList.remove('hidden');
    }

    hide() {
        this.container.classList.add('hidden');
    }

    update() {
        const gs = this.gameState;
        const player = gs.turnManager.getCurrentPlayer();
        const tank = gs.turnManager.getCurrentTank();

        if (player) {
            const nameEl = document.getElementById('hud-player-name');
            nameEl.textContent = player.name;
            nameEl.style.borderLeft = `4px solid #${player.color.toString(16).padStart(6, '0')}`;
        }

        document.getElementById('hud-round').textContent = `Round ${gs.turnManager.round}`;

        const remaining = Math.max(0, gs.turnTimeLimit - gs.turnTimer);
        document.getElementById('hud-timer').textContent = `Time: ${Math.ceil(remaining)}s`;

        if (tank) {
            const ratio = tank.health / tank.maxHealth;
            document.getElementById('health-bar-fill').style.width = `${ratio * 100}%`;
            document.getElementById('health-text').textContent = `${tank.health} / ${tank.maxHealth}`;
        }

        this._updateAmmoDisplay();
        this._drawWindIndicator();
    }

    _drawWindIndicator() {
        const canvas = document.getElementById('wind-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        ctx.clearRect(0, 0, w, h);

        ctx.beginPath();
        ctx.arc(cx, cy, 25, 0, Math.PI * 2);
        ctx.strokeStyle = 'var(--text-secondary)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const wind = this.gameState.wind;
        const strength = Math.sqrt(wind.x * wind.x + wind.y * wind.y);
        if (strength > 0.1) {
            const angle = Math.atan2(wind.y, wind.x);
            const len = Math.min(strength * 4, 22);

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = 2;
            ctx.stroke();

            const tipX = cx + Math.cos(angle) * len;
            const tipY = cy + Math.sin(angle) * len;
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(
                tipX - Math.cos(angle - 0.4) * 6,
                tipY - Math.sin(angle - 0.4) * 6
            );
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(
                tipX - Math.cos(angle + 0.4) * 6,
                tipY - Math.sin(angle + 0.4) * 6
            );
            ctx.stroke();
        }

        document.getElementById('wind-strength').textContent = `${strength.toFixed(1)} m/s`;
    }

    syncFromTank() {
        const tank = this.gameState.turnManager.getCurrentTank();
        if (!tank) return;
        this.azimuthSlider.value = Math.round(radToDeg(tank.turretAngle + Math.PI * 2) % 360);
        this.elevationSlider.value = Math.round(radToDeg(tank.barrelElevation));
        this.weaponSelect.value = tank.activeWeaponIndex;
        this._updateLabels();
        this._updateAmmoDisplay();
    }
}
