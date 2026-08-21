import { createHash } from 'node:crypto';

export const commercePricingVersion = 'frizi_commerce_v1';
export const commerceCheckoutEnabled = process.env.COMMERCE_CHECKOUT_ENABLED === 'true';
export const commerceLivePaymentsEnabled = process.env.COMMERCE_LIVE_PAYMENTS_ENABLED === 'true';
export const commerceCanadaPostEnabled = process.env.COMMERCE_CANADA_POST_ENABLED === 'true';
export const commerceAutomatedFulfillmentEnabled = process.env.COMMERCE_AUTOMATED_FULFILMENT_ENABLED === 'true';
export const commerceProPayoutsEnabled = process.env.COMMERCE_PRO_PAYOUTS_ENABLED === 'true';
export const cartQuoteTtlMinutes = Number(process.env.FRIZI_COMMERCE_QUOTE_TTL_MINUTES || '30');

const supportedClassifications = new Set(['cosmetic', 'consumer_product']);
const blockedClassifications = new Set([
  'drug',
  'natural_health_product',
  'medical_device',
  'professional_use_only',
  'restricted_or_unsupported',
  'unknown_unreviewed',
]);

const professionals = [
  { id: 'preview_pro_1', name: 'Preview Professional 1', salonId: 'preview_salon_1', salonName: 'Preview Studio 1' },
  { id: 'preview_pro_2', name: 'Preview Professional 2', salonId: 'preview_salon_2', salonName: 'Preview Studio 2' },
];

export const brands = [
  { id: 'brand_pattern', name: 'PATTERN Beauty' },
  { id: 'brand_living_proof', name: 'Living Proof' },
  { id: 'brand_briogeo', name: 'Briogeo' },
];

export const products = [
  {
    id: 'prod_pattern_leave_in',
    status: 'active',
    productType: 'hair_care',
    regulatoryClassification: 'cosmetic',
    complianceState: 'approved_for_canadian_sale',
    brandId: 'brand_pattern',
    brandName: 'PATTERN Beauty',
    productName: 'Leave-In Conditioner',
    subtitle: 'Curl-friendly moisture primer',
    description: 'A lightweight leave-in conditioner selected for curl refresh routines and dry ends.',
    usageInstructions: 'Apply a small amount to damp hair, then style as directed by your professional.',
    warnings: 'External use only. Stop use if irritation occurs.',
    hairTypes: ['curly', 'coily', 'wavy'],
    hairConcerns: ['dry_ends', 'frizz', 'curl_definition'],
    serviceCategories: ['curly_cuts', 'wash_and_style'],
    productCategories: ['leave_in_treatment', 'curl_care'],
    ingredients: '',
    ingredientSource: 'Supplier documentation required before production launch.',
    ingredientReviewStatus: 'requires_human_review',
    claimsReviewStatus: 'approved_demo_copy',
    supplierAuthorizationStatus: 'verified_demo_canadian_resale',
    canSellInCanada: true,
    canadianMarketVersion: true,
    canadianAuthorizedDistribution: true,
    bilingualLabelConfirmed: true,
    primaryImage:
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=80',
    sellerIdentity: 'Frizi Commerce Canada',
    complianceNote:
      'Demo-approved for Canadian-sale workflow. Final cosmetic notification, label, claims, supplier, tax, privacy, and consumer-law review required before live launch.',
  },
  {
    id: 'prod_living_proof_texture',
    status: 'active',
    productType: 'hair_care',
    regulatoryClassification: 'cosmetic',
    complianceState: 'awaiting_label_review',
    brandId: 'brand_living_proof',
    brandName: 'Living Proof',
    productName: 'Full Dry Volume & Texture Spray',
    subtitle: 'Volume and lived-in texture',
    description: 'Texture spray candidate for fine-hair styling recommendations.',
    usageInstructions: 'Use only after label and supplier review are complete.',
    warnings: 'Aerosol and shipping restrictions require review.',
    hairTypes: ['fine', 'straight', 'wavy'],
    hairConcerns: ['volume', 'flat_roots'],
    serviceCategories: ['blowout', 'fine_hair_care'],
    productCategories: ['texture_spray', 'styling'],
    ingredients: '',
    ingredientSource: 'Not verified.',
    ingredientReviewStatus: 'awaiting_supplier_documents',
    claimsReviewStatus: 'pending_review',
    supplierAuthorizationStatus: 'awaiting_authorization',
    canSellInCanada: false,
    canadianMarketVersion: false,
    canadianAuthorizedDistribution: false,
    bilingualLabelConfirmed: false,
    primaryImage:
      'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?auto=format&fit=crop&w=900&q=80',
    sellerIdentity: 'Frizi Commerce Canada',
    complianceNote: 'Blocked from purchase until label, aerosol shipping, supplier authorization, and Canadian-sale review are complete.',
  },
  {
    id: 'prod_briogeo_repair_mask',
    status: 'active',
    productType: 'hair_care',
    regulatoryClassification: 'cosmetic',
    complianceState: 'approved_for_canadian_sale',
    brandId: 'brand_briogeo',
    brandName: 'Briogeo',
    productName: 'Deep Conditioning Hair Mask',
    subtitle: 'Conditioning treatment for dry-feeling hair',
    description: 'A repair-mask style recommendation for clients maintaining smooth styles at home.',
    usageInstructions: 'Use weekly as directed by your professional. Rinse thoroughly.',
    warnings: 'External use only. Stop use if irritation occurs.',
    hairTypes: ['curly', 'coily', 'straight', 'wavy'],
    hairConcerns: ['dryness', 'frizz', 'damage_appearance'],
    serviceCategories: ['colour_care', 'curl_care'],
    productCategories: ['hair_mask', 'conditioner'],
    ingredients: '',
    ingredientSource: 'Supplier documentation required before production launch.',
    ingredientReviewStatus: 'requires_human_review',
    claimsReviewStatus: 'approved_demo_copy',
    supplierAuthorizationStatus: 'verified_demo_canadian_resale',
    canSellInCanada: true,
    canadianMarketVersion: true,
    canadianAuthorizedDistribution: true,
    bilingualLabelConfirmed: true,
    primaryImage:
      'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=900&q=80',
    sellerIdentity: 'Frizi Commerce Canada',
    complianceNote:
      'Demo-approved for Canadian-sale workflow. Final cosmetic notification, label, claims, supplier, tax, privacy, and consumer-law review required before live launch.',
  },
];

