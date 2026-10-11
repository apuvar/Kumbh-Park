# KumbhPark – Smart Parking System for Kumbh Mela Nashik

KumbhPark is a simple Smart Parking System for visitors and parking providers. The existing KumbhPark visual design is retained while the application is organized into separate pages.

**Parking values are fictional demonstration values and are not official Kumbh Mela parking information.**

## Main Features
- Public home page and parking zone listing.
- Separate parking slot page.
- Customer registration/login.
- Customer dashboard.
- Parking booking and confirmation.
- My Bookings.
- Parking provider registration/login.
- Provider dashboard.
- Add/edit/delete provider parking zones.
- Provider slot status management.
- Provider bookings limited to the provider's own zones.
- PHP admin login and PHP/MySQL CRUD.
- Node.js + Express REST APIs.
- MySQL storage for customer, provider, zone, slot and booking data.

## Pages
```text
index.html
parking.html
login.html
register.html
customer-dashboard.html
slots.html
booking.html
confirmation.html
my-bookings.html
provider-dashboard.html
provider-zones.html
add-zone.html
edit-zone.html
manage-slots.html
provider-bookings.html
help.html
```

## Database
Tables:
- customers
- providers
- parking_zones
- parking_slots
- bookings

Relationships:
- Provider → Parking Zones
- Parking Zone → Parking Slots
- Customer → Bookings
- Booking → Parking Slot

## Run Node/Express
```bash
cd server
npm install
node server.js
```
Open `http://localhost:3000`.

Set database environment variables if needed:
```text
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=smart_parking
```

## MySQL
Import:
`database/smart_parking.sql`

## PHP
Use XAMPP and place the project in `htdocs`. Start Apache and MySQL.

Admin:
- Username: `admin`
- Password: `admin123`

## Demo Provider Account
After importing the SQL:
- Email: `provider@kumbhpark.com`
- Password: `provider123`

## Demo Customer Account
After importing the SQL:
- Email: `rahul@example.com`
- Password: `rahul123`

## Visitor Flow
Home → Parking → View Slots → Select Slot → Customer Login → Booking → Confirmation → My Bookings.

## Provider Flow
Provider Login → Dashboard → My Parking Zones → Add/Edit/Delete Zone → Manage Slots → Provider Bookings.

## Documentation
Implementation mapping and viva notes remain in `documentation/` for reference and are not linked from the public website.
