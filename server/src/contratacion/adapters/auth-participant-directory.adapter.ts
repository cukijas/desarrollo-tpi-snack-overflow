import { Inject, Injectable } from '@nestjs/common';
import { UserStatus } from '../../auth/domain/user-status.enum.js';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../auth/ports/user.repository.port.js';
import {
  ParticipantRole,
  type IParticipantDirectory,
} from '../ports/participant-directory.port.js';

/**
 * Integration seam (ADR-001 / C5): adapts auth's user repository to the
 * contratación-owned `IParticipantDirectory`. THIS is the only contratación
 * file allowed to import auth — it translates auth's `UserRole`/`UserStatus`
 * into contratación-local types so the application layer stays decoupled.
 *
 * The role string values are identical across both enums, so the mapping is a
 * direct cast guarded by membership in the local enum (unknown roles → null).
 */
@Injectable()
export class AuthParticipantDirectory implements IParticipantDirectory {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async getRole(userId: string): Promise<ParticipantRole | null> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      return null;
    }
    return Object.values(ParticipantRole).includes(
      user.role as unknown as ParticipantRole,
    )
      ? (user.role as unknown as ParticipantRole)
      : null;
  }

  async isActive(userId: string): Promise<boolean> {
    const user = await this.userRepo.findById(userId);
    return user !== null && user.status === UserStatus.ACTIVO;
  }

  async getDisplayName(userId: string): Promise<string | null> {
    const user = await this.userRepo.findById(userId);
    return user ? `${user.name} ${user.lastName}` : null;
  }
}