export const variants = [
  {
    id: 'var_pattern_leave_in_289ml',
    productId: 'prod_pattern_leave_in',
    variantName: '289 mL bottle',
    sku: 'FRZ-PAT-LEAVEIN-289-DEMO',
    upc: null,
    barcode: null,
    sizeValue: 289,
    sizeUnit: 'mL',
    netQuantityDisplay: '289 mL',
    weightGrams: 340,
    dimensionsCm: { length: 6, width: 6, height: 17 },
    priceCents: 3600,
    compareAtPriceCents: 4200,
    costCents: 2100,
    currency: 'cad',
    inventoryMode: 'manual_purchase',
    inventoryPolicy: 'reserve_on_checkout',
    quantityOnHand: 12,
    quantityReserved: 1,
    complianceState: 'approved_for_canadian_sale',
    shippingRestrictions: [],
    returnPolicyId: 'cosmetic_unopened_14_day',
  },
  {
    id: 'var_living_proof_texture_238ml',
    productId: 'prod_living_proof_texture',
    variantName: '238 mL aerosol',
    sku: 'FRZ-LP-TEXTURE-238-DEMO',
    upc: null,
    barcode: null,
    sizeValue: 238,
    sizeUnit: 'mL',
    netQuantityDisplay: '238 mL',
    weightGrams: 310,
    dimensionsCm: { length: 5, width: 5, height: 24 },
    priceCents: 4300,
    compareAtPriceCents: null,
    costCents: 2700,
    currency: 'cad',
    inventoryMode: 'unavailable',
    inventoryPolicy: 'blocked_until_review',
    quantityOnHand: 0,
    quantityReserved: 0,
    complianceState: 'awaiting_label_review',
    shippingRestrictions: ['aerosol_review_required'],
    returnPolicyId: 'blocked_pending_review',
  },
  {
    id: 'var_briogeo_mask_240ml',
    productId: 'prod_briogeo_repair_mask',
    variantName: '240 mL jar',
    sku: 'FRZ-BRIO-MASK-240-DEMO',
    upc: null,
    barcode: null,
    sizeValue: 240,
    sizeUnit: 'mL',
    netQuantityDisplay: '240 mL',
    weightGrams: 390,
    dimensionsCm: { length: 8, width: 8, height: 8 },
    priceCents: 5200,
    compareAtPriceCents: null,
    costCents: 3100,
    currency: 'cad',
    inventoryMode: 'manual_purchase',
    inventoryPolicy: 'reserve_on_checkout',
    quantityOnHand: 8,
    quantityReserved: 0,
    complianceState: 'approved_for_canadian_sale',
    shippingRestrictions: [],
    returnPolicyId: 'cosmetic_unopened_14_day',
  },
];

