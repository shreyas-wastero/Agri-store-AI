-- ============================================================
--  FARMER STORAGE ALLOCATION SYSTEM — MySQL Database Schema
--  Database: farmer_storage_db
-- ============================================================

CREATE DATABASE IF NOT EXISTS farmer_storage_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE farmer_storage_db;

-- ============================================================
-- 1. USERS (Farmers)
-- ============================================================
CREATE TABLE users (
  user_id        INT            PRIMARY KEY AUTO_INCREMENT,
  full_name      VARCHAR(100)   NOT NULL,
  phone_number   VARCHAR(15)    NOT NULL UNIQUE,
  email          VARCHAR(150)   UNIQUE,
  password_hash  VARCHAR(255)   NOT NULL,
  profile_picture VARCHAR(300),
  aadhaar_number VARCHAR(12)    UNIQUE,          -- Indian national ID
  preferred_lang ENUM('en','hi','ta','te','kn','mr') DEFAULT 'en',
  is_active      BOOLEAN        DEFAULT TRUE,
  created_at     TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. USER LOCATIONS  (farm address + GPS)
-- ============================================================
CREATE TABLE user_locations (
  location_id    INT            PRIMARY KEY AUTO_INCREMENT,
  user_id        INT            NOT NULL,
  label          VARCHAR(80),                    -- e.g. "Main Farm", "Second Plot"
  latitude       DECIMAL(10,8)  NOT NULL,
  longitude      DECIMAL(11,8)  NOT NULL,
  address_line1  VARCHAR(255),
  village        VARCHAR(100),
  taluk          VARCHAR(100),
  district       VARCHAR(100),
  state          VARCHAR(100),
  pincode        VARCHAR(10),
  location_type  ENUM('farm','home','other')     DEFAULT 'farm',
  is_primary     BOOLEAN        DEFAULT FALSE,
  created_at     TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_user_loc (user_id),
  INDEX idx_coords   (latitude, longitude)
);

-- ============================================================
-- 3. WAREHOUSE OWNERS
-- ============================================================
CREATE TABLE warehouse_owners (
  owner_id       INT            PRIMARY KEY AUTO_INCREMENT,
  full_name      VARCHAR(100)   NOT NULL,
  phone_number   VARCHAR(15)    NOT NULL UNIQUE,
  email          VARCHAR(150)   UNIQUE,
  password_hash  VARCHAR(255)   NOT NULL,
  gstin          VARCHAR(15)    UNIQUE,          -- GST number
  is_verified    BOOLEAN        DEFAULT FALSE,
  is_active      BOOLEAN        DEFAULT TRUE,
  created_at     TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. WAREHOUSES
-- ============================================================
CREATE TABLE warehouses (
  warehouse_id          INT            PRIMARY KEY AUTO_INCREMENT,
  owner_id              INT            NOT NULL,
  warehouse_name        VARCHAR(150)   NOT NULL,
  registration_number   VARCHAR(60)    UNIQUE,
  latitude              DECIMAL(10,8)  NOT NULL,
  longitude             DECIMAL(11,8)  NOT NULL,
  address_line1         VARCHAR(255),
  village               VARCHAR(100),
  district              VARCHAR(100),
  state                 VARCHAR(100),
  pincode               VARCHAR(10),
  total_capacity_tons   DECIMAL(10,2)  NOT NULL,      -- metric tons
  available_capacity_tons DECIMAL(10,2),
  price_per_ton_per_day DECIMAL(10,2)  NOT NULL,
  has_cold_storage      BOOLEAN        DEFAULT FALSE,
  has_fumigation        BOOLEAN        DEFAULT FALSE,
  has_pest_control      BOOLEAN        DEFAULT FALSE,
  has_cctv              BOOLEAN        DEFAULT FALSE,
  has_loading_dock      BOOLEAN        DEFAULT FALSE,
  images                JSON,                         -- array of image URLs
  rating                DECIMAL(3,2)   DEFAULT 0.00,
  total_reviews         INT            DEFAULT 0,
  is_active             BOOLEAN        DEFAULT TRUE,
  created_at            TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES warehouse_owners(owner_id),
  INDEX idx_location    (latitude, longitude),
  INDEX idx_available   (available_capacity_tons, is_active)
);

-- ============================================================
-- 5. CROP TYPES  (reference / master table)
-- ============================================================
CREATE TABLE crop_types (
  crop_id                  INT          PRIMARY KEY AUTO_INCREMENT,
  crop_name                VARCHAR(100) NOT NULL,
  local_name               VARCHAR(100),          -- regional/local name
  category                 VARCHAR(80),           -- grain, pulse, vegetable, fruit …
  requires_cold_storage    BOOLEAN      DEFAULT FALSE,
  ideal_temp_min_celsius   DECIMAL(5,2),
  ideal_temp_max_celsius   DECIMAL(5,2),
  max_storage_days         INT,
  storage_notes            TEXT
);

-- ============================================================
-- 6. BOOKINGS  (core transactional table)
-- ============================================================
CREATE TABLE bookings (
  booking_id          INT            PRIMARY KEY AUTO_INCREMENT,
  booking_reference   VARCHAR(20)    NOT NULL UNIQUE,   -- e.g. FSA-20240518-0001
  user_id             INT            NOT NULL,
  warehouse_id        INT            NOT NULL,
  crop_id             INT,
  crop_name_custom    VARCHAR(100),                     -- if crop not in master list
  quantity_tons       DECIMAL(10,2)  NOT NULL,
  storage_start_date  DATE           NOT NULL,
  storage_end_date    DATE           NOT NULL,           -- planned end
  actual_end_date     DATE,                              -- real check-out date
  total_price         DECIMAL(12,2),
  status              ENUM(
                        'pending',
                        'confirmed',
                        'active',
                        'completed',
                        'cancelled',
                        'expired'
                      )              DEFAULT 'pending',
  payment_status      ENUM('unpaid','paid','partially_paid','refunded') DEFAULT 'unpaid',
  cancellation_reason TEXT,
  special_instructions TEXT,
  -- TTL fields
  booking_expires_at  TIMESTAMP,      -- farmer must confirm by this time
  storage_expires_at  TIMESTAMP       AS (TIMESTAMP(storage_end_date, '23:59:59')) STORED,
  reminder_sent_at    TIMESTAMP,      -- when expiry reminder was last sent
  created_at          TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)       REFERENCES users(user_id),
  FOREIGN KEY (warehouse_id)  REFERENCES warehouses(warehouse_id),
  FOREIGN KEY (crop_id)       REFERENCES crop_types(crop_id),
  INDEX idx_user_bookings   (user_id, status),
  INDEX idx_warehouse_bk    (warehouse_id, status),
  INDEX idx_expiry          (storage_expires_at, status),
  INDEX idx_booking_expires (booking_expires_at, status)
);

-- ============================================================
-- 7. BOOKING HISTORY  (full audit trail / status log)
-- ============================================================
CREATE TABLE booking_history (
  history_id        INT           PRIMARY KEY AUTO_INCREMENT,
  booking_id        INT           NOT NULL,
  user_id           INT           NOT NULL,
  previous_status   ENUM('pending','confirmed','active','completed','cancelled','expired'),
  new_status        ENUM('pending','confirmed','active','completed','cancelled','expired'),
  changed_by_role   ENUM('farmer','owner','system')  DEFAULT 'system',
  notes             TEXT,
  changed_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  FOREIGN KEY (user_id)    REFERENCES users(user_id),
  INDEX idx_bk_history (booking_id, changed_at)
);

-- ============================================================
-- 8. PAYMENTS
-- ============================================================
CREATE TABLE payments (
  payment_id      INT           PRIMARY KEY AUTO_INCREMENT,
  booking_id      INT           NOT NULL,
  user_id         INT           NOT NULL,
  amount          DECIMAL(12,2) NOT NULL,
  currency        VARCHAR(3)    DEFAULT 'INR',
  payment_method  ENUM('upi','card','net_banking','cash','wallet') DEFAULT 'upi',
  payment_status  ENUM('pending','success','failed','refunded')   DEFAULT 'pending',
  transaction_id  VARCHAR(120)  UNIQUE,
  gateway_ref     VARCHAR(120),
  paid_at         TIMESTAMP,
  refunded_at     TIMESTAMP,
  refund_amount   DECIMAL(12,2),
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  FOREIGN KEY (user_id)    REFERENCES users(user_id),
  INDEX idx_booking_payment (booking_id),
  INDEX idx_user_payment    (user_id, paid_at)
);

-- ============================================================
-- 9. STORAGE EXPIRY ALERTS  (scheduled notification log)
-- ============================================================
CREATE TABLE storage_expiry_alerts (
  alert_id        INT           PRIMARY KEY AUTO_INCREMENT,
  booking_id      INT           NOT NULL,
  user_id         INT           NOT NULL,
  alert_type      ENUM(
                    '7_days_before',
                    '3_days_before',
                    '1_day_before',
                    'on_expiry',
                    'overdue'
                  )             NOT NULL,
  expires_at      TIMESTAMP     NOT NULL,   -- the booking's storage_end_date as TS
  sent_via        ENUM('sms','email','push','all') DEFAULT 'sms',
  is_sent         BOOLEAN       DEFAULT FALSE,
  sent_at         TIMESTAMP,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  FOREIGN KEY (user_id)    REFERENCES users(user_id),
  INDEX idx_pending_alerts (is_sent, expires_at)
);

-- ============================================================
-- 10. NOTIFICATIONS  (in-app notification feed)
-- ============================================================
CREATE TABLE notifications (
  notification_id INT           PRIMARY KEY AUTO_INCREMENT,
  user_id         INT           NOT NULL,
  booking_id      INT,
  title           VARCHAR(255)  NOT NULL,
  body            TEXT,
  type            ENUM(
                    'booking_confirmed',
                    'booking_cancelled',
                    'storage_expiry',
                    'payment_success',
                    'payment_failed',
                    'reminder',
                    'system'
                  )             NOT NULL,
  is_read         BOOLEAN       DEFAULT FALSE,
  deep_link       VARCHAR(300),  -- e.g. /bookings/42
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(user_id),
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  INDEX idx_user_notif (user_id, is_read, created_at)
);

-- ============================================================
-- 11. REVIEWS
-- ============================================================
CREATE TABLE reviews (
  review_id       INT           PRIMARY KEY AUTO_INCREMENT,
  booking_id      INT           NOT NULL UNIQUE,   -- one review per booking
  user_id         INT           NOT NULL,
  warehouse_id    INT           NOT NULL,
  rating          TINYINT       NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text     TEXT,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id)    REFERENCES bookings(booking_id),
  FOREIGN KEY (user_id)       REFERENCES users(user_id),
  FOREIGN KEY (warehouse_id)  REFERENCES warehouses(warehouse_id),
  INDEX idx_warehouse_reviews (warehouse_id, rating)
);

