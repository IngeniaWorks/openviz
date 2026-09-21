# Plan: Freehand Drawing in React Flow (Swarm-Ready)

**Generated**: 2026-04-21
**Complexity**: Medium

## Overview

Doel: implementeer freehand drawing op een React Flow canvas met `perfect-freehand`, inclusief coordinate-conversie, overlay, custom SVG-node en UX rond tekenmodus.[^4][^5][^6][^7]

## Prerequisites

- Bestaand React-project met een werkende React Flow setup en `ReactFlowProvider`.[^6][^4]
- NPM/Yarn toegang om packages te installeren (o.a. `reactflow`, `perfect-freehand`).[^8][^5]
- Toegang tot de codebase (typisch `/src` met componenten en hooks).


## Dependency Graph (conceptueel)

- T1, T2, T3 kunnen parallel.
- T4 hangt af van T1 en T3.
- T5 hangt af van T2 en T4.
- T6 hangt af van T4 (optioneel uitbreidbaar daarna).

***

## Tasks

### T1: React Flow baseline controleren of aanleggen

- **depends_on**: []
- **location**: `src/flow/ReactFlowCanvas.tsx`, `src/main.tsx` of vergelijkbare entry.
- **description**:
    - Zorg dat er een minimal werkende `<ReactFlow />` is met `nodes`, `edges` state, `ReactFlowProvider`, en basis panning/zoom.[^4][^6]
    - Exporteer indien nodig een hook of context (`useReactFlow`, `useStore`) om viewport-gegevens later te kunnen lezen.[^9][^4]
- **validation**:
    - Applicatie start zonder fouten.
    - Nodes zijn zichtbaar en je kunt pannen/zoomen op het canvas.

***

### T2: perfect-freehand utilities toevoegen

- **depends_on**: []
- **location**: `src/drawing/strokeUtils.ts` (nieuw bestand).
- **description**:
    - Installeer `perfect-freehand` en importeer `getStroke` in `strokeUtils.ts`.[^5][^6]
    - Schrijf een functie `pointsToPath(points: { x: number; y: number }[]): string` die:
        - De `points` via `getStroke` omzet naar een polygon (stroke-vertices).[^5]
        - Deze polygon vertaalt naar een SVG path-string (`M x0 y0 L x1 y1 ... Z`).
    - Voeg een helper toe om uit de `points` de bounding box (`minX, minY, maxX, maxY`) te halen.[^6]
- **validation**:
    - Unit-test (of handmatige test) met een vaste set punten levert een geldige `d`-string terug.
    - Bounding-box helper geeft voor enkele testinputs de verwachte waarden.

***

### T3: Viewport- en coordinate-conversiehook

- **depends_on**: []
- **location**: `src/flow/useFlowViewport.ts`, `src/flow/useCoordinateConversion.ts`.
- **description**:
    - Maak een hook `useFlowViewport` die via `useStore` of `useReactFlow` de huidige `x`, `y`, `zoom` van de React Flow viewport teruggeeft.[^9][^4][^6]
    - Maak vervolgens `useScreenToFlowPoint` die een DOM-event (`clientX`, `clientY`) omzet naar flow-coördinaten:
        - Lees de bounding rect van de React Flow wrapper (`getBoundingClientRect`).
        - Trek de offset van de wrapper af van `clientX/clientY`.
        - Pas `x`, `y` en `zoom` toe om het punt naar het interne coordinate-systeem van React Flow te mappen.[^7][^6]
- **validation**:
    - Log een paar punten bij een muisklik op het canvas en controleer dat de flow-coördinaten logisch meebewegen bij zoom/pan.
    - Vergelijk een bekende node-positie met een klik op dezelfde plek om te zien of de waarden overeenkomen.

***

### T4: Drawing overlay component bouwen

- **status**: ✅ Completed (2026-04-21)

- **depends_on**: [T1, T3]
- **location**: `src/drawing/DrawingOverlay.tsx`, integratie in `ReactFlowCanvas.tsx`.
- **description**:
    - Maak een `<DrawingOverlay />` component die bovenop het React Flow pane ligt (absolute positioning, volledige canvas-grootte).[^7][^6]
    - Gebruik `pointer-events` zodat in “draw mode” de overlay pointer-events opvangt, en daarbuiten de Flow zelf.
    - Implementeer state in overlay:
        - `isDrawing` (boolean).
        - `currentStrokePoints: { x: number; y: number }[]` in flow-coördinaten.
    - Handlers:
        - `onPointerDown`:
            - checkt of draw mode actief is.
            - zet `isDrawing` op `true` en initialiseert `currentStrokePoints` met het eerste flow-punt.[^6][^7]
        - `onPointerMove`:
            - als `isDrawing` waar is: voeg nieuwe flow-punten toe (gebruik `useScreenToFlowPoint`).[^6]
        - `onPointerUp` / `onPointerLeave`:
            - zet `isDrawing` op `false`.
            - emit een callback `onStrokeFinished(points)` naar de parent.
    - Teken optioneel een tijdelijke preview-curve op de overlay zelf (met `pointsToPath`) zodat de gebruiker direct feedback ziet.[^5][^6]