export const suppliers = [
  {
    id: 'supplier_canadian_beauty_demo',
    legalName: 'Canadian Beauty Distributor Demo',
    resaleAuthorizationStatus: 'verified_demo',
    onlineResaleAllowed: true,
    dropshipAllowed: false,
    active: true,
    recallContact: 'recalls@example.invalid',
    complianceNote: 'Demo supplier only. Replace with real authorization evidence before live launch.',
  },
  {
    id: 'supplier_unverified_demo',
    legalName: 'Unverified Supplier Demo',
    resaleAuthorizationStatus: 'awaiting_review',
    onlineResaleAllowed: false,
    dropshipAllowed: false,
    active: false,
    recallContact: '',
    complianceNote: 'Blocked until resale authorization, Canadian distribution, and trademark/image permissions are reviewed.',
  },
];

export const supplierListings = [
  {
    id: 'listing_pattern_canadian_demo',
    productId: 'prod_pattern_leave_in',
    variantId: 'var_pattern_leave_in_289ml',
    supplierId: 'supplier_canadian_beauty_demo',
    supplierSku: 'PAT-LEAVEIN-289',
    wholesaleCostCents: 2100,
    currency: 'cad',
    availableInventory: 24,
    inventoryConfidence: 'manual_verified',
    leadTimeDays: 4,
    dropshipAvailable: false,
    active: true,
    preferredRank: 1,
  },
  {
    id: 'listing_texture_unverified_demo',
    productId: 'prod_living_proof_texture',
    variantId: 'var_living_proof_texture_238ml',
    supplierId: 'supplier_unverified_demo',
    supplierSku: 'LP-TEXTURE-238',
    wholesaleCostCents: 2700,
    currency: 'cad',
    availableInventory: 0,
    inventoryConfidence: 'unverified',
    leadTimeDays: 0,
    dropshipAvailable: false,
    active: false,
    preferredRank: 99,
  },
  {
    id: 'listing_briogeo_canadian_demo',
    productId: 'prod_briogeo_repair_mask',
    variantId: 'var_briogeo_mask_240ml',
    supplierId: 'supplier_canadian_beauty_demo',
    supplierSku: 'BRIO-MASK-240',
    wholesaleCostCents: 3100,
    currency: 'cad',
    availableInventory: 10,
    inventoryConfidence: 'manual_verified',
    leadTimeDays: 5,
    dropshipAvailable: false,
    active: true,
    preferredRank: 1,
  },
];

export const recommendations = [
  {
    id: 'rec_preview_leavein',
    customerId: 'preview_client',
    professionalId: 'preview_pro_1',
    salonId: 'salon_hairline',
    appointmentId: 'hist_preview_001',
    variantId: 'var_pattern_leave_in_289ml',
    reason: 'Recommended for maintaining curl shape between wash days.',
    usageInstructions: 'Start with a dime-size amount on damp ends and adjust after the next appointment.',
    frequency: 'After washing or curl refresh days',
    priority: 'routine_builder',
    active: true,
    consentStatus: 'visible_to_customer',
    attributionStatus: 'active',
    commissionRateBps: 1200,
    commissionRuleVersion: 'demo_professional_product_commission_v1',
    recommendedAt: '2026-07-14T16:00:00.000Z',
  },
  {
    id: 'rec_preview_mask',
    customerId: 'preview_client',
    professionalId: 'preview_pro_1',
    salonId: 'salon_hairline',
    appointmentId: 'hist_preview_001',
    variantId: 'var_briogeo_mask_240ml',
    reason: 'Recommended after colour service for softer-feeling ends.',
    usageInstructions: 'Use weekly, avoiding roots if hair gets flat.',
    frequency: 'Weekly',
    priority: 'maintenance',
    active: true,
    consentStatus: 'visible_to_customer',
    attributionStatus: 'active',
    commissionRateBps: 1000,
    commissionRuleVersion: 'demo_professional_product_commission_v1',
    recommendedAt: '2026-07-15T16:00:00.000Z',
  },
];

