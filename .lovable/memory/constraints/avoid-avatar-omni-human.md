---
name: Avoid bytedance/avatar-omni-human-1.5
description: Do not use the bytedance/avatar-omni-human-1.5 model anywhere — too expensive
type: constraint
---

Never use `bytedance/avatar-omni-human-1.5` (a.k.a. `avatar-omni-human-1.5`) for any new lip-sync, talking-head, or spokesperson generation flow.

**Why:** Cost is too high for the platform's volume use cases.

**Use instead:** `infinitetalk-hd` for HD lip-sync (preferred per existing pipeline). Keep the model option available in `wavespeed-video` for backward compatibility with old projects, but do not invoke it from any new code path or default flow.
