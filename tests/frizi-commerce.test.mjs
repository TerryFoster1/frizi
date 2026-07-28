import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCommerceCart,
  getCommerceCatalogue,
} from '../api/_frizi-commerce.mjs';

test('catalogue separates purchasable Canadian-approved products from blocked products', () => {
  const catalogue = getCommerceCatalogue('client_ari_demo');
  const approved = catalogue.find((item) => item.variant.id === 'var_pattern_leave_in_289ml');
  const blocked = catalogue.find((item) => item.variant.id === 'var_living_proof_texture_238ml');

  assert.equal(approved.purchasable, true);
  assert.equal(approved.recommendation.id, 'rec_mara_ari_leavein');
  assert.equal(blocked.purchasable, false);
  assert.match(blocked.blockedReason, /awaiting Canadian-sale review|approved for Canadian sale/);
});

test('calculates product cart, promotion, shipping, Ontario tax, and commission attribution', () => {
  const summary = calculateCommerceCart({
    customerId: 'client_ari_demo',
    items: [{ variantId: 'var_pattern_leave_in_289ml', quantity: 1, recommendationId: 'rec_mara_ari_leavein' }],
    shippingAddress: { province: 'ON', postalCode: 'M5V 2T6' },
    promoCode: 'PRODUCT10',
  });

  assert.equal(summary.merchandiseSubtotalCents, 3600);
  assert.equal(summary.productDiscountCents, 360);
  assert.equal(summary.merchandiseNetCents, 3240);
  assert.equal(summary.shipping.shippingCents, 995);
  assert.equal(summary.taxCents, 551);
  assert.equal(summary.totalCents, 4786);
  assert.equal(summary.items[0].professionalName, 'Mara Chen');
  assert.equal(summary.items[0].commissionBaseCents, 3240);
  assert.equal(summary.items[0].commissionCents, 389);
});

test('free shipping applies automatically above configured threshold', () => {
  const summary = calculateCommerceCart({
    customerId: 'client_ari_demo',
    items: [
      { variantId: 'var_pattern_leave_in_289ml', quantity: 1 },
      { variantId: 'var_briogeo_mask_240ml', quantity: 1, recommendationId: 'rec_mara_ari_mask' },
    ],
    shippingAddress: { province: 'BC', postalCode: 'V6B 1A1' },
  });

  assert.equal(summary.merchandiseSubtotalCents, 8800);
  assert.equal(summary.shipping.shippingDiscountCents, 995);
  assert.equal(summary.shipping.shippingCents, 0);
  assert.equal(summary.taxCents, 1056);
  assert.equal(summary.totalCents, 9856);
});

test('blocks unapproved or unsupported products from cart checkout', () => {
  assert.throws(
    () =>
      calculateCommerceCart({
        customerId: 'client_ari_demo',
        items: [{ variantId: 'var_living_proof_texture_238ml', quantity: 1 }],
        shippingAddress: { province: 'ON', postalCode: 'M5V 2T6' },
      }),
    /Canadian-sale review|approved for Canadian sale/,
  );
});

test('validates Canadian postal codes before payment', () => {
  assert.throws(
    () =>
      calculateCommerceCart({
        customerId: 'client_ari_demo',
        items: [{ variantId: 'var_pattern_leave_in_289ml', quantity: 1 }],
        shippingAddress: { province: 'ON', postalCode: '12345' },
      }),
    /valid Canadian postal code/,
  );
});