export const commercePromotions = [
  {
    id: 'commerce_first_order_10',
    name: 'First Product Order',
    code: 'PRODUCT10',
    scope: 'product',
    discountType: 'percentage',
    discountValue: 10,
    active: true,
    requiresCode: true,
    appliesAutomatically: false,
    minimumSubtotalCents: 3000,
    maximumDiscountCents: 1500,
    eligibleProductIds: [],
    eligibleCategoryIds: [],
    excludedProductIds: [],
    currency: 'cad',
    combinable: false,
  },
  {
    id: 'commerce_free_shipping_75',
    name: 'Free Shipping Over $75',
    code: '',
    scope: 'shipping',
    discountType: 'free_shipping',
    discountValue: 0,
    active: true,
    requiresCode: false,
    appliesAutomatically: true,
    minimumSubtotalCents: 7500,
    maximumDiscountCents: null,
    eligibleProductIds: [],
    eligibleCategoryIds: [],
    excludedProductIds: [],
    currency: 'cad',
    combinable: true,
  },
];

const provinceTaxBps = {
  AB: 500,
  BC: 1200,
  MB: 1200,
  NB: 1500,
  NL: 1500,
  NS: 1500,
  NT: 500,
  NU: 500,
  ON: 1300,
  PE: 1500,
  QC: 14975,
  SK: 1100,
  YT: 500,
};

const manualPackages = [
  { id: 'pkg_poly_mailer_small', name: 'Small padded mailer', maxWeightGrams: 650, costCents: 85 },
  { id: 'pkg_box_small', name: 'Small box', maxWeightGrams: 1600, costCents: 140 },
];

export function formatCurrency(cents, currency = 'cad') {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

function normalizeProvince(province) {
  return String(province || 'ON').trim().toUpperCase();
}

function normalizePostalCode(postalCode) {
  return String(postalCode || '').trim().toUpperCase().replace(/\s+/g, '');
}

function hashSnapshot(value) {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex');
}

function getProduct(productId) {
  return products.find((product) => product.id === productId);
}

function getVariant(variantId) {
  return variants.find((variant) => variant.id === variantId);
}

function getSupplierListing(variantId) {
  return supplierListings
    .filter((listing) => listing.variantId === variantId && listing.active)
    .sort((a, b) => a.preferredRank - b.preferredRank)[0];
}

function getSupplier(supplierId) {
  return suppliers.find((supplier) => supplier.id === supplierId);
}

function validateCanadianSale(product, variant, supplier, listing) {
  if (!product || !variant) throw new Error('This product is not available.');
  if (product.status !== 'active' || product.discontinued || product.recalled) throw new Error('This product is not available for purchase.');
  if (blockedClassifications.has(product.regulatoryClassification)) {
    throw new Error('This product category requires additional compliance review before Frizi can sell it.');
  }
  if (!supportedClassifications.has(product.regulatoryClassification)) {
    throw new Error('This product classification is not approved for Frizi commerce.');
  }
  if (product.complianceState !== 'approved_for_canadian_sale' || variant.complianceState !== 'approved_for_canadian_sale') {
    throw new Error('This product is awaiting Canadian-sale review.');
  }
  if (!product.canSellInCanada || !product.canadianAuthorizedDistribution || !product.bilingualLabelConfirmed) {
    throw new Error('This product is not approved for Canadian sale yet.');
  }
  if (!listing || !supplier || !supplier.active || !supplier.onlineResaleAllowed) {
    throw new Error('This product does not have an approved Canadian supplier listing.');
  }
  if (variant.inventoryMode === 'unavailable') throw new Error('This product is currently unavailable.');
}

function validateQuantity(quantity) {
  const parsed = Number(quantity);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    throw new Error('Choose a valid product quantity.');
  }
  return parsed;
}

