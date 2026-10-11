CREATE DATABASE IF NOT EXISTS smart_parking;
USE smart_parking;

DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS parking_slots;
DROP TABLE IF EXISTS parking_zones;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS providers;
DROP TABLE IF EXISTS customers;

CREATE TABLE customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  mobile VARCHAR(15) NOT NULL,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE providers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  provider_name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  mobile VARCHAR(15) NOT NULL,
  password VARCHAR(255) NOT NULL,
  organization_name VARCHAR(150) NOT NULL
);

CREATE TABLE parking_zones (
  id INT PRIMARY KEY AUTO_INCREMENT,
  provider_id INT NOT NULL,
  zone_name VARCHAR(100) NOT NULL,
  location VARCHAR(150) NOT NULL,
  capacity INT NOT NULL,
  available_slots INT NOT NULL,
  rate DECIMAL(10,2) NOT NULL,
  FOREIGN KEY(provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE TABLE parking_slots (
  id INT PRIMARY KEY AUTO_INCREMENT,
  zone_id INT NOT NULL,
  slot_number VARCHAR(20) NOT NULL,
  status ENUM('available','occupied','reserved','maintenance') DEFAULT 'available',
  UNIQUE(zone_id,slot_number),
  FOREIGN KEY(zone_id) REFERENCES parking_zones(id) ON DELETE CASCADE
);

CREATE TABLE bookings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customer_id INT NOT NULL,
  zone_id INT NOT NULL,
  slot_id INT NULL,
  vehicle_number VARCHAR(30) NOT NULL,
  vehicle_type VARCHAR(30) NOT NULL,
  booking_date DATE NOT NULL,
  duration VARCHAR(30) NOT NULL,
  status VARCHAR(30) DEFAULT 'Confirmed',
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY(zone_id) REFERENCES parking_zones(id) ON DELETE CASCADE,
  FOREIGN KEY(slot_id) REFERENCES parking_slots(id) ON DELETE SET NULL
);

INSERT INTO providers(provider_name,email,mobile,password,organization_name)
VALUES('Kumbh Parking Services','provider@kumbhpark.com','9876543210','provider123','Kumbh Parking Services');

INSERT INTO customers(name,email,mobile,password)
VALUES('Rahul Patil','rahul@example.com','9876501234','rahul123');

INSERT INTO parking_zones(provider_id,zone_name,location,capacity,available_slots,rate) VALUES
(1,'Zone A – Ramkund','Near Ramkund Ghat',400,245,30),
(1,'Zone B – Panchavati','Panchavati Parking Ground',350,182,25),
(1,'Zone C – Tapovan','Tapovan Parking Area',250,67,30),
(1,'Zone D – Gangapur Road','Gangapur Road Demo Zone',300,150,25);

INSERT INTO parking_slots(zone_id,slot_number,status) VALUES
(1,'P01','available'),(1,'P02','occupied'),(1,'P03','available'),(1,'P04','reserved'),(1,'P05','available'),
(1,'P06','occupied'),(1,'P07','available'),(1,'P08','available'),(1,'P09','reserved'),(1,'P10','occupied'),
(2,'P01','available'),(2,'P02','occupied'),(2,'P03','available'),(2,'P04','reserved'),(2,'P05','available'),
(2,'P06','available'),(2,'P07','occupied'),(2,'P08','available'),(2,'P09','reserved'),(2,'P10','available'),
(3,'P01','occupied'),(3,'P02','available'),(3,'P03','reserved'),(3,'P04','available'),(3,'P05','occupied'),
(3,'P06','available'),(3,'P07','available'),(3,'P08','maintenance'),(3,'P09','available'),(3,'P10','occupied'),
(4,'P01','available'),(4,'P02','available'),(4,'P03','occupied'),(4,'P04','reserved'),(4,'P05','available'),
(4,'P06','available'),(4,'P07','occupied'),(4,'P08','available'),(4,'P09','reserved'),(4,'P10','available');
