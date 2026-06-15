/**
 * Contratación-owned view of the participant (user) directory.
 *
 * ADR-001 (modularity / C5): the contratación application layer must NOT
 * depend on `auth/domain`. This port exposes ONLY what contratación needs to
 * authorize and present participants — using contratación-LOCAL types — and an
 * adapter (in `contratacion/adapters/`) integrates it with auth's user
 * repository. The application service depends on this port, never on auth.
 */

/**
 * Roles relevant to contratación authorization. String values mirror the auth
 * roles so the runtime comparisons stay byte-for-byte identical; the type is
 * owned by contratación so the application layer never imports auth's enum.
 */
export enum ParticipantRole {
  CLIENTE = 'cliente',
  PRESTADOR = 'prestador',
  ADMINISTRADOR = 'administrador',
}

export const PARTICIPANT_DIRECTORY = 'PARTICIPANT_DIRECTORY';

export interface IParticipantDirectory {
  /** Role of the participant, or null when the participant does not exist. */
  getRole(userId: string): Promise<ParticipantRole | null>;

  /** Whether the participant exists AND has an active account. */
  isActive(userId: string): Promise<boolean>;

  /**
   * Human-readable display name ("name lastName"), or null when the participant
   * does not exist (callers fall back to a placeholder).
   */
  getDisplayName(userId: string): Promise<string | null>;
}