function calculateShipping(items, province, postalCode, merchandiseSubtotalCents) {
  const normalizedPostalCode = normalizePostalCode(postalCode);
  if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(normalizedPostalCode)) {
    throw new Error('Enter a valid Canadian postal code.');
  }

  const totalWeightGrams = items.reduce((sum, item) => sum + item.variant.weightGrams * item.quantity, 0);
  const selectedPackage = manualPackages.find((pkg) => totalWeightGrams <= pkg.maxWeightGrams) || manualPackages[manualPackages.length - 1];
  const remoteSurchargeCents = ['X', 'Y'].includes(normalizedPostalCode[0]) ? 1200 : 0;
  const baseShippingCents = 995 + remoteSurchargeCents;
  const automaticFreeShipping = commercePromotions.find(
    (promotion) => promotion.scope === 'shipping' && promotion.appliesAutomatically && promotion.active && merchandiseSubtotalCents >= promotion.minimumSubtotalCents,
  );

  return {
    provider: commerceCanadaPostEnabled ? 'canada_post_test' : 'manual_flat_rate',
    service: commerceCanadaPostEnabled ? 'Canada Post test quote pending credentials' : 'Frizi standard shipping',
    shippingCents: automaticFreeShipping ? 0 : baseShippingCents,
    shippingDiscountCents: automaticFreeShipping ? baseShippingCents : 0,
    currency: 'cad',
    estimatedTransitDays: remoteSurchargeCents > 0 ? '6-10 business days' : '3-7 business days',
    expectedDeliveryLabel: remoteSurchargeCents > 0 ? 'Remote Canadian delivery estimate' : 'Standard Canadian delivery estimate',
    quoteExpiresAt: new Date(Date.now() + cartQuoteTtlMinutes * 60 * 1000).toISOString(),
    packageId: selectedPackage.id,
    packageName: selectedPackage.name,
    packageCostCents: selectedPackage.costCents,
    totalWeightGrams,
    destinationProvince: normalizeProvince(province),
    destinationPostalCode: normalizedPostalCode,
    source: 'frizi_manual_fulfillment_demo',
  };
}

function findProductPromotion(promoCode, merchandiseSubtotalCents, items) {
  const code = String(promoCode || '').trim().toUpperCase();
  if (!code) return null;
  const promotion = commercePromotions.find((record) => record.code === code);
  if (!promotion) throw new Error('Promotion not found.');
  if (!promotion.active) throw new Error('This promotion is not active.');
  if (promotion.scope !== 'product') throw new Error('This promotion does not apply to products.');
  if (promotion.currency !== 'cad') throw new Error('This promotion does not match the checkout currency.');
  if (merchandiseSubtotalCents < promotion.minimumSubtotalCents) {
    throw new Error(`The minimum product order value for this offer is ${formatCurrency(promotion.minimumSubtotalCents)}.`);
  }
  if (
    promotion.eligibleProductIds.length > 0 &&
    !items.some((item) => promotion.eligibleProductIds.includes(item.product.id))
  ) {
    throw new Error('This product promotion does not apply to the selected products.');
  }
  return promotion;
}

function calculateProductDiscount(promotion, merchandiseSubtotalCents) {
  if (!promotion) return 0;
  const raw =
    promotion.discountType === 'percentage'
      ? Math.round((merchandiseSubtotalCents * promotion.discountValue) / 100)
      : promotion.discountType === 'fixed_amount'
        ? promotion.discountValue
        : 0;
  const capped = promotion.maximumDiscountCents === null ? raw : Math.min(raw, promotion.maximumDiscountCents);
  return Math.min(capped, merchandiseSubtotalCents);
}

