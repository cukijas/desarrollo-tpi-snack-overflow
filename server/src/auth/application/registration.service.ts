import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { RegisterDto } from '../dto/register.dto.js';
import { RegisterResponseDto } from '../dto/register-response.dto.js';
import {
  type IRegulatedTradeRepository,
  REGULATED_TRADE_REPOSITORY,
} from '../ports/regulated-trade.repository.port.js';
import {
  type IUserRepository,
  USER_REPOSITORY,
} from '../ports/user.repository.port.js';
import { ProviderStatus } from '../domain/provider-status.enum.js';
import { UserRole } from '../domain/user-role.enum.js';
import { UserStatus } from '../domain/user-status.enum.js';

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(REGULATED_TRADE_REPOSITORY)
    private readonly regulatedTradeRepo: IRegulatedTradeRepository,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    // Step 1: Normalize email to lowercase
    const normalizedEmail = dto.email.toLowerCase();

    // RegistrableRole and UserRole share their string values; bridge the
    // nominal enum gap once so the rest of the flow works in UserRole terms.
    const role = dto.role as unknown as UserRole;

    // Step 1b: Defense in depth (RN-REG-01, ESC-08). The DTO already restricts
    // role to cliente/prestador, but the service must not trust its input: even
    // if `administrador` slips past the boundary, reject it as a validation
    // failure (422) before any persistence happens. Privilege-escalation guard.
    if (role === UserRole.ADMINISTRADOR) {
      this.logger.warn('REGISTER_REJECTED_NON_REGISTRABLE_ROLE');
      throw new UnprocessableEntityException(
        'Role is not allowed for self-registration.',
      );
    }

    // Step 2: Check duplicate email (ESC-06, RN-REG-02)
    const existing = await this.userRepo.findByEmail(normalizedEmail);
    if (existing) {
      this.logger.log('REGISTER_DUPLICATE_EMAIL');
      throw new ConflictException('An account with this email already exists.');
    }

    // Step 3: Determine providerStatus
    let providerStatus: ProviderStatus | null = null;

    if (role === UserRole.PRESTADOR) {
      // trade is required for prestador (validated in service per design §5.4)
      if (dto.trade) {
        const regulated = await this.regulatedTradeRepo.findByTradeName(
          dto.trade.toLowerCase(),
        );
        providerStatus = regulated
          ? ProviderStatus.PENDIENTE_HABILITACION
          : ProviderStatus.HABILITADO;
      } else {
        // trade is required when role=prestador (design §5.4, RN-REG-03).
        // Surfaced as 422 to match the uniform validation-failure code.
        throw new UnprocessableEntityException(
          'Trade is required for prestador role.',
        );
      }
    }
    // else role === 'cliente' → providerStatus stays null (RN-REG-06, ESC-01)

    // Step 4: Hash password with Argon2id (RN-REG-04)
    const passwordHash = await argon2.hash(dto.password);

    // Step 5: Create user
    const user = await this.userRepo.create({
      name: dto.name,
      lastName: dto.lastName,
      email: normalizedEmail,
      phone: dto.phone,
      passwordHash,
      role,
      status: UserStatus.ACTIVO,
      providerStatus,
    });

    this.logger.log(`REGISTER_SUCCESS userId=${user.id} role=${user.role}`);

    // Step 6: Build response
    const response = new RegisterResponseDto();
    response.id = user.id;
    response.email = user.email;
    response.role = user.role;
    response.status = user.status;
    response.providerStatus = user.providerStatus;

    if (providerStatus === ProviderStatus.PENDIENTE_HABILITACION) {
      response.message =
        'Cuenta creada. Verificá tu matrícula profesional para activar tu perfil de prestador.';
    } else {
      response.message = 'Account created successfully.';
    }

    return response;
  }
}
