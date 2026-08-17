/**
 * Notification domain foundation.
 *
 * These are durable domain records and event contracts. Delivery providers,
 * queues, and channel implementations belong to later infrastructure work.
 */

import type { BookingId } from './booking';
import type { EntityId } from './entities';
import type { PaymentId, PaymentStatus } from './payment';
import type { ServiceId } from './catalog';

export type NotificationId = EntityId;

export type NotificationType =
  | 'booking_created'
  | 'booking_accepted'
  | 'booking_rejected'
  | 'booking_rescheduled'
  | 'booking_cancelled'
  | 'service_completed'
  | 'payment_status_changed'
  | 'refund_status_changed'
  | 'dispute_status_changed'
  | 'review_requested'
  | 'provider_operational_alert'
  | 'business_operational_alert';

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push' | 'whatsapp';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationStatus = 'pending' | 'read' | 'dismissed' | 'expired';
export type NotificationDeliveryStatus = 'not_requested' | 'pending' | 'delivered' | 'failed';

export interface NotificationRecipient {
  user_id: EntityId;
}

export type NotificationReference =
  | { reference_type: 'booking'; reference_id: BookingId }
  | { reference_type: 'payment'; reference_id: PaymentId; payment_status?: PaymentStatus }
  | { reference_type: 'service'; reference_id: ServiceId }
  | { reference_type: 'review'; reference_id: EntityId }
  | { reference_type: 'none' };

export type NotificationEventSource =
  | { source_type: 'booking'; source_id: BookingId }
  | { source_type: 'payment'; source_id: PaymentId }
  | { source_type: 'service'; source_id: ServiceId }
  | { source_type: 'system'; source_id: EntityId };

export interface Notification {
  id: NotificationId;
  recipient: NotificationRecipient;
  type: NotificationType;
  channel: NotificationChannel;
  priority: NotificationPriority;
  status: NotificationStatus;
  delivery_status: NotificationDeliveryStatus;
  title: string;
  body: string;
  reference: NotificationReference;
  source: NotificationEventSource;
  retry_key: string;
  delivery_attempts: number;
  created_at: Date;
  read_at?: Date;
  delivered_at?: Date;
  expires_at?: Date;
}

export interface NotificationEvent {
  id: EntityId;
  type: NotificationType;
  recipient: NotificationRecipient;
  source: NotificationEventSource;
  reference: NotificationReference;
  occurred_at: Date;
  idempotency_key: string;
  metadata?: Readonly<Record<string, string>>;
}

export interface NotificationRepository {
  get_notification(notification_id: NotificationId): Promise<Notification | null>;
  list_for_recipient(recipient: NotificationRecipient): Promise<readonly Notification[]>;
  save_notification(notification: Notification): Promise<Notification>;
  mark_read(notification_id: NotificationId, read_at: Date): Promise<void>;
}

export interface NotificationEventPublisher {
  publish(event: NotificationEvent): Promise<void>;
}