function allocateDiscount(items, discountCents) {
  const subtotal = items.reduce((sum, item) => sum + item.lineSubtotalCents, 0);
  let remaining = discountCents;
  return items.map((item, index) => {
    const allocation =
      index === items.length - 1
        ? remaining
        : Math.min(remaining, Math.round((discountCents * item.lineSubtotalCents) / Math.max(1, subtotal)));
    remaining -= allocation;
    return { ...item, discountCents: allocation, lineNetCents: item.lineSubtotalCents - allocation };
  });
}

export function getCommerceCatalogue(customerId = 'preview_client') {
  const recommendationMap = new Map(recommendations.filter((record) => record.customerId === customerId && record.active).map((record) => [record.variantId, record]));
  return variants.map((variant) => {
    const product = getProduct(variant.productId);
    const listing = getSupplierListing(variant.id);
    const supplier = listing ? getSupplier(listing.supplierId) : null;
    const recommendation = recommendationMap.get(variant.id) || null;
    let purchasable = true;
    let blockedReason = '';
    try {
      validateCanadianSale(product, variant, supplier, listing);
    } catch (error) {
      purchasable = false;
      blockedReason = error instanceof Error ? error.message : 'This product is not purchasable.';
    }

    return {
      product,
      variant,
      supplierListing: listing || null,
      recommendation,
      purchasable,
      blockedReason,
    };
  });
}

export function calculateCommerceCart(input) {
  const customerId = input.customerId || 'preview_client';
  const province = normalizeProvince(input.shippingAddress?.province || 'ON');
  const postalCode = normalizePostalCode(input.shippingAddress?.postalCode || 'M5V2T6');
  const currency = 'cad';
  const cartItems = input.items || [];
  if (!Array.isArray(cartItems) || cartItems.length === 0) throw new Error('Add at least one product to your cart.');

  const loadedItems = cartItems.map((cartItem) => {
    const variant = getVariant(cartItem.variantId);
    const product = variant ? getProduct(variant.productId) : null;
    const listing = variant ? getSupplierListing(variant.id) : null;
    const supplier = listing ? getSupplier(listing.supplierId) : null;
    validateCanadianSale(product, variant, supplier, listing);
    const quantity = validateQuantity(cartItem.quantity);
    const available = Math.min(variant.quantityOnHand - variant.quantityReserved, listing.availableInventory);
    if (quantity > available) throw new Error(`${product.productName} has only ${available} available.`);
    const recommendation =
      cartItem.recommendationId
        ? recommendations.find((record) => record.id === cartItem.recommendationId && record.variantId === variant.id && record.customerId === customerId)
        : recommendations.find((record) => record.variantId === variant.id && record.customerId === customerId && record.active);
    const professional = recommendation ? professionals.find((record) => record.id === recommendation.professionalId) : null;

    return {
      variant,
      product,
      supplierListing: listing,
      supplier,
      quantity,
      unitPriceCents: variant.priceCents,
      lineSubtotalCents: variant.priceCents * quantity,
      recommendation: recommendation || null,
      professional: professional || null,
      commissionRateBps: recommendation?.commissionRateBps || 0,
      commissionRuleVersion: recommendation?.commissionRuleVersion || '',
    };
  });

  const merchandiseSubtotalCents = loadedItems.reduce((sum, item) => sum + item.lineSubtotalCents, 0);
  const promotion = findProductPromotion(input.promoCode, merchandiseSubtotalCents, loadedItems);
  const productDiscountCents = calculateProductDiscount(promotion, merchandiseSubtotalCents);
  const allocatedItems = allocateDiscount(loadedItems, productDiscountCents);
  const merchandiseNetCents = merchandiseSubtotalCents - productDiscountCents;
  const shipping = calculateShipping(allocatedItems, province, postalCode, merchandiseSubtotalCents);
  const taxBps = provinceTaxBps[province];
  if (!taxBps) throw new Error('Frizi commerce currently supports Canadian provinces and territories only.');
  const taxableBasisCents = merchandiseNetCents + shipping.shippingCents;
  const taxCents = Math.round((taxableBasisCents * taxBps) / 10000);
  const totalCents = merchandiseNetCents + shipping.shippingCents + taxCents;

  const items = allocatedItems.map((item) => {
    const commissionBaseCents = item.lineNetCents;
    const commissionCents = Math.round((commissionBaseCents * item.commissionRateBps) / 10000);
    return {
      productId: item.product.id,
      variantId: item.variant.id,
      productName: item.product.productName,
      brandName: item.product.brandName,
      variantName: item.variant.variantName,
      sku: item.variant.sku,
      primaryImage: item.product.primaryImage,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineSubtotalCents: item.lineSubtotalCents,
      discountCents: item.discountCents,
      lineNetCents: item.lineNetCents,
      returnPolicyId: item.variant.returnPolicyId,
      supplierId: item.supplier.id,
      supplierListingId: item.supplierListing.id,
      inventoryMode: item.variant.inventoryMode,
      recommendationId: item.recommendation?.id || '',
      professionalId: item.recommendation?.professionalId || '',
      professionalName: item.professional?.name || '',
      attributionStatus: item.recommendation ? 'active' : 'none',
      commissionBaseCents,
      commissionRateBps: item.commissionRateBps,
      commissionCents,
      commissionRuleVersion: item.commissionRuleVersion,
      complianceState: item.product.complianceState,
    };
  });

  const snapshot = {
    customerId,
    items,
    merchandiseSubtotalCents,
    productDiscountCents,
    merchandiseNetCents,
    shipping,
    taxBps,
    taxCents,
    totalCents,
    currency,
    promotion: promotion
      ? {
          id: promotion.id,
          name: promotion.name,
          code: promotion.code,
          scope: promotion.scope,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
        }
      : null,
    sellerIdentity: 'Frizi Commerce Canada',
    customerServiceContact: 'support@frizi.ca',
    policyVersion: 'commerce_policy_demo_2026_07',
    pricingVersion: commercePricingVersion,
    quoteExpiresAt: new Date(Date.now() + cartQuoteTtlMinutes * 60 * 1000).toISOString(),
    featureFlags: {
      commerceCheckoutEnabled,
      commerceLivePaymentsEnabled,
      commerceCanadaPostEnabled,
      commerceAutomatedFulfillmentEnabled,
      commerceProPayoutsEnabled,
    },
    complianceWarning:
      'Canadian cosmetic, consumer-law, privacy, tax, supplier, return, and shipping settings require qualified professional review before live launch.',
  };

  return {
    ...snapshot,
    idempotencyKey: hashSnapshot(snapshot),
  };
}

