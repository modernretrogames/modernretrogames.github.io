# Voxel Artillery Game - Implementation Checklist

Track progress across sessions. Mark tasks `[x]` as they are completed.

---

## Phase 1: Project Scaffolding

- [x] **Task 1** - Create `index.html` with HTML5 boilerplate, viewport meta, Three.js CDN import map, canvas container div, and module script entry point.
- [x] **Task 2** - Create `css/styles.css` with CSS custom properties for dark/light theming, full-viewport canvas styling, and base typography.
- [x] **Task 3** - Create `js/app.js` entry point that initializes on DOMContentLoaded, sets up the render loop with `requestAnimationFrame`, and exports a global game clock (delta time).
- [x] **Task 4** - Create `js/scene.js` - initialize Three.js WebGLRenderer (antialias, shadow map), Scene, ambient light + directional light with shadows, and sky-colored background. Export scene and renderer.
- [x] **Task 5** - Add window resize handler in `scene.js` that updates renderer size and camera aspect ratio. Verify a colored cube renders correctly as a smoke test.
- [x] **Task 6** - Create `js/utils.js` with math helpers: clamp, lerp, map (range remapping), degToRad, radToDeg, seeded random number generator.

## Phase 2: Noise and Terrain Data

- [x] **Task 7** - Create `js/noise.js` implementing 2D Simplex noise. Export a `simplex2(x, y)` function returning values in [-1, 1].
- [x] **Task 8** - Add `fbm(x, y, octaves, lacunarity, persistence)` function to `noise.js` for fractal Brownian motion (layered noise).
- [x] **Task 9** - Create `js/voxel-world.js` with `VoxelWorld` class. Constructor accepts worldSizeX, worldSizeY (height), worldSizeZ, and voxelSize (configurable). Store voxel data in a flat Uint8Array.
- [x] **Task 10** - Add voxel type constants (AIR=0, GRASS=1, DIRT=2, ROCK=3, SAND=4). Add getVoxel/setVoxel methods with bounds checking.
- [x] **Task 11** - Add chunk division to VoxelWorld. Define CHUNK_SIZE (16). Track dirty chunks. Provide getChunkForVoxel method.
- [x] **Task 12** - Add worldToVoxel and voxelToWorld coordinate conversion methods that account for voxelSize.
- [x] **Task 13** - Create `js/terrain-gen.js` with generateTerrain(voxelWorld, seed). Use fbm() for heightmap. Fill columns: rock at bottom, dirt in middle, grass on top.
- [x] **Task 14** - Add terrain parameter tuning: baseHeight, hillHeight, noiseScale, octaves. Expose a terrainConfig object.

## Phase 3: Voxel Rendering

- [x] **Task 15** - Create `js/chunk-mesher.js` with buildChunkMesh. For each non-air voxel, check 6 neighbors and emit face vertices only where neighbor is air.
- [x] **Task 16** - Define vertex positions and normals for each of the 6 face directions as constant arrays.
- [x] **Task 17** - Assign vertex colors per face based on voxel type: GRASS = green top/brown sides, DIRT = brown, ROCK = grey, SAND = tan.
- [x] **Task 18** - Pack vertices, normals, and colors into Float32Array buffers. Create THREE.BufferGeometry with position, normal, and color attributes.
- [x] **Task 19** - Create shared MeshLambertMaterial with vertexColors. Add chunk meshes to scene at correct world position.
- [x] **Task 20** - Add rebuildChunk method that calls mesher, disposes old mesh geometry, replaces in scene.
- [x] **Task 21** - Add rebuildDirtyChunks method that iterates dirty set, rebuilds each, clears set. Call once per frame.
- [x] **Task 22** - Wire terrain generation and chunk building into app.js. Verify terrain renders as colored voxel landscape.
- [x] **Task 23** - Optimize: skip fully interior chunks, ensure proper bounding boxes for frustum culling.

## Phase 4: Camera System

- [x] **Task 24** - Create `js/camera.js` with CameraController class. Orbit controls: rotate around target with mouse drag.
- [x] **Task 25** - Add mouse wheel zoom (adjust distance, clamp to min/max).
- [x] **Task 26** - Add setTarget(position) with smooth lerp transition (~0.5 seconds).
- [x] **Task 27** - Add camera bounds: prevent going below terrain, clamp vertical angle.
- [ ] **Task 28** - Add keyboard shortcuts: Tab to cycle tanks, F for free-look toggle.

## Phase 5: Tank Model and Placement

