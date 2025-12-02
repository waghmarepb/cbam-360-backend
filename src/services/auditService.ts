import mongoose from 'mongoose';
import AuditLog, { AuditAction, AuditResource } from '../models/AuditLog';
import { Request } from 'express';

interface AuditLogInput {
  organisation: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: mongoose.Types.ObjectId;
  resourceName?: string;
  description: string;
  changes?: { field: string; oldValue?: string; newValue?: string }[];
  metadata?: Record<string, unknown>;
  req?: Request;
}

class AuditService {
  async log(input: AuditLogInput): Promise<void> {
    try {
      const auditEntry = {
        organisation: input.organisation,
        user: input.user,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        resourceName: input.resourceName,
        description: input.description,
        changes: input.changes,
        metadata: input.metadata,
        ipAddress: input.req?.ip || input.req?.socket?.remoteAddress,
        userAgent: input.req?.get('user-agent')
      };

      await AuditLog.create(auditEntry);
    } catch (error) {
      // Don't throw - audit logging should not break the main operation
      console.error('Audit log error:', error);
    }
  }

  // Convenience methods for common actions
  async logCreate(
    organisation: mongoose.Types.ObjectId,
    user: mongoose.Types.ObjectId,
    resource: AuditResource,
    resourceId: mongoose.Types.ObjectId,
    resourceName: string,
    req?: Request
  ): Promise<void> {
    await this.log({
      organisation,
      user,
      action: AuditAction.CREATE,
      resource,
      resourceId,
      resourceName,
      description: `Created ${resource}: ${resourceName}`,
      req
    });
  }

  async logUpdate(
    organisation: mongoose.Types.ObjectId,
    user: mongoose.Types.ObjectId,
    resource: AuditResource,
    resourceId: mongoose.Types.ObjectId,
    resourceName: string,
    changes: { field: string; oldValue?: string; newValue?: string }[],
    req?: Request
  ): Promise<void> {
    await this.log({
      organisation,
      user,
      action: AuditAction.UPDATE,
      resource,
      resourceId,
      resourceName,
      description: `Updated ${resource}: ${resourceName}`,
      changes,
      req
    });
  }

  async logDelete(
    organisation: mongoose.Types.ObjectId,
    user: mongoose.Types.ObjectId,
    resource: AuditResource,
    resourceId: mongoose.Types.ObjectId,
    resourceName: string,
    req?: Request
  ): Promise<void> {
    await this.log({
      organisation,
      user,
      action: AuditAction.DELETE,
      resource,
      resourceId,
      resourceName,
      description: `Deleted ${resource}: ${resourceName}`,
      req
    });
  }

  async logLogin(
    organisation: mongoose.Types.ObjectId,
    user: mongoose.Types.ObjectId,
    userName: string,
    req?: Request
  ): Promise<void> {
    await this.log({
      organisation,
      user,
      action: AuditAction.LOGIN,
      resource: AuditResource.USER,
      resourceId: user,
      resourceName: userName,
      description: `User logged in: ${userName}`,
      req
    });
  }

  async logExport(
    organisation: mongoose.Types.ObjectId,
    user: mongoose.Types.ObjectId,
    resource: AuditResource,
    exportType: string,
    metadata?: Record<string, unknown>,
    req?: Request
  ): Promise<void> {
    await this.log({
      organisation,
      user,
      action: AuditAction.EXPORT,
      resource,
      description: `Exported ${resource} as ${exportType}`,
      metadata,
      req
    });
  }

  async logCalculation(
    organisation: mongoose.Types.ObjectId,
    user: mongoose.Types.ObjectId,
    calculationId: mongoose.Types.ObjectId,
    periodName: string,
    req?: Request
  ): Promise<void> {
    await this.log({
      organisation,
      user,
      action: AuditAction.CALCULATE,
      resource: AuditResource.CALCULATION,
      resourceId: calculationId,
      resourceName: periodName,
      description: `Ran calculation for ${periodName}`,
      req
    });
  }

  async logReportGeneration(
    organisation: mongoose.Types.ObjectId,
    user: mongoose.Types.ObjectId,
    reportId: mongoose.Types.ObjectId,
    reportName: string,
    reportType: string,
    req?: Request
  ): Promise<void> {
    await this.log({
      organisation,
      user,
      action: AuditAction.GENERATE_REPORT,
      resource: AuditResource.REPORT,
      resourceId: reportId,
      resourceName: reportName,
      description: `Generated ${reportType} report: ${reportName}`,
      req
    });
  }
}

export const auditService = new AuditService();
export default auditService;

