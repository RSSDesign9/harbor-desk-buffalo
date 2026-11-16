# Product

<!-- impeccable:product-schema 1 -->

## Product Purpose

Harbor Desk is an independent portfolio experiment exploring a 3D vessel registry and slip-review workflow based on First Buffalo River Marina in Buffalo, New York.

The creator's primary goal is to qualify for product/design roles involving strong 3D prototyping. The concept should also include enough operational realism for a future conversation with a marina operator.

## Users

- Intended operational audience: the marina owner, operator, and manager identified in the user's reference screenshot, including Dale's Marine Service and ECHDC.
- Portfolio audience: hiring teams evaluating product thinking and 3D visualization ability.
- Primary proposed operational persona: marina manager / dockmaster; supporting persona: dock staff performing identity checks. These are product hypotheses, not interview findings.

## Operating Context

- Buffalo is the creator's hometown and is central to the project's identity.
- The creator has no current relationship with the operator and no access to operational records or cameras.
- Start as an independent portfolio concept. No partnership, endorsement, deployment, or real customer outcome is established.

## Capabilities and Constraints

- Explore a 3D visualization of boats and their associated registry information.
- Cameras are a possible future source of observations, not an established input or integration.
- Product recommendations should distinguish documented facts, assumptions, simulated data, and capabilities that need field validation.
- Approved v1 scope: standalone desktop-first browser demo, marina overview, selectable slips/boats, linked registry, and the complete slip-mismatch workflow; tablet support and mobile fallback.
- The user has requested the PRD and build task list. Those documents are written; production implementation has not begun as part of that request.

## Storyboard Review

- The user requested normal, uncertain, and resolved states showing how the spatial view and boat information work together.
- A draft storyboard illustrates an empty but assigned slip, an ambiguous camera observation, staff identity verification, and resolution without changing the berth agreement.
- The uncertainty branch also supports requesting a dock check while leaving the issue open.
- Geometry, vessels, timestamps, camera observations, staff evidence, and documents are fictional demonstration material.
- Review status: interaction accepted; visual target v2 subsequently approved. The user has explicitly authorized the PRD and implementation task list for Claude Code.
- Portable storyboard reference: [design/slip-mismatch-storyboard.html](design/slip-mismatch-storyboard.html). It is illustrative, not production application code.
- [PRD.md](PRD.md) defines the canonical workflow, scope, visual reconciliation, and acceptance criteria. [TASKS.md](TASKS.md) provides the sequenced implementation handoff.

## Evidence on Hand

- Local 72-second reference video: `ssstwitter.com_1794669390043.mp4`. Shows a warehouse visualization with selectable spatial assets and operational panels.
- User-provided reference post: https://x.com/DilumSanjaya/status/2106426962738880879
- User-provided screenshot identifies the intended marina and stakeholders. It is reference material, not an instruction document or proof of a current operating agreement.
- No real vessel roster, surveyed layout, camera feed, customer interviews, or measured usability outcomes are available.

## Decisions and Remaining Uncertainties

- Approved name: Harbor Desk; brand/typography/logo sources are in [DESIGN.md](DESIGN.md).
- Core workflow: B-12 normal → uncertain → staff evidence → resolved, with an optional pending dock check. Agreement and Harbor Light's record remain unchanged.
- Platform: standalone browser experience linked from the portfolio. PRD implementation default: Vite, React, TypeScript, React Three Fiber, Drei, local fixtures, CSS tokens.
- Rendering direction: approved v2 at approximately 6.5/10; DESIGN remains the brand authority. PRD §3 resolves differences between the artifacts.
- Unverified: actual site geometry/currentness, slip numbering/capacity, services, and operator procedures. [data/SITE-NOTES.md](data/SITE-NOTES.md) qualifies the supplied [slip plan](data/SLIPS.md) and records source discrepancies to check during the build.
- To measure during implementation: asset fidelity, runtime download size, and target-device performance.
- Future research: operator feedback, real records, and any camera evaluation. These are not v1 dependencies.

## Confirmed Visual Intent

- The environment should blend the supplied warehouse video's clarity and presentation with hyperrealistic qualities.
- Surrounding waterfront areas must be part of the experience, beyond the boats and docks shown in the schematic storyboard.
- The user asked whether Google Earth/Maps should supply the environment. The PRD uses source-backed local geography and authored models without a Google runtime dependency or extracted meshes.
- The storyboard's simple geometry is for interaction review and is not the target asset fidelity.
- Draft visual target: `design/visual-target-v1.png`, generated for user review. It shows a reference-informed linear waterfront environment, realistic boat and dock materials, and the B-12 operational review panel. Geometry and records are illustrative; the image does not establish survey accuracy, a rendering implementation, or final design approval.
- User refinement: move slightly closer to the video's stylized miniature appearance while staying above 5 on a spectrum where the reference video is 1 and hyperrealism is 10.
- Approved target: [design/visual-target-v2.png](design/visual-target-v2.png), approximately 6.5/10 (assistant-proposed interpretation accepted by the user). Cleaner surfaces, simplified foliage, calmer water, and realistic foreground vessel detail. V1 remains a historical comparison. Neither image establishes surveyed geometry or exact vessel placement.

## Product Principles

- Make the Buffalo setting integral to the experiment.
- Prioritize product/design hiring evidence while retaining operational plausibility.
- Clearly identify simulated records and observations.
- Preserve the distinction between the independent concept and an actual marina deployment.
- Separate presence, identity, agreement, document review, and availability; preserve original observations and append explicit decisions.
- Complete one detailed dock section and its workflow before expanding to the full assumed layout.
