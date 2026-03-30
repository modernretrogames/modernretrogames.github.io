# Voxel Space Invaders -- Design Plan

## Vision

First-person Space Invaders in 3D. The player stands on a flat futuristic arena floor, looking up at waves of voxel aliens that advance downward through floating destructible shields. WASD movement, mouse aiming, left-click to fire lasers. Power-ups drop from destroyed aliens. Difficulty ramps each wave.

## Architecture

```
aliens.html
    └── js/aliens-app.js (entry)
            ├── js/particles.js (reuse)
            ├── js/audio.js (extended)
            ├── js/aliens-player.js (FPS controller)
            ├── js/aliens-enemies.js (alien formation)
            ├── js/aliens-lasers.js (laser system)
            ├── js/aliens-shields.js (destructible shields)
            ├── js/aliens-powerups.js (power-up system)
            └── js/utils.js (reuse)
```

## Files

| File | Purpose |
|------|---------|
| aliens.html | Entry page with canvas, HUD, menus |
| js/aliens-app.js | Game loop, scene setup, game state, wave management |
| js/aliens-player.js | FPS camera, WASD movement, pointer lock, shooting |
| js/aliens-enemies.js | 3 alien types (squid/crab/octopus) with voxel models, formation movement |
| js/aliens-lasers.js | Player and alien laser projectiles, collision detection |
| js/aliens-shields.js | 4 floating destructible voxel shields |
| js/aliens-powerups.js | 6 power-up types that drop from destroyed aliens |
| js/audio.js | Extended with laser, alienDeath, powerup, playerDeath, waveStart sounds |
| css/styles.css | Extended with HUD, crosshair, menu, wave announcement styles |

## Gameplay

- **Perspective**: First-person, no visible player model, crosshair in center
- **Controls**: WASD to move, mouse to look, left-click to shoot, Escape to pause
- **Aliens**: 55 per wave (11x5 grid), 3 types with different point values
- **Shields**: 4 floating destructible voxel barriers between player and aliens
- **Power-ups**: Rapid Fire, Spread Shot, Shield, Bomb, Extra Life, Score x2
- **UFO**: Bonus ship that flies across periodically for 50-300 points
- **Difficulty**: Speed and fire rate increase each wave; fewer aliens = faster movement
- **Lives**: Start with 3, max 5. Invulnerability frames after being hit
- **High score**: Persisted in localStorage

## Wave Progression

- Wave N: alien move speed = base * (1 + N * 0.1)
- Wave N: alien fire rate = base * (1 + N * 0.15)
- Move interval decreases as fewer aliens remain (classic mechanic)
- 2 second transition between waves with announcement text
- Shields reset each wave
