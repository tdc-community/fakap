import { Injectable } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { AuditLogRecord, CreateAuditLogInput } from './audit.types';

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async log(input: CreateAuditLogInput): Promise<AuditLogRecord> {
    return this.auditRepository.create(input);
  }

  async listRecent(limit: number): Promise<AuditLogRecord[]> {
    return this.auditRepository.listRecent(limit);
  }
}