-- ============================================================
-- 12. USER SEARCH HISTORY  (nearby search log)
-- ============================================================
CREATE TABLE user_search_history (
  search_id         INT           PRIMARY KEY AUTO_INCREMENT,
  user_id           INT           NOT NULL,
  searched_lat      DECIMAL(10,8) NOT NULL,
  searched_lng      DECIMAL(11,8) NOT NULL,
  radius_km         DECIMAL(6,2)  DEFAULT 50,
  crop_id           INT,
  quantity_tons     DECIMAL(10,2),
  required_from     DATE,
  required_to       DATE,
  results_count     INT           DEFAULT 0,
  searched_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)  REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (crop_id)  REFERENCES crop_types(crop_id),
  INDEX idx_user_searches (user_id, searched_at)
);

-- ============================================================
-- STORED EVENT: Auto-expire bookings past booking_expires_at
-- ============================================================
SET GLOBAL event_scheduler = ON;

CREATE EVENT IF NOT EXISTS evt_expire_unconfirmed_bookings
  ON SCHEDULE EVERY 15 MINUTE
  DO
    UPDATE bookings
    SET    status     = 'expired',
           updated_at = CURRENT_TIMESTAMP
    WHERE  status              = 'pending'
      AND  booking_expires_at IS NOT NULL
      AND  booking_expires_at  < CURRENT_TIMESTAMP;

