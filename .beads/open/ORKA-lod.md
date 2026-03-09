id: ORKA-lod
title: [PERF] Stage startup asset loading to reduce initial combat-ready time
priority: P0
status: done

## Objective
Reduce initial game load latency by removing sequential image-loading bottlenecks at boot.

## Scope
- Keep runtime behavior unchanged.
- Split startup image loading into critical first-frame assets and deferred/background assets.
- Convert sequential sprite/image awaits to parallelized batches where safe.
- Keep fallback behavior intact for missing images.

## Acceptance
- Startup no longer blocks on loading every sprite before first playable frame.
- Core boot assets load in parallel and first render readiness is improved.
- Deferred assets still load asynchronously after boot without crashes.
- Existing runtime tests continue passing.

## Completion Note (2026-03-08)
- Startup loader now stages critical sprite types and defers non-critical base sprite loads.
- Core visual assets now load in parallel batches instead of serial awaits.
- Deferred preload now runs deferred base sprites together with existing deferred visuals.
