# Moonskai Business Organizer v4

A camera-first, offline-first PWA for mobile resellers who buy inventory from online auctions, in-person auctions, flea markets, garage sales, Marketplace, Craigslist, private sellers, and other sources.

## v4 product direction

The item is the central living business record.

Primary workflow:

1. Capture item with camera
2. Catalog it immediately
3. Record source and real acquisition cost
4. Record condition and work needed
5. Add more photos/details later
6. Track repairs/notes/expenses
7. Price it
8. Update the same record when sold
9. Preserve the complete history

## Major v4 additions

- Camera is directly accessible from the Home screen
- Floating + button opens a global Quick Action sheet
- Live camera using `getUserMedia()` when served securely
- Automatic fallback to the phone camera file-capture flow
- Photo capture immediately opens Catalog This Item
- Existing photos can also start a new catalog record
- Save Draft / Finish Cataloging workflow
- Needs Attention dashboard:
  - Finish Cataloging
  - Needs Work
  - Needs Pricing
  - Needs Photos
- Full editable inventory lifecycle
- Multiple photos per item
- Source types:
  - Online Auction
  - In-Person Auction
  - Flea Market / Swap Meet
  - Garage / Yard Sale
  - Estate Sale
  - Facebook Marketplace
  - Craigslist / Classified
  - Private Seller
  - Trade
  - Other
- Online auction platforms including ShopGoodwill
- Listing URL/title/lot/end time
- Shipping/acquisition status
- Winning bid/purchase price
- Buyer premium
- Sales tax
- Shipping
- Handling
- Other acquisition costs
- Automatic total landed cost
- Work-needed and estimated repair-cost fields
- Sale event relationship
- Buyer/sale notes
- Online auction watch list
- Current bid / max bid / expected resale
- Winning auction lot can become an editable inventory draft
- Calendar, events, expenses, mileage, sales, CSV exports, JSON backup/restore remain included
- Full backups include photos

## Offline/PWA behavior

Core app/data works locally with IndexedDB. PWA installation and live `getUserMedia()` camera require HTTP/HTTPS as required by browsers. On direct-file testing, the app falls back to the phone/browser image capture input.

Database: `moonskai-business-organizer`
Schema version: 1
