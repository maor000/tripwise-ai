# TripWise AI Scoring And Incident Handling

## What "בדיקת כדאיות" Means

The AI score should not mean "cheapest package". It should mean "best fit for this customer".

Recommended scoring inputs:

- Price fit: package price compared with the customer's budget.
- Flight comfort: departure time, arrival time, direct/connection, baggage, delay risk if available.
- Hotel fit: rating, location, room type, family/couple fit, recent reviews if licensed for use.
- Meal value: breakfast, half board, all inclusive, or no meals.
- Cancellation quality: supplier policy, emergency cancellation, insurance option, refund timeline.
- Supplier reliability: provider identity, policy clarity, last checked timestamp, booking URL.
- Customer preference fit: cheap, premium, comfortable, flexible, family, city, beach.

## Preference Modes

- Cheap: price has high weight, but the system should still penalize unclear cancellation terms or weak supplier reliability.
- Comfortable: flight hours, hotel location, room fit, and flexibility have higher weight.
- Premium: hotel quality, meal plan, supplier reliability, and cancellation clarity have higher weight.
- Flexible: cancellation policy, emergency refund eligibility, and replacement options have higher weight.

## Incident Handling Flow

1. Detect the issue from provider webhook, scheduled status check, customer message, or manual support update.
2. Classify the issue: flight canceled, hotel cannot host, destination restriction, supplier failure, payment/refund issue.
3. Check the original supplier terms and legal/customer rights.
4. Notify the customer with clear options, not promises:
   - refund request
   - replacement hotel
   - replacement flight
   - alternative destination/package
   - keep existing booking if still valid
5. Search alternatives within the same budget first, then close alternatives if the customer approves.
6. Store an audit log: source, timestamp, options shown, customer choice, supplier response.

## Business Protection Rules

- Do not promise full refund unless the supplier, insurer, law, or written agreement supports it.
- Show service fees separately before checkout.
- If the TripWise service fee is non-refundable, state it clearly before checkout.
- Keep the package supplier as merchant of record unless TripWise is legally and operationally ready to sell the package directly.
- Every AI explanation should cite the package fields it used, such as cancellation policy, price, supplier, and last checked time.
