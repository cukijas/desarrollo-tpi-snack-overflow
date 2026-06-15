# ADR-004 — Stack: TypeScript end-to-end (Next.js + NestJS)

- **Estado:** Aceptada (Fase de Elaboración)
- **Formato:** Nygard
- **Relacionada con:** ADR-001, ADR-002

## Contexto

El equipo es pequeño (6) y los roles **rotan por fase**, por lo que cualquier integrante puede
tener que tocar cualquier capa. Además, el pipeline SDD inyecta contexto a sub-agentes de IA: a
menor heterogeneidad de lenguajes/frameworks, menor contexto y menos errores. La arquitectura B ya
fija una SPA de presentación y un backend modular.

## Decisión

Usar **TypeScript como único lenguaje en todas las capas**:

- **Frontend:** Next.js + React + TypeScript (`client/`).
- **Backend:** NestJS + Node.js + TypeScript, API REST (`server/`).
- Tipos y contratos compartibles entre capas.

## Consecuencias

- (+) Menor carga cognitiva para el equipo rotativo; contexto SDD más simple.
- (+) NestJS provee modularidad e inyección de dependencias alineadas a ADR-001/002.
- (+) Ecosistema único de tooling (ESLint, Prettier, Jest).
- (−) Dependencia del ecosistema Node/TS; sin diversidad de runtimes para cargas especializadas
  (aceptable dado el alcance).
- (−) Next.js 16 / React 19 son versiones recientes con cambios disruptivos → consultar docs de la
  versión antes de codear (ver `client/AGENTS.md`).

## Actualización (Construcción — 2026-06-14)

El runner de tests unitarios del **frontend** es **Vitest**, no Jest. El backend continúa usando
Jest. La consecuencia "(+) Ecosistema único de tooling (ESLint, Prettier, Jest)" requiere esta
aclaración.

Justificación: Vitest es el runner idiomático del ecosistema Vite/Next 16 — integración nativa
con el build toolchain, sin necesidad de transformación adicional, y con tiempos de ejecución
sensiblemente menores. Mantener Jest en el frontend agregaría fricción de configuración sin
beneficio tangible. El principio de "ecosistema de tooling coherente" se sostiene **a nivel de
capa**: cada capa tiene un único runner alineado a su stack (Jest en el backend, Vitest en el
frontend). Decisión aceptada.
