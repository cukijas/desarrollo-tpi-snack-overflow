/**
 * Roles a visitor (anonymous user) is allowed to self-register with.
 *
 * RN-REG-01: only `cliente` and `prestador` are self-registrable.
 * `administrador` is intentionally excluded — admin accounts are never created
 * through the public registration endpoint (privilege-escalation guard).
 *
 * Values mirror UserRole exactly (lowercase Spanish domain terms) so a
 * RegistrableRole is assignable to a UserRole without conversion.
 */
export enum RegistrableRole {
  CLIENTE = 'cliente',
  PRESTADOR = 'prestador',
}