export function createCommerceLineItems(summary) {
  const lineItems = summary.items.map((item) => ({
    price_data: {
      currency: summary.currency,
      product_data: {
        name: `${item.brandName} ${item.productName} - ${item.variantName}`,
        description: item.professionalName ? `Recommended by ${item.professionalName}` : 'Frizi product order',
        images: item.primaryImage ? [item.primaryImage] : undefined,
      },
      unit_amount: item.lineNetCents,
    },
    quantity: 1,
  }));

  if (summary.shipping.shippingCents > 0) {
    lineItems.push({
      price_data: {
        currency: summary.currency,
        product_data: { name: summary.shipping.service },
        unit_amount: summary.shipping.shippingCents,
      },
      quantity: 1,
    });
  }

  if (summary.taxCents > 0) {
    lineItems.push({
      price_data: {
        currency: summary.currency,
        product_data: { name: 'Estimated Canadian sales tax' },
        unit_amount: summary.taxCents,
      },
      quantity: 1,
    });
  }

  return lineItems;
}

export function commerceMetadata(summary) {
  return {
    frizi_checkout_kind: 'product_purchase',
    customer_id: summary.customerId,
    order_snapshot_hash: summary.idempotencyKey,
    merchandise_subtotal: String(summary.merchandiseSubtotalCents),
    product_discount: String(summary.productDiscountCents),
    shipping_amount: String(summary.shipping.shippingCents),
    shipping_provider: summary.shipping.provider,
    tax_amount: String(summary.taxCents),
    amount_due: String(summary.totalCents),
    currency: summary.currency,
    promotion_id: summary.promotion?.id || '',
    pricing_version: summary.pricingVersion,
    policy_version: summary.policyVersion,
    commission_total: String(summary.items.reduce((sum, item) => sum + item.commissionCents, 0)),
  };
}
