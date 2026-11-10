# Gemini food conversation verification

Verified on 9 November 2026 (India time) in Chrome against the restarted local workspace, the real Google Gemini API, and the deployed fictional Wiggy and Tomato marketplace. The server used `@google/genai` 3.0.0 and the API returned `gemini-3.5-flash-lite`. [Google model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)

## What changed

Before this milestone, a server-side REST request could extract a Zod-validated patch and prefill manual filters. It had no automatic provider search, quote selection, or conversational result history. The workspace now keeps accumulated constraints and recent food requests for the open page. Gemini supplies a validated intent, action and patch through a single allowed function call. The backend resolves named locations against the marketplace city list, checks provider responses and quote totals, and writes the reply from those facts. The conversation can select an offer for review. The existing checkout still controls approval, payment simulation and booking.

## Live turns

| Turn | Structured constraints after the turn | Marketplace result |
| --- | --- | --- |
| Find chicken dum biryani below ₹450 in Hyderabad. | Chicken dum biryani, Hyderabad city centre, total `<45000` paise, effective radius 12 km, one portion | Both catalogs returned. Both providers supplied a quote. Neither quote met the constraints. |
| Actually only restaurants rated above 4. | Same dish, location, budget and defaults, with rating `>4.0` | Both catalogs returned. No eligible listing reached quoting. |
| Keep it within five kilometres. | Same dish, location, budget and strict rating, with explicit radius `5` km | Both catalogs returned. No eligible listing reached quoting. |
| Choose the cheapest eligible offer. | All constraints unchanged. Requested lowest total. | Both catalogs returned. No eligible offer to select. |

A separate follow-up explicitly removed the rating minimum and set Banjara Hills as the delivery location. With the same dish, strict ₹450 budget and 5 km radius, the backend selected Wiggy’s Chicken Dum Biryani from Mirchi Moon at **₹402.45**, including fees and tax. Chrome showed the existing quote-review controls for the selected offer.

## Provider request evidence

| Turn | Wiggy catalog request | Tomato catalog request |
| --- | --- | --- |
| 1 | `16740b38-d864-46c5-ba3c-e18b569e7d85` | `54e3dea6-be94-4bc8-a59d-5e9e651db0d2` |
| 2 | `88b2b7aa-ac14-48c9-a274-b8113b2b8232` | `7f841279-6f87-4dd9-97c7-1dba8ed92566` |
| 3 | `dbaf735e-ed63-431c-aac9-5db909c650b0` | `e927cc72-97ae-46ea-9616-2d46ed703533` |
| 4 | `3e08b117-5034-476e-b0d2-f25847b0eb97` | `4bc0a9cc-5065-41cb-a0b2-57975d969565` |

Turn 1 quote request IDs were `6045c2dc-63df-4f4b-b178-cce052bf6b5d` for Wiggy and `11adb9c4-44f8-4421-9ceb-929165548849` for Tomato. The workspace displays these provider response IDs for each conversation turn. [Marketplace contract](https://jugaad-food-marketplace.vercel.app/api/openapi)

Chrome exercised the send button and keyboard submission, all four constraint snapshots, the evidence disclosures, and the selected-offer handoff. The workspace fit at 375, 768, 1024 and 1440 px. No Gemini key appeared in the checked browser responses.

An incomplete provider comparison returns the verified results and withholds automatic selection. Comparison has a bounded quote window. Conversation memory is scoped to the open workspace, while checkout and receipts continue to use the existing transaction store.