-- ============================================================
-- STORED EVENT: Auto-complete bookings past storage_end_date
-- ============================================================
CREATE EVENT IF NOT EXISTS evt_complete_active_bookings
  ON SCHEDULE EVERY 1 HOUR
  DO
    UPDATE bookings
    SET    status     = 'completed',
           updated_at = CURRENT_TIMESTAMP
    WHERE  status              = 'active'
      AND  storage_end_date   < CURDATE();

-- ============================================================
-- VIEW: Active bookings with farmer & warehouse summary
-- ============================================================
CREATE OR REPLACE VIEW vw_active_bookings AS
  SELECT
    b.booking_id,
    b.booking_reference,
    u.full_name        AS farmer_name,
    u.phone_number     AS farmer_phone,
    w.warehouse_name,
    w.district,
    w.state,
    b.crop_name_custom AS crop,
    b.quantity_tons,
    b.storage_start_date,
    b.storage_end_date,
    b.storage_expires_at,
    DATEDIFF(b.storage_end_date, CURDATE()) AS days_remaining,
    b.total_price,
    b.payment_status
  FROM  bookings     b
  JOIN  users        u ON b.user_id       = u.user_id
  JOIN  warehouses   w ON b.warehouse_id  = w.warehouse_id
  WHERE b.status = 'active';

