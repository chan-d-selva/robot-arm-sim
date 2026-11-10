# Robot Arm Sim Lab

A browser-based 6-axis robot arm simulator (three.js) built for easy demos and screen-recorded videos.
Inspired by e-Yantra's *Physical AI Sim Lab*.

**Live:** https://chan-d-selva.github.io/robot-arm-sim/

## Controls

| Input | Action |
|---|---|
| Click a cube | Arm picks it up automatically |
| Click the table / another cube | Arm places the held cube there (stacks on cubes) |
| Drag / scroll | Orbit / zoom camera |
| `W` `A` `S` `D` / arrows | Move the gripper (relative to the camera) |
| `R` / `F` | Raise / lower |
| `Z` / `X` | Twist the wrist |
| `Space` | Open / close gripper |
| `Shift` | Move faster |
| `1`–`4` | Camera views (front, side, top, close) |
| `C` | Cinematic auto-orbit |
| `G` | Toggle aim guides |
| `H` | Hide / show all panels |
| `P` | Save current pose (teach & replay) |
| `Esc` | Stop the current automatic move |
| Gamepad | Left stick moves, right stick up/down, **A** grips, bumpers twist |

Joint sliders give direct control of base, shoulder, elbow, wrist, twist and gripper.

## Recording a video

1. Set up your shot (pick a camera view, or turn on **Cinematic orbit**).
2. Click **⏺ Record**, drive the arm (or hit **▶ Auto demo**), then **■ Stop & save**.
3. The clip (.mp4 in Chrome/Edge, .webm elsewhere) downloads automatically. Only the 3D view is captured, with no panels or cursor.

Use the **Speed** slider for slow-motion takes.

## Run locally

Any static server works (ES modules need http, not `file://`):

```
python3 -m http.server 8000
```

then open http://localhost:8000.

## Stack

Plain HTML + ES modules, three.js r170 vendored in `vendor/`. Analytic inverse kinematics, servo-style joint smoothing, simple gravity/stacking for the cubes, and canvas capture via `MediaRecorder`.
