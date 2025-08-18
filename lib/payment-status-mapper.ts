/**
 * PaymentStatusMapper - Unified mapping between Stripe payment statuses and business-friendly database statuses
 * 
 * This utility provides a centralized way to map Stripe's technical payment statuses to business-friendly
 * statuses used in our database, ensuring consistency across the application.
 */

export type StripePaymentStatus = 
  | 'requires_payment_method'
  | 'requires_action' 
  | 'processing'
  | 'requires_capture'
  | 'succeeded'
  | 'canceled'
  | 'requires_confirmation';

export type BusinessPaymentStatus =
  | 'pending'
  | 'processing' 
  | 'requires_action'
  | 'authorized'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export class PaymentStatusMapper {
  /**
   * Maps Stripe PaymentIntent status to business-friendly status
   */
  private static readonly STRIPE_TO_BUSINESS: Record<StripePaymentStatus, BusinessPaymentStatus> = {
    'requires_payment_method': 'pending',
    'requires_confirmation': 'pending',
    'requires_action': 'requires_action',
    'processing': 'processing',
    'requires_capture': 'authorized',
    'succeeded': 'completed',
    'canceled': 'cancelled'
  };

  /**
   * Defines valid status transitions for business logic validation
   */
  private static readonly VALID_TRANSITIONS: Record<BusinessPaymentStatus, BusinessPaymentStatus[]> = {
    'pending': ['processing', 'requires_action', 'failed', 'cancelled'],
    'processing': ['authorized', 'completed', 'requires_action', 'failed', 'cancelled'],
    'requires_action': ['processing', 'authorized', 'completed', 'failed', 'cancelled'],
    'authorized': ['completed', 'failed', 'cancelled'],
    'completed': ['refunded'],
    'failed': ['pending', 'cancelled'],
    'cancelled': [],
    'refunded': []
  };

  /**
   * Maps a Stripe PaymentIntent status to business status
   * Handles special cases like manual capture flow
   */
  static mapStripeStatus(
    stripeStatus: StripePaymentStatus | string,
    captureMethod?: 'automatic' | 'manual' | 'automatic_async'
  ): BusinessPaymentStatus {
    // Handle unknown statuses gracefully
    if (!(stripeStatus in this.STRIPE_TO_BUSINESS)) {
      console.warn(`Unknown Stripe status: ${stripeStatus}. Defaulting to 'failed'.`);
      return 'failed';
    }

    const mappedStatus = this.STRIPE_TO_BUSINESS[stripeStatus as StripePaymentStatus];

    // Special handling for manual capture flow
    if (captureMethod === 'manual') {
      if (stripeStatus === 'requires_capture') {
        // Payment is authorized and awaiting manual capture
        return 'authorized';
      }
      if (stripeStatus === 'succeeded') {
        // Payment has been successfully captured in manual mode
        return 'completed';
      }
    }

    return mappedStatus;
  }

  /**
   * Gets the appropriate business status from a Stripe PaymentIntent object
   */
  static getBusinessStatusFromPaymentIntent(paymentIntent: any): BusinessPaymentStatus {
    return this.mapStripeStatus(paymentIntent.status, paymentIntent.capture_method);
  }

  /**
   * Validates if a status transition is allowed based on business rules
   */
  static isValidTransition(fromStatus: BusinessPaymentStatus, toStatus: BusinessPaymentStatus): boolean {
    const allowedTransitions = this.VALID_TRANSITIONS[fromStatus];
    return allowedTransitions ? allowedTransitions.includes(toStatus) : false;
  }

  /**
   * Checks if a given string is a valid business payment status
   */
  static isValidBusinessStatus(status: string): status is BusinessPaymentStatus {
    return Object.values(this.VALID_TRANSITIONS).flat().includes(status as BusinessPaymentStatus) ||
           Object.keys(this.VALID_TRANSITIONS).includes(status as BusinessPaymentStatus);
  }

  /**
   * Checks if a given string is a known Stripe status
   */
  static isKnownStripeStatus(status: string): status is StripePaymentStatus {
    return status in this.STRIPE_TO_BUSINESS;
  }

  /**
   * Gets all valid next statuses for a given current status
   */
  static getValidNextStatuses(currentStatus: BusinessPaymentStatus): BusinessPaymentStatus[] {
    return this.VALID_TRANSITIONS[currentStatus] || [];
  }

  /**
   * Determines if a status is terminal (no further transitions possible)
   */
  static isTerminalStatus(status: BusinessPaymentStatus): boolean {
    return this.VALID_TRANSITIONS[status].length === 0;
  }

  /**
   * Gets a human-readable description for a business status
   */
  static getStatusDescription(status: BusinessPaymentStatus): string {
    const descriptions: Record<BusinessPaymentStatus, string> = {
      'pending': 'Waiting for payment method',
      'processing': 'Payment is being processed',
      'requires_action': 'Customer authentication required',
      'authorized': 'Payment authorized, ready to capture',
      'completed': 'Payment completed successfully',
      'failed': 'Payment failed',
      'cancelled': 'Payment was cancelled',
      'refunded': 'Payment has been refunded'
    };

    return descriptions[status] || 'Unknown status';
  }
}

/**
 * Custom error for invalid status transitions
 */
export class InvalidPaymentStatusTransitionError extends Error {
  constructor(
    public readonly fromStatus: BusinessPaymentStatus,
    public readonly toStatus: BusinessPaymentStatus,
    public readonly bookingId?: string
  ) {
    super(`Invalid payment status transition from '${fromStatus}' to '${toStatus}'${bookingId ? ` for booking ${bookingId}` : ''}`);
    this.name = 'InvalidPaymentStatusTransitionError';
  }
}

/**
 * Custom error for unknown Stripe statuses
 */
export class UnknownStripeStatusError extends Error {
  constructor(
    public readonly stripeStatus: string,
    public readonly bookingId?: string
  ) {
    super(`Unknown Stripe status '${stripeStatus}'${bookingId ? ` for booking ${bookingId}` : ''}`);
    this.name = 'UnknownStripeStatusError';
  }
}