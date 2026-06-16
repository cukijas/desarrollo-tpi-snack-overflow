# Tasks: Registro Localidad Prestador

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 800-1200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Backend foundation (types, ports, repo, coords) → PR 2: Auth service + transaction → PR 3: Frontend form + copy |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend foundation: coords map, repo port, typeorm impl, auth port re-export | PR 1 | Base: feature/registro-localidad-prestador; tests included |
| 2 | RegistrationService transaction + prestador creation | PR 2 | Base: PR 1 branch; depends on Unit 1 |
| 3 | Frontend: validation, API types, form, copy | PR 3 | Base: PR 1 branch; independent of PR 2 for frontend work |

## Phase 1: Backend Foundation

- [ ] 1.1 Create `server/src/catalogo/domain/cobertura-util.ts` with `localidadToCoords` map (all 17 UBICACIONES cities) and `getCoordsForLocalidad()` helper
- [ ] 1.2 Add `CreatePrestadorData` interface and `create(data, qr?)` method to `IPrestadorRepository` in `server/src/catalogo/ports/prestador-repository.port.ts`
- [ ] 1.3 Implement `create()` in `server/src/catalogo/adapters/typeorm-prestador.repository.ts` using `qr?.manager.save() ?? this.repo.save()`
- [ ] 1.4 Create `server/src/auth/ports/prestador-repository.port.ts` re-exporting `IPrestadorRepository` and `PRESTADOR_REPOSITORY` token

## Phase 2: Registration Service Transaction

- [ ] 2.1 Add `localidad?: string` to `RegisterDto` in `server/src/auth/dto/register.dto.ts` with `@IsOptional()`, `@IsString()`, `@MaxLength(100)`
- [ ] 2.2 Inject `DataSource` and `IPrestadorRepository` into `RegistrationService` in `server/src/auth/application/registration.service.ts`
- [ ] 2.3 Implement `register()` transaction: validate localidad, lookup coords, build `zonaCobertura` via `CoberturaZona.fromCircle()`, map `categoria` from `TRADES`, determine `providerStatus`, wrap user+prestador create in `QueryRunner` transaction
- [ ] 2.4 Add unit test for `localidadToCoords` completeness (all 17 cities) and `getCoordsForLocalidad()` behavior
- [ ] 2.5 Add unit test for `categoria` mapping: `electricista` → `Electricista`, `tecnico-refrigeracion` → `Técnico en refrigeración`
- [ ] 2.6 Add integration test for `RegistrationService.register()` with mocked repositories + QueryRunner; verify rollback on prestador failure

## Phase 3: Frontend Integration

- [ ] 3.1 Add `localidad` field to zod schema in `client/lib/validation/registro.ts` (conditional required when role=prestador); update `RegistroFormValues` and `registroDefaults`
- [ ] 3.2 Add `localidad?: string` to `RegisterPayload` in `client/lib/api/auth.ts`
- [ ] 3.3 Add conditional `localidad` Select in `client/components/cuentas/registro-form.tsx` after trade select when `role === 'prestador'`; populate from unique `UBICACIONES` cities sorted alphabetically
- [ ] 3.4 Add copy strings to `client/lib/copy/es-AR.ts`: `registro.localidadLabel`, `localidadHelp`, `localidadPlaceholder`, `fieldErrors.localidad`
- [ ] 3.5 Add E2E test: prestador registration with localidad appears in `/catalogo/prestadores?oficio=Electricista&ubicacion=Posadas` search
- [ ] 3.6 Add E2E test: cliente registration shows no localidad field and succeeds

## Phase 4: Verification & Polish

- [ ] 4.1 Add integration test for `TypeOrmPrestadorRepository.create()` with testcontainers; verify row inserted with correct GeoJSON geometry
- [ ] 4.2 Add unit test for `CoberturaZona.fromCircle()` output: geometry type=Polygon, closed ring, bbox ~0.3° span
- [ ] 4.3 Run all existing tests to ensure no regressions
- [ ] 4.4 Verify CI check: frontend `UBICACIONES` cities match backend `localidadToCoords` keys