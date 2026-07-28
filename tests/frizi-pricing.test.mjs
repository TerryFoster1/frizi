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
    customerId: 'client_new_demo',
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
        professionalId: 'mara',
        customerId: 'client_returning_demo',
        selectedServiceIds: [serviceIdFor('mara', 'Skin fade')],
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
        professionalId: 'omar',
        customerId: 'client_new_demo_2',
        selectedServiceIds: [serviceIdFor('omar', 'Fade and lineup')],
        promoCode: 'EXPIRED',
      }),
    /expired/,
  );

  assert.throws(
    () =>
      calculateAppointmentCheckout({
        appointmentId: 'appt_test_inactive',
        professionalId: 'omar',
        customerId: 'client_new_demo_2',
        selectedServiceIds: [serviceIdFor('omar', 'Fade and lineup')],
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
        customerId: 'client_new_demo_3',
        selectedServiceIds: [serviceIdFor('niko', 'Fade and lineup')],
        promoCode: 'FRIZI10',
        tipSelection: 'none',
      }),
    /minimum appointment value/,
  );

  const summary = calculateAppointmentCheckout({
    appointmentId: 'appt_test_fixed',
    professionalId: 'niko',
    customerId: 'client_new_demo_3',
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
    appointmentId: 'appt_demo_deposit_balance',
    professionalId: 'omar',
    customerId: 'client_deposit_demo',
    selectedServiceIds: [serviceIdFor('omar', 'Fade and lineup')],
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
        customerId: 'client_used_promo_demo',
        selectedServiceIds: [serviceIdFor('jo', 'Fine hair shaping')],
        promoCode: 'FIRSTCUT25',
      }),
    /already been used/,
  );
});
