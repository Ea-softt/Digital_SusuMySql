
/*
 * DATABASE SETUP SCRIPT
 */

import mysql from 'mysql2/promise';

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'password', 
};

const DB_NAME = 'digital_susu_db';

async function setupDatabase() {
    let connection;
    try {
        console.log(`🔌 Connecting to MySQL as '${dbConfig.user}'...`);
        connection = await mysql.createConnection(dbConfig);

        console.log(`🔨 Creating Database '${DB_NAME}'...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME}`);
        await connection.query(`USE ${DB_NAME}`);

        console.log('👤 Creating Table: users');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                phone_number VARCHAR(20),
                role ENUM('MEMBER', 'ADMIN', 'SUPERUSER') DEFAULT 'MEMBER',
                avatar LONGTEXT,
                occupation VARCHAR(100),
                location VARCHAR(150),
                kyc_id VARCHAR(50),
                status ENUM('ACTIVE', 'PENDING', 'SUSPENDED', 'INVITED', 'NEW') DEFAULT 'NEW',
                verification_status ENUM('VERIFIED', 'PENDING', 'REJECTED', 'UNVERIFIED') DEFAULT 'UNVERIFIED',
                join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                reliability_score INT DEFAULT 100
            )
        `);

        console.log('🏰 Creating Table: savings_groups');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS savings_groups (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                contribution_amount DECIMAL(15, 2) NOT NULL,
                currency VARCHAR(10) DEFAULT 'GHS',
                frequency ENUM('Weekly', 'Monthly', 'Bi-Weekly') DEFAULT 'Monthly',
                total_pool DECIMAL(15, 2) DEFAULT 0.00,
                members_count INT DEFAULT 0,
                cycle_number INT DEFAULT 1,
                next_payout_date DATE,
                invite_code VARCHAR(20) UNIQUE,
                welcome_message TEXT,
                icon LONGTEXT
            )
        `);

        console.log('🔗 Creating Table: group_memberships');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS group_memberships (
                user_id VARCHAR(50),
                group_id VARCHAR(50),
                role ENUM('MEMBER', 'ADMIN') DEFAULT 'MEMBER',
                status ENUM('ACTIVE', 'PENDING', 'SUSPENDED', 'INVITED') DEFAULT 'PENDING',
                is_blocked BOOLEAN DEFAULT FALSE,
                is_deleted BOOLEAN DEFAULT FALSE,
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, group_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES savings_groups(id) ON DELETE CASCADE
            )
        `);

        console.log('💸 Creating Table: transactions');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id VARCHAR(50) PRIMARY KEY,
                user_id VARCHAR(50),
                group_id VARCHAR(50) NULL,
                type ENUM('CONTRIBUTION', 'PAYOUT', 'WITHDRAWAL', 'DEPOSIT', 'FEE') NOT NULL,
                amount DECIMAL(15, 2) NOT NULL,
                status ENUM('COMPLETED', 'PENDING', 'FAILED') DEFAULT 'PENDING',
                date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('💬 Creating Table: group_messages');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS group_messages (
                id VARCHAR(50) PRIMARY KEY,
                group_id VARCHAR(50),
                sender_id VARCHAR(50),
                text TEXT,
                type ENUM('text', 'system') DEFAULT 'text',
                timestamp BIGINT,
                FOREIGN KEY (group_id) REFERENCES savings_groups(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ Database setup complete!');

    } catch (error) {
        console.error('❌ ERROR DURING SETUP:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

setupDatabase();