- [x] **Task 29** - Create `js/tank.js` with Tank class: id, playerId, position, health, maxHealth, turretAngle, barrelElevation, activeWeapon, alive.
- [x] **Task 30** - Create `js/tank-renderer.js` with TankRenderer class. Build tank mesh from box geometries: hull, turret, barrel.
- [x] **Task 31** - Add turret rotation (setTurretAngle) and barrel elevation (setBarrelElevation, clamped 0-80 degrees).
- [x] **Task 32** - Color tank mesh based on player color. Add edge darkening for visibility.
- [x] **Task 33** - Implement placeTankOnTerrain: raycast downward to find highest solid voxel, place tank on top.
- [x] **Task 34** - Create initial tank placement logic: distribute tanks along opposite map edges with randomization and minimum distance.
- [x] **Task 35** - Add floating health bar above each tank (HTML overlay or sprite).
- [ ] **Task 36** - Add tank destruction state: collapse/shatter animation, then remove from play.

## Phase 6: Game State and Turn System

- [x] **Task 37** - Create `js/player.js` with Player class: id, name, color, isAI, tanks[], score.
- [x] **Task 38** - Create `js/game-state.js` with GameState class. States: MENU, SETUP, PLAYING, AIMING, FIRING, RESOLVING, GAME_OVER.
- [x] **Task 39** - Add players array, currentPlayerIndex/currentTankIndex. Add initGame(config) method.
- [x] **Task 40** - Create `js/turn-manager.js` with TurnManager class. nextTurn(): advance to next alive tank/player.
- [x] **Task 41** - Implement turn start: move camera, highlight active tank, enable aiming UI, display player name.
- [x] **Task 42** - Implement turn end: after projectile resolves and physics settle, call nextTurn().
- [x] **Task 43** - Add skip turn (Escape key or Skip button).
- [x] **Task 44** - Implement win condition: only one player with alive tanks remaining.
- [x] **Task 45** - Add turn timer: configurable time limit, countdown in HUD, auto-skip on timeout.
- [x] **Task 46** - Add round tracking: display current round number.

## Phase 7: Aiming UI and Controls

- [x] **Task 47** - Create `js/hud.js` with HUD class. HTML overlay for aiming: azimuth gauge, elevation gauge, power bar, fire button.
- [x] **Task 48** - Implement azimuth control: left/right arrow keys rotate turret, display angle on HUD.
- [x] **Task 49** - Implement elevation control: up/down arrow keys change barrel elevation, display on HUD.
- [x] **Task 50** - Implement power control: slider or +/- keys (0-100%), display as filled bar.
- [ ] **Task 51** - Implement trajectory preview: dotted arc showing predicted path, update in real-time.
- [x] **Task 52** - Add Fire button (and spacebar shortcut) to transition from AIMING to FIRING.
- [ ] **Task 53** - Add mouse-based aiming: click and drag for direction, drag distance = power.
- [x] **Task 54** - Add wind display on HUD: direction arrow and strength. Random wind per round.

## Phase 8: Projectile Ballistics

- [x] **Task 55** - Create `js/projectile.js` with Projectile class: position, velocity, active, weapon, owner.
- [x] **Task 56** - Implement fire(): compute initial velocity from barrel tip, turret azimuth, elevation, power.
- [x] **Task 57** - Implement update(dt): apply gravity, wind, update position.
- [x] **Task 58** - Implement sub-stepping: multiple small physics steps per frame to prevent tunneling.
- [x] **Task 59** - Implement terrain collision: convert position to voxel coords, check if solid, trigger impact.
- [x] **Task 60** - Implement tank collision: check against tank bounding boxes, trigger direct hit.
- [x] **Task 61** - Implement out-of-bounds detection: below y=0 or beyond world boundaries.
- [x] **Task 62** - Create projectile visual: bright sphere + PointLight + fading trail.
- [x] **Task 63** - Add camera tracking during flight: follow projectile, return to impact point.

## Phase 9: Terrain Destruction

- [x] **Task 64** - Create `js/explosion.js` with createExplosion(world, impactPoint, radius). Remove voxels in sphere.
- [x] **Task 65** - Mark all affected chunks as dirty when removing voxels.
- [x] **Task 66** - After voxel removal, trigger rebuildDirtyChunks() to update visuals.
- [x] **Task 67** - Add crater edge shaping: random survival chance at blast edge for natural look.
- [x] **Task 68** - Create explosion visual: expanding orange/yellow sphere that fades.
- [x] **Task 69** - Add debris particles: small boxes with random velocities, arc with gravity, fade away.
- [x] **Task 70** - Create `js/particles.js` with particle system: pool, position, velocity, life, color. Render with THREE.Points.
- [x] **Task 71** - Add ground scorch mark: darken voxels adjacent to crater.

## Phase 10: Tank Physics Post-Explosion

- [x] **Task 72** - Create `js/physics.js` with checkTankSupport(tank, voxelWorld). Check for solid voxels below footprint.
- [x] **Task 73** - After each explosion, check all tanks for support. Mark unsupported as "falling".
- [x] **Task 74** - Implement tank gravity: accelerate downward, check for ground contact each frame.
- [x] **Task 75** - Calculate fall damage based on distance fallen (threshold before damage starts).
- [x] **Task 76** - Handle tank falling below y=0: destroy it.
- [ ] **Task 77** - Animate falling smoothly with slight rotation for dramatic effect.