- **validation**:
    - In draw mode volgt een preview-lijn de cursor bij slepen.
    - Bij mouse up wordt een callback met een array van flow-punten ge-fired.

- **work log (2026-04-21)**:
    - Gebouwd: `src/drawing/DrawingOverlay.tsx` met `isDrawing`, `currentStrokePoints`, pointer handlers (`down/move/up/leave`) en preview-path via `pointsToPath`.
    - Geintegreerd: `src/components/workbench/workbench.tsx` met absolute overlay, `drawMode={false}` default wiring, en TODO-veilige `onStrokeFinished` no-op.
    - Validatie: `npm run lint -- src/drawing/DrawingOverlay.tsx src/components/workbench/workbench.tsx` en `npx tsc --noEmit`.
    - Gotcha: overlay pointer-events staan alleen aan in draw mode, zodat standaard React Flow interactie intact blijft zolang draw mode uit staat.

***

### T5: Freehand als custom SVG-node opslaan

- **status**: ✅ Completed (2026-04-21)

- **depends_on**: [T2, T4]
- **location**:
    - Node type: `src/nodes/FreehandNode.tsx`.
    - Node registratie: `src/flow/ReactFlowCanvas.tsx` of `src/flow/nodeTypes.ts`.
- **description**:
    - Definieer een `FreehandNode` component die:
        - Node props accepteert, inclusief `data.path`, `data.width`, `data.height`, `data.color`, etc.[^10][^4][^9]
        - Een `<svg>` rendert met:
            - `width/height` gebaseerd op de bounding box of `data`.
            - Een `<path d={data.path} />` met de juiste stroke/fill-stijlen.[^4][^7]
    - In de parent (bijvoorbeeld `ReactFlowCanvas`):
        - Koppel `DrawingOverlay`’s `onStrokeFinished(points)` aan een handler die:
            - `pointsToPath(points)` aanroept.[^5][^6]
            - De bounding box van `points` bepaalt en daaruit positie (`x`, `y`) en dimensies (`width`, `height`) afleidt.[^6]
            - Een nieuw node-object aanmaakt:
                - `type: 'freehandNode'`.
                - `position: { x: bbox.minX, y: bbox.minY }` of een gecentreerde variant.[^9][^4]
                - `data: { path, width, height, color, strokeWidth }`.
            - Dit node-object toevoegt aan `nodes`-state (met `setNodes(prev => [...prev, newNode])`).[^11][^4]
    - Registreer `freehandNode` in `nodeTypes` en geef dit door aan `<ReactFlow nodeTypes={nodeTypes} ... />`.[^12][^4]
- **validation**:
    - Na het afronden van een stroke verschijnt er een nieuwe node op het canvas die de getekende vorm toont en meebeweegt als een normale node.
    - Node selecteerbaar/verplaatsbaar zoals andere custom nodes.

- **work log (2026-04-21)**:
    - Gebouwd: `src/components/nodes/FreehandNode.tsx` voor SVG-rendering van `data.path` met configureerbare kleur en stroke.
    - Geintegreerd: `src/types/index.ts`, `src/components/workbench/hooks/useWorkbenchGraph.ts` en `src/components/workbench/workbench.tsx` om `type: 'freehand'` te ondersteunen in node mapping en registratie.
    - Persisting: overlay `onStrokeFinished(points)` maakt nu freehand-nodes aan via `getBoundingBox` + genormaliseerde `pointsToPath`.
    - Validatie: `npm run lint -- src/components/nodes/FreehandNode.tsx src/types/index.ts src/components/workbench/hooks/useWorkbenchGraph.ts src/components/workbench/workbench.tsx` en `npx tsc --noEmit`.

***

### T6: UX \& toolbars voor tekenmodus (parallel uitbreidbaar)

- **status**: ✅ Completed (2026-04-21)

- **depends_on**: [T4]
- **location**: `src/ui/Toolbar.tsx`, integraties in `ReactFlowCanvas.tsx`.
- **description**:
    - Voeg een toolbar toe met o.a.:
        - Een toggle “Draw mode” die een boolean in state zet.[^7][^6]
        - Optioneel sliders of inputs voor kleur en stroke-breedte die via props/context naar `DrawingOverlay` en `FreehandNode` data gaan.[^6]
    - Zorg dat de overlay alleen pointer-events vangt als draw mode aanstaat; anders laat je React Flow standaard panning/selectie doen.[^7][^6]
    - Implementeer een “Undo last drawing” actie die de laatst toegevoegde freehand-node uit `nodes` verwijdert.
