import { env } from '../config/env.js';
import { IssueCategory } from '../config/constants.js';

interface SLAConfig {
  responseHours: number;
  resolutionHours: number;
}

const defaultSLA: SLAConfig = {
  responseHours: env.SLA_DEFAULT_RESPONSE_HOURS,
  resolutionHours: env.SLA_DEFAULT_RESOLUTION_HOURS,
};

const categorySLA: Partial<Record<IssueCategory, SLAConfig>> = {
  'Panel not turning on': { responseHours: 2, resolutionHours: 24 },
  'Screen damage': { responseHours: 4, resolutionHours: 72 },
  'Warranty claim': { responseHours: 8, resolutionHours: 120 },
};

export const getSLAForCategory = (category: IssueCategory): SLAConfig =>
  categorySLA[category] || defaultSLA;

export const computeExpectedTimes = (
  category: IssueCategory,
  createdAt: Date = new Date()
): { expectedResponseTime: Date; expectedResolutionTime: Date } => {
  const sla = getSLAForCategory(category);
  const expectedResponseTime = new Date(createdAt.getTime() + sla.responseHours * 3600 * 1000);
  const expectedResolutionTime = new Date(createdAt.getTime() + sla.resolutionHours * 3600 * 1000);
  return { expectedResponseTime, expectedResolutionTime };
};

export const isOverdue = (expectedResponseTime: Date): boolean =>
  new Date() > expectedResponseTime;