-- ============================================================
-- VIEW: Warehouse capacity snapshot
-- ============================================================
CREATE OR REPLACE VIEW vw_warehouse_capacity AS
  SELECT
    w.warehouse_id,
    w.warehouse_name,
    w.total_capacity_tons,
    w.available_capacity_tons,
    ROUND(
      (w.total_capacity_tons - w.available_capacity_tons)
        / w.total_capacity_tons * 100, 1
    )                     AS occupancy_pct,
    w.price_per_ton_per_day,
    w.rating,
    w.district,
    w.state
  FROM warehouses w
  WHERE w.is_active = TRUE;

-- ============================================================
-- SEED: Sample Crop Types
-- ============================================================
INSERT INTO crop_types (crop_name, local_name, category, requires_cold_storage, max_storage_days) VALUES
  ('Rice',          'Chawal',    'Grain',     FALSE,  365),
  ('Wheat',         'Gehun',     'Grain',     FALSE,  365),
  ('Maize',         'Makka',     'Grain',     FALSE,  180),
  ('Chickpea',      'Chana',     'Pulse',     FALSE,  365),
  ('Lentil',        'Masoor',    'Pulse',     FALSE,  365),
  ('Potato',        'Aloo',      'Vegetable', TRUE,   120),
  ('Onion',         'Pyaz',      'Vegetable', FALSE,   90),
  ('Tomato',        'Tamatar',   'Vegetable', TRUE,    30),
  ('Sugarcane',     'Ganna',     'Cash Crop', FALSE,   30),
  ('Cotton',        'Kapas',     'Cash Crop', FALSE,  180),
  ('Groundnut',     'Moongfali', 'Oilseed',  FALSE,  180),
  ('Mustard',       'Sarson',    'Oilseed',  FALSE,  180),
  ('Banana',        'Kela',      'Fruit',    TRUE,    14),
  ('Mango',         'Aam',       'Fruit',    TRUE,    30);
