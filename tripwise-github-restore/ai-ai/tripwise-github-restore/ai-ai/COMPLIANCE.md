# TripWise AI Compliance Notes

This product is structured to avoid legal and commercial issues while it is being built.

## Data And Packages

- Do not scrape package data from HolidayFinder or any other website without written permission.
- Use only official APIs, affiliate programs, direct supplier feeds, or commercial agreements.
- Show only real provider prices returned by the connected backend.
- Do not cache or republish supplier content unless the provider agreement allows it.

## Commissions

- Affiliate or commission links should be disclosed clearly near booking actions.
- Store provider name, booking URL, commission source, and timestamp for each offer shown.
- Commission can vary per package, supplier, destination, date, and product type. Do not assume a fixed commission unless the provider agreement says so.
- Keep final payment and booking confirmation with the licensed provider unless the business is ready to operate as the merchant of record.

## Cancellations And Refunds

- Display the provider cancellation policy exactly as returned by the supplier.
- The AI can explain refund options, but it should not promise refunds unless the supplier policy supports it.
- If TripWise sells a paid VIP service, separate that service fee from the travel package price.
- Emergency or war-related cancellation should be shown only when supported by supplier policy, insurance policy, or a written commercial agreement.
- If the TripWise service fee or commission is non-refundable, show that clearly before checkout.
- In supplier disruption cases, present customer options as "subject to supplier approval and availability" unless TripWise is contractually responsible as merchant of record.
- Keep an audit trail for every recommendation, cancellation message, replacement offer, and customer choice.

## AI Recommendations

- AI scores should be explainable: price, flight times, hotel quality, meals, cancellation, location, and traveler fit.
- If a field is missing from a supplier response, mark it as unknown instead of guessing.
- Keep a log of the package data used to generate each recommendation.

## App Strategy

- The current build is a PWA: one codebase works as a website and installable app.
- Native iOS/Android apps can later reuse the same backend and API contract.
