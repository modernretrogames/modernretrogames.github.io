export class UI {
    constructor() {
        this.menuScreen = document.getElementById('menu-screen');
        this.setupScreen = document.getElementById('setup-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.onStartGame = null;
        this.onSettings = null;
    }

    showMenu() {
        this.menuScreen.classList.remove('hidden');
        this.setupScreen.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');

        this.menuScreen.innerHTML = `
            <div class="panel" style="text-align:center;min-width:320px;">
                <h1 style="font-size:36px;margin-bottom:8px;color:var(--accent);">Voxel Artillery</h1>
                <p style="color:var(--text-secondary);margin-bottom:24px;">Destructible terrain tank warfare</p>
                <div style="display:flex;flex-direction:column;gap:12px;">
                    <button class="btn btn-primary" id="menu-new-game" style="font-size:16px;padding:12px;">New Game</button>
                    <button class="btn" id="menu-settings">Settings</button>
                    <button class="btn" id="menu-theme-toggle">Toggle Theme</button>
                </div>
            </div>
        `;

        document.getElementById('menu-new-game').addEventListener('click', () => this.showSetup());
        document.getElementById('menu-theme-toggle').addEventListener('click', () => toggleTheme());
        document.getElementById('menu-settings').addEventListener('click', () => {
            if (this.onSettings) this.onSettings();
        });
    }

    showSetup() {
        this.menuScreen.classList.add('hidden');
        this.setupScreen.classList.remove('hidden');

        this.setupScreen.innerHTML = `
            <div class="panel" style="min-width:360px;">
                <h2 style="margin-bottom:20px;color:var(--accent);">Game Setup</h2>
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div>
                        <label>AI Opponents</label>
                        <select id="setup-ai-count">
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                        </select>
                    </div>
                    <div>
                        <label>Tanks per Player</label>
                        <select id="setup-tanks">
                            <option value="1">1</option>
                            <option value="2" selected>2</option>
                            <option value="3">3</option>
                        </select>
                    </div>
                    <div>
                        <label>AI Difficulty</label>
                        <select id="setup-difficulty">
                            <option value="easy">Easy</option>
                            <option value="medium" selected>Medium</option>
                            <option value="hard">Hard</option>
                        </select>
                    </div>
                    <div>
                        <label>Map Size</label>
                        <select id="setup-map-size">
                            <option value="small">Small (256x256)</option>
                            <option value="medium" selected>Medium (512x512)</option>
                            <option value="large">Large (1024x1024)</option>
                        </select>
                    </div>
                    <div style="display:flex;gap:12px;margin-top:8px;">
                        <button class="btn" id="setup-back">Back</button>
                        <button class="btn btn-primary" id="setup-start" style="flex:1;">Start Game</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('setup-back').addEventListener('click', () => this.showMenu());
        document.getElementById('setup-start').addEventListener('click', () => {
            const config = {
                aiOpponents: parseInt(document.getElementById('setup-ai-count').value),
                tanksPerPlayer: parseInt(document.getElementById('setup-tanks').value),
                aiDifficulty: document.getElementById('setup-difficulty').value,
                mapSize: document.getElementById('setup-map-size').value,
            };
            this.setupScreen.classList.add('hidden');
            if (this.onStartGame) this.onStartGame(config);
        });
    }

    showGameOver(winner) {
        this.gameOverScreen.classList.remove('hidden');

        this.gameOverScreen.innerHTML = `
            <div class="panel" style="text-align:center;min-width:320px;">
                <h2 style="font-size:28px;margin-bottom:12px;color:var(--accent);">Game Over</h2>
                <p style="font-size:20px;margin-bottom:24px;">${winner ? winner.name + ' Wins!' : 'Draw!'}</p>
                <div style="display:flex;gap:12px;justify-content:center;">
                    <button class="btn btn-primary" id="gameover-again">Play Again</button>
                    <button class="btn" id="gameover-menu">Main Menu</button>
                </div>
            </div>
        `;

        document.getElementById('gameover-again').addEventListener('click', () => {
            this.gameOverScreen.classList.add('hidden');
            if (this.onStartGame) this.onStartGame(null);
        });
        document.getElementById('gameover-menu').addEventListener('click', () => {
            this.gameOverScreen.classList.add('hidden');
            this.showMenu();
        });
    }

    hideAll() {
        this.menuScreen.classList.add('hidden');
        this.setupScreen.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');
    }
}

export function showToast(message, duration = 2500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

export function initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
}
