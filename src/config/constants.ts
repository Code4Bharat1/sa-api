export const ROLES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  TECHNICIAN: 'technician',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const TICKET_STATUS = {
  OPEN: 'Open',
  UNDER_REVIEW: 'Under Review',
  ASSIGNED: 'Assigned',
  VISIT_SCHEDULED: 'Technician Visit Scheduled',
  IN_PROGRESS: 'In Progress',
  PART_REQUIRED: 'Part Required',
  ON_HOLD: 'On Hold',
  RESOLVED: 'Resolved',
  CONFIRMATION_PENDING: 'Customer Confirmation Pending',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
} as const;

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

export const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TICKET_STATUS.OPEN]: [TICKET_STATUS.UNDER_REVIEW, TICKET_STATUS.ASSIGNED],
  [TICKET_STATUS.UNDER_REVIEW]: [TICKET_STATUS.ASSIGNED, TICKET_STATUS.ON_HOLD],
  [TICKET_STATUS.ASSIGNED]: [TICKET_STATUS.VISIT_SCHEDULED, TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.ON_HOLD],
  [TICKET_STATUS.VISIT_SCHEDULED]: [TICKET_STATUS.VISIT_SCHEDULED, TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.ON_HOLD, TICKET_STATUS.ASSIGNED],
  [TICKET_STATUS.IN_PROGRESS]: [TICKET_STATUS.PART_REQUIRED, TICKET_STATUS.RESOLVED, TICKET_STATUS.ON_HOLD],
  [TICKET_STATUS.PART_REQUIRED]: [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.ON_HOLD],
  [TICKET_STATUS.ON_HOLD]: [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.ASSIGNED],
  [TICKET_STATUS.RESOLVED]: [TICKET_STATUS.CONFIRMATION_PENDING],
  [TICKET_STATUS.CONFIRMATION_PENDING]: [TICKET_STATUS.CLOSED, TICKET_STATUS.REOPENED],
  [TICKET_STATUS.CLOSED]: [TICKET_STATUS.REOPENED],
  [TICKET_STATUS.REOPENED]: [TICKET_STATUS.UNDER_REVIEW, TICKET_STATUS.ASSIGNED, TICKET_STATUS.VISIT_SCHEDULED, TICKET_STATUS.IN_PROGRESS],
};

export const ISSUE_CATEGORIES = [
  'Touch not working',
  'Display problem',
  'Panel not turning on',
  'Sound issue',
  'Connectivity issue',
  'Software issue',
  'Pen/Writing issue',
  'Screen damage',
  'Camera/Mic issue',
  'Installation issue',
  'Training required',
  'Warranty claim',
  'Other',
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

export const NOTIFICATION_CHANNELS = {
  SMS: 'sms',
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  IN_APP: 'in-app',
} as const;

export const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'application/pdf',
  'audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg', 'audio/m4a', 'audio/x-m4a'
];
export const MAX_FILE_SIZE_MB = 20;
