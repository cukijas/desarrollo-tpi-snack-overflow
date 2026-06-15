# ADR-003 — Persistencia: PostgreSQL transaccional único + Redis caché

- **Estado:** Aceptada (Fase de Elaboración)
- **Formato:** Nygard
- **Relacionada con:** ADR-001

## Contexto

Los pagos y la máquina de estados de la contratación exigen garantías **ACID** (RNF-S.5): no se
puede liberar un pago ni avanzar un estado sobre datos inconsistentes. Simultáneamente, las
búsquedas con filtros deben responder en ≤2 s p95 (RNF-E.1) bajo ≥100 transacciones concurrentes
(RNF-E.2). Un único almacén relacional satisface la consistencia; las lecturas frecuentes
necesitan aceleración.

## Decisión

- **Repositorio transaccional único en PostgreSQL** accedido mediante el patrón **Repository**
  sobre un ORM. Toda operación crítica (pago, transición de estado) es transaccional ACID.
- **Redis** como caché de consultas frecuentes y almacén de sesiones.

## Consecuencias

- (+) Fiabilidad de pagos y transiciones de estado por garantías ACID (RNF-S.5).
- (+) Eficiencia de búsquedas vía caché (RNF-E.1, RNF-E.2).
- (+) Modelo de datos único, simple de razonar y respaldar.
- (−) Acoplamiento al esquema compartido y punto único de contención → mitigar con índices,
  réplicas de lectura y disciplina de caché (invalidación).

## Actualización (Construcción — 2026-06-14)

### Sesiones / caché

La decisión original contemplaba Redis como caché de consultas frecuentes **y** almacén de
sesiones. La implementación adoptó **autenticación JWT stateless**: no existe almacén de sesiones
server-side. Redis se emplea para **estado efímero de corta vida** (contadores de intentos de
login y lockout de cuenta). La caché de consultas de búsqueda queda **diferida**: hoy las
búsquedas consultan PostgreSQL directamente.

Justificación: una API stateless simplifica el escalado horizontal y elimina el estado de sesión
como punto de fallo. La caché de queries se introducirá cuando los RNF de performance (E.1/E.2)
lo exijan con datos de carga real. El espíritu del ADR se sostiene — Redis sigue siendo el
almacén de estado efímero del sistema — ; la letra se ajusta a la realidad de la fase.
Decisión aceptada.

### Gestión de esquema

El esquema se gestiona con la opción `synchronize` de TypeORM activada en entornos `dev` y
`test` (`synchronize: NODE_ENV !== 'production'`), ya desactivada en producción. Las
**migraciones formales quedan diferidas** al momento previo al despliegue a producción.

Justificación: en iteración temprana el modelo de datos está en flujo; introducir y mantener
migraciones antes de que el esquema se estabilice es costo prematuro. Esta diferencia se
registra también en ADR-007 (cross-ref).
Decisión aceptada.
