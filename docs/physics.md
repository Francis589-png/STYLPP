# STYL++ Physics

STYL++ now includes a small deterministic physics runtime intended for UI motion, games, simulations and interactive experiences.

## Springs

```js
const { Spring } = require('stylpp');
const spring = new Spring({ value: 0, target: 100, stiffness: 170, damping: 26, mass: 1 });

spring.setTarget(240);
const value = spring.step(1 / 60);
```

The spring integrates a damped Hooke-style system:

`F = k(target - position) - c * velocity`

and then applies Newton's second law:

`a = F / mass`

## Bodies

```js
const { Body } = require('stylpp');
const body = new Body({ gravity: { x: 0, y: 980 } });
body.applyForce(50, 0);
body.step(1 / 60);
```

## World

`PhysicsWorld` provides a fixed timestep so simulations remain stable when frame times vary.

```js
const { PhysicsWorld, Body } = require('stylpp');
const world = new PhysicsWorld();
world.add(new Body());
world.step(frameDeltaSeconds);
```

The engine is deliberately dependency-free and usable from Node.js. Future browser integration can expose the same simulation primitives to STYL++ runtime animations without replacing the physics model with timer-based mock animation.
