# 7Layers Bakery & Snacks — V5

## What V5 includes
- Premium responsive customer website
- Full 7Layers menu with prices
- Cart and quantity controls
- Customer name, phone, email, pickup/delivery, address and notes
- Orders saved to the backend
- WhatsApp order handoff
- Automatic bakery email notification when SMTP is configured
- Admin dashboard at `/admin`
- Daily sales and monthly sales/revenue
- Order status management
- Local JSON database for a simple first deployment

## Run on a computer
1. Install Node.js (LTS).
2. Open a terminal in this folder.
3. Run: `npm install`
4. Copy `.env.example` to `.env`.
5. Change ADMIN_USER and ADMIN_PASS.
6. Run: `npm start`
7. Open: http://localhost:3000
8. Admin: http://localhost:3000/admin

## Email setup
Fill SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and BAKERY_EMAIL in `.env`.
Without SMTP, WhatsApp ordering still works and orders are stored in the dashboard.

## Important before public launch
- Change the admin password.
- Confirm the bakery WhatsApp number.
- Confirm the exact business address and opening hours.
- Configure SMTP email.
- For a larger business, move order storage from JSON to a hosted database (PostgreSQL/Supabase).


## V5 Dashboard visual direction
Inspired by the reference dashboard supplied by the client:
- Espresso Brown `#2F1B14` — main brand/navigation
- Bakery Gold `#C79A3B` — primary highlights and sales
- Warm Cream `#F7F1DF` — dashboard background
- Off-white `#FFFDF7` — cards
- Terracotta `#A6534B` — secondary sales accent
- Sage `#647B66` — positive/status accent
- Blue `#58748B` — category/analytics accent

The dashboard now includes daily sales trend, category mix, top products, recent transactions, peak sales hours, range selection, and order-status management.


## V7 — Production deployment preparation

This version is prepared for a real hosted deployment. Orders are stored under `DATA_DIR`, so a hosting provider can mount persistent storage without changing the menu assets. It also includes a `/health` endpoint and a Render Blueprint.

### Recommended deployment
1. Create a GitHub repository and upload this project.
2. In Render, create a Web Service from the repository (or use the included `render.yaml`).
3. Set `ADMIN_USER` and a strong `ADMIN_PASS`.
4. Configure the SMTP variables if the bakery wants automatic email notifications.
5. The Render Blueprint mounts persistent storage at `/var/data`, so order data survives deploys/restarts.
6. After deployment, open `/` for customers and `/admin` for the owner.
7. Add the bakery's custom domain in Render and update DNS.

### Important
Do not commit `.env` or real SMTP/admin passwords to GitHub.

### Local run
`npm install` then `npm start` and open `http://localhost:3000`.
