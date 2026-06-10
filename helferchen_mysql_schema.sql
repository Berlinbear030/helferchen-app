-- Helferchen MySQL 8 Schema
-- Import via phpMyAdmin oder:
--   mysql -h web214.dogado.net -P 3307 -u h770906_400162 -p h770906 < helferchen_mysql_schema.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL,
  `username` VARCHAR(255) NOT NULL,
  `password_hash` TEXT NOT NULL,
  `full_name` TEXT NOT NULL,
  `email` TEXT,
  `role` VARCHAR(50) NOT NULL DEFAULT 'employee',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `customers` (
  `id` CHAR(36) NOT NULL,
  `first_name` TEXT NOT NULL,
  `last_name` TEXT NOT NULL,
  `address` TEXT NOT NULL,
  `phone_number` TEXT NOT NULL,
  `notes` TEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `assignments` (
  `id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `assigned_user_id` CHAR(36),
  `title` TEXT NOT NULL,
  `description` TEXT,
  `scheduled_at` DATETIME NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
  FOREIGN KEY (`assigned_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `time_logs` (
  `id` CHAR(36) NOT NULL,
  `assignment_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME,
  `duration_minutes` INT,
  `blocks_count` INT,
  `total_price` DECIMAL(10,2),
  `is_signed` BOOLEAN DEFAULT FALSE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `signatures` (
  `id` CHAR(36) NOT NULL,
  `timelog_id` CHAR(36) NOT NULL,
  `image_data` LONGTEXT NOT NULL,
  `signer_name` TEXT NOT NULL,
  `signed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`timelog_id`) REFERENCES `time_logs`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `reports` (
  `id` CHAR(36) NOT NULL,
  `assignment_id` CHAR(36) NOT NULL,
  `timelog_id` CHAR(36) NOT NULL,
  `created_by_user_id` CHAR(36) NOT NULL,
  `notes` TEXT,
  `signature_id` CHAR(36),
  `pdf_generated` BOOLEAN DEFAULT FALSE,
  `email_sent` BOOLEAN DEFAULT FALSE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`),
  FOREIGN KEY (`timelog_id`) REFERENCES `time_logs`(`id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `booking_requests` (
  `id` CHAR(36) NOT NULL,
  `name` TEXT NOT NULL,
  `phone` TEXT NOT NULL,
  `email` TEXT NOT NULL DEFAULT '',
  `service_description` TEXT NOT NULL,
  `preferred_date` TEXT,
  `preferred_time` TEXT,
  `status` VARCHAR(50) NOT NULL DEFAULT 'open',
  `assigned_user_id` CHAR(36),
  `notes` TEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`assigned_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` CHAR(36) NOT NULL,
  `entity_type` TEXT NOT NULL,
  `entity_id` TEXT NOT NULL,
  `action` TEXT NOT NULL,
  `actor_user_id` TEXT NOT NULL,
  `details` TEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
