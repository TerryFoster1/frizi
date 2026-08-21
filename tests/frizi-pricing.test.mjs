import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateAppointmentCheckout,
  calculateTipCents,
  serviceIdFor,
} from '../api/_frizi-pricing.mjs';

test('calculates first cut automatic promotion, tax, and 20 percent tip from original subtotal', () => {
  const summary = calculateAppointmentCheckout({
    appointmentId: 'appt_test_first_cut',
    professionalId: 'talia',
    customerId: 'preview_new_client',
    selectedServiceIds: [serviceIdFor('talia', 'Soft fade')],
    tipSelection: '20',
  });

  assert.equal(summary.serviceSubtotalCents, 6000);
  assert.equal(summary.promotion.id, 'promo_first_cut_25');
  assert.equal(summary.discountCents, 1500);
  assert.equal(summary.discountedServiceSubtotalCents, 4500);
  assert.equal(summary.taxCents, 585);
  assert.equal(summary.tipCents, 1200);
  assert.equal(summary.amountDueCents, 6285);
});

test('rejects first cut promotion for a returning customer', () => {
  assert.throws(
    () =>
      calculateAppointmentCheckout({
        appointmentId: 'appt_test_returning',
        professionalId: 'preview_pro_2',
        customerId: 'preview_returning_client',
        selectedServiceIds: [serviceIdFor('preview_pro_2', 'Skin fade')],
        promoCode: 'FIRSTCUT25',
        tipSelection: 'none',
      }),
    /first-time clients/,
  );
});

test('rejects expired and inactive promo codes', () => {
  assert.throws(
    () =>
      calculateAppointmentCheckout({
        appointmentId: 'appt_test_expired',
        professionalId: 'preview_pro_1',
        customerId: 'preview_new_client_2',
        selectedServiceIds: [serviceIdFor('preview_pro_1', 'Fade and lineup')],
        promoCode: 'EXPIRED',
      }),
    /expired/,
  );

  assert.throws(
    () =>
      calculateAppointmentCheckout({
        appointmentId: 'appt_test_inactive',
        professionalId: 'preview_pro_1',
        customerId: 'preview_new_client_2',
        selectedServiceIds: [serviceIdFor('preview_pro_1', 'Fade and lineup')],
        promoCode: 'INACTIVE',
      }),
    /not active/,
  );
});

test('supports fixed discount minimum subtotal and removes only the selected promotion', () => {
  assert.throws(
    () =>
      calculateAppointmentCheckout({
        appointmentId: 'appt_test_minimum',
        professionalId: 'niko',
        customerId: 'preview_new_client_3',
        selectedServiceIds: [serviceIdFor('niko', 'Fade and lineup')],
        promoCode: 'FRIZI10',
        tipSelection: 'none',
      }),
    /minimum appointment value/,
  );

  const summary = calculateAppointmentCheckout({
    appointmentId: 'appt_test_fixed',
    professionalId: 'niko',
    customerId: 'preview_new_client_3',
    selectedServiceIds: [serviceIdFor('niko', 'Fade and beard shape')],
    promoCode: 'FRIZI10',
    tipSelection: 'none',
  });

  assert.equal(summary.discountCents, 1000);
  assert.equal(summary.promotion.id, 'promo_fixed_10');
});

test('validates custom tips and rejects excessive amounts', () => {
  assert.equal(calculateTipCents('custom', '12.34', 6000), 1234);
  assert.throws(() => calculateTipCents('custom', '-1.00', 6000), /valid dollar amount/);
  assert.throws(() => calculateTipCents('custom', '250.00', 6000), /cannot exceed/);
});

test('applies deposits once to the amount due and keeps tip separate', () => {
  const summary = calculateAppointmentCheckout({
    appointmentId: 'appt_preview_deposit_balance',
    professionalId: 'preview_pro_1',
    customerId: 'preview_deposit_client',
    selectedServiceIds: [serviceIdFor('preview_pro_1', 'Fade and lineup')],
    tipSelection: '15',
  });

  assert.equal(summary.depositCreditCents, 2000);
  assert.equal(summary.tipCents, 780);
  assert.equal(summary.amountDueCents, summary.discountedServiceSubtotalCents + summary.taxCents - 2000 + 780);
});

test('prevents duplicate customer redemption of an already used offer', () => {
  assert.throws(
    () =>
      calculateAppointmentCheckout({
        appointmentId: 'appt_test_duplicate_redemption',
        professionalId: 'jo',
        customerId: 'preview_used_promo_client',
        selectedServiceIds: [serviceIdFor('jo', 'Fine hair shaping')],
        promoCode: 'FIRSTCUT25',
      }),
    /already been used/,
  );
});