- **validation**:
    - In draw mode blokkeert de overlay node-selectie/panning en kun je vrij tekenen.
    - Buiten draw mode werkt React Flow weer als normaal.
    - Undo verwijdert consistent de meest recent gemaakte freehand-node.

- **work log (2026-04-21)**:
    - State toegevoegd in workbench-store: `isDrawMode`, `freehandColor`, `freehandStrokeWidth` + setters/toggle.
    - Undo toegevoegd: `undoLastFreehandNode` verwijdert deterministisch de laatst toegevoegde `type === 'freehand'` node.
    - UI gebouwd: `src/components/workbench/FreehandToolbar.tsx` met draw-toggle, kleurinput, strokebreedte (slider + number) en undo-knop.
    - Integratie: toolbar en draw-state gekoppeld in `src/components/workbench/workbench.tsx`; overlay vangt alleen pointer-events in draw mode.
    - Validatie: lint + typecheck uitgevoerd op nieuwe/gewijzigde freehand files.

***

## Parallel Execution Groups

| Wave | Tasks | Can Start When |
| :-- | :-- | :-- |
| 1 | T1, T2, T3 | Meteen |
| 2 | T4 | T1 en T3 compleet |
| 3 | T5, T6 | T4 compleet (T2 voor T5, T4 voor T6) |

[^3][^1]

***

## Testing Strategy

- Schrijf minimaal één test of handmatige test-scenario per task (met focus op T3–T5):
    - Coordinate-conversie controleren bij verschillende zoomniveaus en viewport-posities.[^7][^6]
    - Perfect-freehand output visueel controleren met een paar standaard strokes.[^5]
    - Controleren dat nodes niet verschuiven of vervormen na canvas-zoom of -pan.[^4][^6]

***

## Risks \& Mitigations

- **Risk**: Coördinaten kloppen niet bij verschillende zoom/pan-combinaties.
    - **Mitigation**: Extra logging en vergelijking met bekende node-posities; kleine hulpfuncties voor conversie goed isoleren en testen.[^7][^6]
- **Risk**: Performance problemen bij lange strokes.
    - **Mitigation**: Points downsamplen (bijvoorbeeld elke N pixels of via tijdinterval) voordat je ze naar `perfect-freehand` stuurt.[^5]
- **Risk**: Gebruiker kan niet goed schakelen tussen tekenen en normale Flow-interactie.
    - **Mitigation**: Duidelijke toolbar-indicatie, hotkey voor draw mode, en visuele cursorwijziging in tekenmodus.[^13][^6]

***

[^1]: https://smithery.ai/skills/neversight/swarm-planner

[^2]: https://skills.rest/skill/swarm-planner

[^3]: https://mcpmarket.com/tools/skills/swarm-planner

[^4]: https://reactflow.dev/learn/customization/custom-nodes

[^5]: https://github.com/steveruizok/perfect-freehand

[^6]: https://reactflow.dev/learn/advanced-use/whiteboard

[^7]: https://reactflow.dev/examples/whiteboard/freehand-draw

[^8]: https://www.verified-skill.com/skills/am-will/swarms/swarm-planner

[^9]: https://reactflow.dev/api-reference/types/node

[^10]: https://reactflow.dev/learn/advanced-use/typescript

[^11]: https://v9.reactflow.dev/examples/custom-node/

[^12]: https://reactflow.dev/examples/nodes/custom-node

[^13]: https://dev.to/anoopw3bdev/how-to-create-a-custom-node-in-reactflow-1l13

[^14]: https://github.com/Dimillian/Skills/blob/main/review-swarm/SKILL.md

[^15]: https://github.com/nbashaw/swarm/blob/main/swarm/SKILL.md?plain=1

[^16]: https://thecreatorsai.com/p/skills-plugins-swarm-mode-practical

[^17]: https://docs.swarms.world/en/latest/swarms/concept/why/

[^18]: https://github.com/am-will/swarms

[^19]: https://upskilldevelopment.com/multi-agent-systems-and-swarm-intelligence-training-course

[^20]: https://scottspence.com/posts/unlock-swarm-mode-in-claude-code

[^21]: https://zachwills.net/i-managed-a-swarm-of-20-ai-agents-for-a-week-here-are-the-8-rules-i-learned/

[^22]: https://gist.github.com/kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea

[^23]: https://addyosmani.com/blog/self-improving-agents/

[^24]: https://news.ycombinator.com/item?id=46743908
