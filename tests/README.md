# Black Stars CRM — Test Suite

These tests load the REAL app.js + pages.js (no copies, no mocks of the logic)
inside a Node sandbox with stubbed browser globals, seed a realistic data set
(tests/seed.js), and check the actual code.

## Requirements
Node.js installed. From the `blackstars-localhost` folder:

    node tests/logic-tests.js      # 85 business-logic assertions
    node tests/render-tests.js     # renders all 24 pages, catches markup errors

## What logic-tests.js covers (85 assertions)
Date/number helpers, phone matching, name & duplicate detection (incl. the
"family shares one phone" case that must NOT be flagged), member status
(active/expired/frozen), customer info incl. 2nd mobile, product stock after
sales, invoice ref numbering, coach commission via the real payroll function
(incl. Summer Camp earning no commission, and commission staying correct after
invoices are MERGED), pagination, formatters with bad input, the multi-select
sport filter, the attendance "attended" filter, second-mobile search, active
coach/member helpers, date deltas, and payroll with an advance.

## What render-tests.js covers
Calls every page builder so every template expression is evaluated. This is
what caught the bugs fixed in v4.81.1 (see main README).
