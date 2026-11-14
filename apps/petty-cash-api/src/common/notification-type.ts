/** Channel for ExternalNotificationsService. Stored as a plain string on
 * NotificationLog.type (see prisma/schema.prisma), not a database enum,
 * matching every other type/status discriminator column in this schema. */
export const NotificationType = {
  blink: 'blink',
  email: 'email',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
