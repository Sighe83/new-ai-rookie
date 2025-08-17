import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerSideClient } from '@/lib/supabase-server';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    const supabase = await createServerSideClient();

    // Check if this webhook event was already processed (idempotency)
    const { data: isProcessed } = await supabase.rpc('is_webhook_processed', {
      p_stripe_event_id: event.id
    });

    if (isProcessed) {
      console.log(`Webhook event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    let processingError: string | null = null;
    let bookingId: string | null = null;

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          bookingId = paymentIntent.metadata.bookingId;

          if (bookingId) {
            const { error } = await supabase
              .from('bookings')
              .update({
                payment_status: 'authorized',
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_payment_intent_id', paymentIntent.id)
              .eq('payment_status', 'processing'); // Only update if currently processing

            if (error) {
              processingError = `Failed to update booking status: ${error.message}`;
              console.error(processingError);
            }
          }
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          bookingId = paymentIntent.metadata.bookingId;

          if (bookingId) {
            const { error } = await supabase
              .from('bookings')
              .update({
                payment_status: 'failed',
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_payment_intent_id', paymentIntent.id);

            if (error) {
              processingError = `Failed to update failed payment status: ${error.message}`;
              console.error(processingError);
            }
          }
          break;
        }

        case 'payment_intent.canceled': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          bookingId = paymentIntent.metadata.bookingId;

          if (bookingId) {
            const { error } = await supabase
              .from('bookings')
              .update({
                payment_status: 'cancelled',
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_payment_intent_id', paymentIntent.id);

            if (error) {
              processingError = `Failed to update cancelled payment status: ${error.message}`;
              console.error(processingError);
            }

            // Release slot if booking is cancelled
            const { error: slotError } = await supabase.rpc('cleanup_orphaned_slots');
            if (slotError) {
              console.error('Failed to cleanup slots after payment cancellation:', slotError);
            }
          }
          break;
        }

        case 'payment_intent.requires_action': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          bookingId = paymentIntent.metadata.bookingId;

          if (bookingId) {
            // Log for monitoring - payment requires additional customer action
            console.log(`Payment intent ${paymentIntent.id} requires action for booking ${bookingId}`);
          }
          break;
        }

        case 'payment_intent.processing': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          bookingId = paymentIntent.metadata.bookingId;

          if (bookingId) {
            const { error } = await supabase
              .from('bookings')
              .update({
                payment_status: 'processing',
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_payment_intent_id', paymentIntent.id)
              .eq('payment_status', 'pending'); // Only update if currently pending

            if (error) {
              processingError = `Failed to update processing status: ${error.message}`;
              console.error(processingError);
            }
          }
          break;
        }

        case 'charge.succeeded': {
          const charge = event.data.object as Stripe.Charge;
          const paymentIntentId = charge.payment_intent as string;

          if (paymentIntentId) {
            const { data: booking } = await supabase
              .from('bookings')
              .select('id, payment_status')
              .eq('stripe_payment_intent_id', paymentIntentId)
              .single();

            if (booking) {
              bookingId = booking.id;
              
              // Only update to captured if currently authorized
              if (booking.payment_status === 'authorized') {
                const { error } = await supabase
                  .from('bookings')
                  .update({
                    payment_status: 'captured',
                    amount_captured: charge.amount, // Store in cents
                    updated_at: new Date().toISOString(),
                  })
                  .eq('stripe_payment_intent_id', paymentIntentId);

                if (error) {
                  processingError = `Failed to update booking capture status: ${error.message}`;
                  console.error(processingError);
                }
              }
            }
          }
          break;
        }

        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge;
          const paymentIntentId = charge.payment_intent as string;

          if (paymentIntentId) {
            const { data: booking } = await supabase
              .from('bookings')
              .select('id')
              .eq('stripe_payment_intent_id', paymentIntentId)
              .single();

            if (booking) {
              bookingId = booking.id;

              const { error } = await supabase
                .from('bookings')
                .update({
                  payment_status: 'refunded',
                  amount_refunded: charge.amount_refunded, // Store in cents
                  updated_at: new Date().toISOString(),
                })
                .eq('stripe_payment_intent_id', paymentIntentId);

              if (error) {
                processingError = `Failed to update booking refund status: ${error.message}`;
                console.error(processingError);
              }
            }
          }
          break;
        }

        case 'charge.dispute.created': {
          const dispute = event.data.object as Stripe.Dispute;
          const chargeId = dispute.charge as string;
          
          // Log dispute for manual review
          console.error(`Dispute created for charge ${chargeId}: ${dispute.reason}`);
          
          // Could add dispute tracking to database here
          break;
        }

        case 'invoice.payment_succeeded': 
        case 'invoice.payment_failed': {
          // Handle subscription payments if implemented later
          console.log(`Invoice event: ${event.type}`);
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      processingError = `Webhook processing error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(processingError);
    }

    // Record webhook processing
    await supabase.rpc('record_webhook_processing', {
      p_stripe_event_id: event.id,
      p_event_type: event.type,
      p_booking_id: bookingId,
      p_success: processingError === null,
      p_error_message: processingError
    });

    if (processingError) {
      return NextResponse.json(
        { error: 'Webhook processing failed', details: processingError },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}