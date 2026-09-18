import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [journey, customerContext, providerContext, providerDetail, customerDetail] = await Promise.all([
  readFile(new URL('components/booking/SmartServiceJourneyGuide.tsx', root), 'utf8'),
  readFile(new URL('components/booking/CustomerRequirementBookingContext.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderRequirementOccurrenceContext.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderBookingDetail.tsx', root), 'utf8'),
  readFile(new URL('components/booking/CustomerBookingDetail.tsx', root), 'utf8'),
]);

test('Smart Service Journey V2 presents one shared progress model', () => {
  assert.ok(journey.includes("['Requested', 'Confirmed', 'Service', 'Completion']"));
  assert.ok(journey.includes('smart-service-journey-steps'));
  assert.ok(journey.includes('Waiting for provider confirmation'));
  assert.ok(journey.includes('Service is now in progress'));
  assert.ok(journey.includes('Service journey complete'));
});

test('Smart Service Journey V2 owns the positive next action for each role', () => {
  assert.ok(journey.includes("providerAction('accept')"));
  assert.ok(journey.includes("providerAction('complete')"));
  assert.ok(journey.includes("action: 'confirm_completion'"));
  assert.ok(journey.includes('Confirm service'));
  assert.ok(journey.includes('Mark service complete'));
  assert.ok(journey.includes('Confirm service completed'));
  assert.ok(journey.includes('Leave a review'));
});

test('Requirement booking contexts use the unified journey instead of split execution and completion guides', () => {
  assert.ok(customerContext.includes('SmartServiceJourneyGuide'));
  assert.ok(providerContext.includes('SmartServiceJourneyGuide'));
  assert.ok(!customerContext.includes('BookingServiceExecutionGuide'));
  assert.ok(!customerContext.includes('RequirementCompletionGuide'));
  assert.ok(!providerContext.includes('BookingServiceExecutionGuide'));
  assert.ok(!providerContext.includes('RequirementCompletionGuide'));
});

test('Provider requirement bookings suppress the duplicate legacy next-action card', () => {
  assert.ok(providerContext.includes('onResolved?: (linked: boolean) => void'));
  assert.ok(providerDetail.includes('onResolved={setRequirementLinked}'));
  assert.ok(providerDetail.includes('requirementLinked === false ? <Card'));
});

test('Customer completion can hand off directly to the review section', () => {
  assert.ok(journey.includes('href="#customer-review"'));
  assert.ok(customerDetail.includes('id="customer-review"'));
});

test('Smart Service Journey V2 does not introduce payment or finance actions', () => {
  assert.ok(!journey.includes('/api/pay'));
  assert.ok(!journey.includes('Cashfree'));
  assert.ok(!journey.includes('payment_intent'));
});