## Phase 11: Damage System

- [x] **Task 78** - Add calculateDamage(tankPosition, impactPoint, weapon). Linear falloff from epicenter.
- [x] **Task 79** - After explosion, apply damage to all tanks within blast radius.
- [ ] **Task 80** - Show floating damage numbers: text sprite that floats upward and fades.
- [x] **Task 81** - Check tank death: health <= 0 triggers destruction animation.
- [x] **Task 82** - Add knockback: push tanks away from explosion impact point.
- [x] **Task 83** - After knockback, re-check tank support (may need to fall).

## Phase 12: AI Opponent

- [x] **Task 84** - Create `js/ai.js` with AIController class. takeTurn() returns { azimuth, elevation, power, weaponIndex }.
- [x] **Task 85** - Implement target selection: nearest enemy tank or lowest health.
- [x] **Task 86** - Implement ideal trajectory calculation: azimuth via atan2, estimate elevation and power.
- [x] **Task 87** - Add difficulty-based error: Easy (+/-15deg, +/-20% power), Medium (+/-5deg, +/-10%), Hard (+/-1deg, +/-3%).
- [ ] **Task 88** - Add terrain obstruction check: attempt higher arc if hill blocks path.
- [x] **Task 89** - Add wind compensation for hard AI.
- [x] **Task 90** - Implement AI turn delay: 1-2s think time, animate turret rotation, then fire.
- [x] **Task 91** - Add AI weapon selection based on situation.

## Phase 13: Weapons System

- [x] **Task 92** - Create `js/weapons.js` with Weapon class: name, damage, blastRadius, maxAmmo, projectileSpeed, gravityMultiplier, special.
- [x] **Task 93** - Define Standard Shell: damage 25, radius 3, unlimited ammo.
- [x] **Task 94** - Define Heavy Shell: damage 40, radius 5, 3 ammo.
- [x] **Task 95** - Define Sniper Shot: damage 50, radius 1, 2 ammo, fast projectile.
- [x] **Task 96** - Define Cluster Bomb: splits into 5 sub-projectiles at apex.
- [x] **Task 97** - Implement cluster bomb splitting logic in projectile.js.
- [x] **Task 98** - Define Earthquake Bomb: radius 10+, damage 10, massive terrain destruction.
- [x] **Task 99** - Define Shotgun Blast: 5 projectiles in a cone, short range.
- [x] **Task 100** - Add weapon selection UI: number keys 1-6, weapon bar, ammo counts.

## Phase 14: HUD and Menus

- [x] **Task 101** - Create `js/ui.js` with menu system. Main menu: title, New Game, Settings buttons.
- [x] **Task 102** - Game setup screen: AI opponents (1-3), tanks per player (1-3), difficulty, map size.
- [x] **Task 103** - In-game HUD: player name, tank health, current weapon, turn timer, round counter.
- [x] **Task 104** - Wind indicator: compass-style arrow with numerical strength.
- [ ] **Task 105** - Minimap: top-down canvas with heightmap, tank positions, camera frustum.
- [x] **Task 106** - Game-over screen: winner, scores, damage stats, Play Again / Main Menu.
- [ ] **Task 107** - Settings panel: voxel size, render distance, shadow quality, sound volume.
- [x] **Task 108** - Dark/light theme toggle in settings and main menu.
- [x] **Task 109** - Notification toasts: turn changes, tank destroyed, weapon unlocks.

## Phase 15: Audio and Visual Polish

- [x] **Task 110** - Create `js/audio.js` with AudioManager using Web Audio API. Load/cache/play sounds.
- [x] **Task 111** - Firing sound effect: boom on launch, pitch varies per weapon.
- [x] **Task 112** - Explosion sound effect: scaled by blast radius.
- [ ] **Task 113** - Ambient wind sound: looping, volume scales with wind strength.
- [ ] **Task 114** - Screen shake on nearby explosions: decaying random offset, intensity by proximity.
- [ ] **Task 115** - Ambient occlusion approximation: darken vertices with more solid neighbors.
- [ ] **Task 116** - Water plane: semi-transparent animated blue plane at fixed Y level.
- [ ] **Task 117** - Sky gradient: vertical color gradient background with matching sun light.

## Phase 16: Deployment and Documentation

- [x] **Task 118** - Create Dockerfile and nginx.conf for static file serving.
- [ ] **Task 119** - Performance optimization pass: 60fps target, reduce draw calls, object pooling.
- [ ] **Task 120** - Loading screen with progress bar during terrain generation.
- [x] **Task 121** - Create README.md: description, how to run, controls, deployment.
- [ ] **Task 122** - Final integration testing: full game playthrough, all weapons, AI, win condition.
