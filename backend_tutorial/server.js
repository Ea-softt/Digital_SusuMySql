import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import https from 'https';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bodyParser from 'body-parser';

// 🛡️ PRODUCTION HARDENING: Required Env Verification
const requiredEnv = ['PAYSTACK_SECRET_KEY', 'PAYSTACK_PUBLIC_KEY', 'JWT_SECRET', 'DB_NAME'];
requiredEnv.forEach(key => {
    if (!process.env[key]) {
        console.error(`❌ CRITICAL: Missing required environment variable: ${key}`);
        process.exit(1);
    }
});

const app = express();
const PORT = process.env.PORT || 3001;

// 🛡️ PRODUCTION HARDENING: Security Headers
app.use(helmet());

// 🛡️ PRODUCTION HARDENING: Rate Limiting (Prevents Brute Force/DoS)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: { error: "Too many requests from this IP, please try again after 15 minutes" }
});

app.use('/api/', apiLimiter);

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
// Increased limit significantly for base64 ID document images
app.use(bodyParser.json({ limit: '20mb' }));

// Middleware to log all incoming requests for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware to verify JWT Token
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token." });
        req.user = user; // Add user info (like id and role) to the request object
        next();
    });
};

/**
 * Middleware to restrict access based on user role
 */
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Access denied. Insufficient permissions." });
        }
        next();
    };
};

/**
 * Helper to make Paystack API requests
 */
const paystackRequest = (path, method, data) => {
    return new Promise((resolve, reject) => {
        const params = JSON.stringify(data);
        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: path,
            method: method,
            headers: {
                Authorization: `Bearer ${SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, res => {
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(responseData));
                } catch (e) {
                    reject(new Error('Invalid JSON response from Paystack'));
                }
            });
        }).on('error', error => {
            reject(error);
        });

        if (data) req.write(params);
        req.end();
    });
};

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '', 
    database: process.env.DB_NAME || 'digital_susu_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

async function initializeDatabase() {
    console.log('🛠️ Checking database schema and applying migrations...');
    const connection = await pool.getConnection();
    
    try {
        // 1. Ensure Tables Exist
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                phone_number VARCHAR(20),
                role ENUM('MEMBER', 'ADMIN', 'SUPERUSER') DEFAULT 'MEMBER',
                avatar LONGTEXT,
                kyc_document_image LONGTEXT,
                occupation VARCHAR(100),
                location VARCHAR(150),
                kyc_id VARCHAR(50),
                status ENUM('ACTIVE', 'PENDING', 'SUSPENDED', 'INVITED', 'NEW') DEFAULT 'NEW',
                verification_status ENUM('VERIFIED', 'PENDING', 'REJECTED', 'UNVERIFIED') DEFAULT 'UNVERIFIED',
                join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                reliability_score INT DEFAULT 100
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS payment_confirmations (
                reference VARCHAR(100) PRIMARY KEY,
                access_code VARCHAR(100),
                user_id VARCHAR(50),
                amount DECIMAL(15, 2) NOT NULL,
                currency VARCHAR(10) DEFAULT 'GHS',
                status ENUM('PENDING', 'COMPLETED', 'FAILED', 'REJECTED') DEFAULT 'PENDING',
                payment_type ENUM('DEPOSIT', 'CONTRIBUTION') DEFAULT 'DEPOSIT',
                metadata JSON,
                approved_by VARCHAR(50),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

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
                icon LONGTEXT,
                payout_schedule JSON
            )
        `);

        // Force column existence for KYC image
        console.log('🔄 Verifying column types for large data...');
        const [cols] = await connection.query(`SHOW COLUMNS FROM users LIKE 'kyc_document_image'`);
        if (cols.length === 0) {
            await connection.query(`ALTER TABLE users ADD COLUMN kyc_document_image LONGTEXT AFTER avatar`);
        }
        const [groupCols] = await connection.query(`SHOW COLUMNS FROM savings_groups LIKE 'payout_schedule'`);
        if (groupCols.length === 0) {
            await connection.query(`ALTER TABLE savings_groups ADD COLUMN payout_schedule JSON`);
        }
        await connection.query(`ALTER TABLE users MODIFY COLUMN avatar LONGTEXT`);
        await connection.query(`ALTER TABLE users MODIFY COLUMN kyc_document_image LONGTEXT`);
        await connection.query(`ALTER TABLE savings_groups MODIFY COLUMN icon LONGTEXT`);

        // Update frequency enum to include new options (Yearly, Daily)
        await connection.query(`ALTER TABLE savings_groups MODIFY COLUMN frequency ENUM('Weekly', 'Monthly', 'Bi-Weekly', 'Yearly', 'Daily') DEFAULT 'Monthly'`);

        // Add cycle start and end dates for progress tracking
        const [cycleCols] = await connection.query(`SHOW COLUMNS FROM savings_groups LIKE 'cycle_start_date'`);
        if (cycleCols.length === 0) {
            await connection.query(`ALTER TABLE savings_groups ADD COLUMN cycle_start_date DATETIME, ADD COLUMN cycle_end_date DATETIME`);
        }

        const [spaCols] = await connection.query(`SHOW COLUMNS FROM savings_groups LIKE 'scheduled_payout_amount'`);
        if (spaCols.length === 0) {
            await connection.query(`ALTER TABLE savings_groups ADD COLUMN scheduled_payout_amount DECIMAL(15, 2) DEFAULT 0.00`);
        }

        // Add status column to savings_groups for approval workflow
        const [sgStatus] = await connection.query(`SHOW COLUMNS FROM savings_groups LIKE 'status'`);
        if (sgStatus.length === 0) {
            await connection.query(`ALTER TABLE savings_groups ADD COLUMN status ENUM('ACTIVE', 'PENDING_VERIFICATION', 'REJECTED', 'SUSPENDED', 'DELETED') DEFAULT 'ACTIVE'`);
        } else {
            await connection.query(`ALTER TABLE savings_groups MODIFY COLUMN status ENUM('ACTIVE', 'PENDING_VERIFICATION', 'REJECTED', 'SUSPENDED', 'DELETED') DEFAULT 'ACTIVE'`);
        }

        // Add approved_by column to savings_groups
        const [sgApprovedBy] = await connection.query(`SHOW COLUMNS FROM savings_groups LIKE 'approved_by'`);
        if (sgApprovedBy.length === 0) {
            await connection.query(`ALTER TABLE savings_groups ADD COLUMN approved_by VARCHAR(50)`);
        }

        // Add call_active column to savings_groups
        const [sgCallActive] = await connection.query(`SHOW COLUMNS FROM savings_groups LIKE 'call_active'`);
        if (sgCallActive.length === 0) {
            await connection.query(`ALTER TABLE savings_groups ADD COLUMN call_active BOOLEAN DEFAULT 0`);
        }

        await connection.query(`
            CREATE TABLE IF NOT EXISTS group_memberships (
                user_id VARCHAR(50),
                group_id VARCHAR(50),
                role ENUM('MEMBER', 'ADMIN') DEFAULT 'MEMBER',
                status ENUM('ACTIVE', 'PENDING', 'SUSPENDED', 'INVITED') DEFAULT 'PENDING',
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, group_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES savings_groups(id) ON DELETE CASCADE
            )
        `);

        // Ensure is_blocked and is_deleted columns exist in group_memberships
        const [gmBlocked] = await connection.query(`SHOW COLUMNS FROM group_memberships LIKE 'is_blocked'`);
        if (gmBlocked.length === 0) {
            await connection.query(`ALTER TABLE group_memberships ADD COLUMN is_blocked BOOLEAN DEFAULT 0`);
        }
        const [gmDeleted] = await connection.query(`SHOW COLUMNS FROM group_memberships LIKE 'is_deleted'`);
        if (gmDeleted.length === 0) {
            await connection.query(`ALTER TABLE group_memberships ADD COLUMN is_deleted BOOLEAN DEFAULT 0`);
        }

        // Add verifier_id and pending_status to group_memberships
        const [gmVerifier] = await connection.query(`SHOW COLUMNS FROM group_memberships LIKE 'verifier_id'`);
        if (gmVerifier.length === 0) {
            await connection.query(`ALTER TABLE group_memberships ADD COLUMN verifier_id VARCHAR(50)`);
        }
        const [gmPendingStatus] = await connection.query(`SHOW COLUMNS FROM group_memberships LIKE 'pending_status'`);
        if (gmPendingStatus.length === 0) {
            await connection.query(`ALTER TABLE group_memberships ADD COLUMN pending_status ENUM('ACTIVE', 'PENDING', 'SUSPENDED', 'INVITED')`);
        }

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

        // Add is_rolled_back to transactions table
        const [txRolledBack] = await connection.query(`SHOW COLUMNS FROM transactions LIKE 'is_rolled_back'`);
        if (txRolledBack.length === 0) {
            await connection.query(`ALTER TABLE transactions ADD COLUMN is_rolled_back BOOLEAN DEFAULT 0`);
        }

        // Add verifier_id to transactions table
        const [txVerifier] = await connection.query(`SHOW COLUMNS FROM transactions LIKE 'verifier_id'`);
        if (txVerifier.length === 0) {
            await connection.query(`ALTER TABLE transactions ADD COLUMN verifier_id VARCHAR(50)`);
        }

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

        await connection.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id VARCHAR(50) PRIMARY KEY,
                recipient_id VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type ENUM('success', 'warning', 'info', 'error') DEFAULT 'info',
                is_read BOOLEAN DEFAULT FALSE,
                timestamp BIGINT NOT NULL
            )
        `);
        
        const [users] = await connection.query('SELECT id FROM users WHERE role = "SUPERUSER" LIMIT 1');
        if (users.length === 0) {
            console.log('🌱 Seeding initial System Administrator...');
            await connection.query(`
                INSERT INTO users (id, name, email, role, status, verification_status, avatar)
                VALUES ('u0', 'System Admin', 'admin@system.com', 'SUPERUSER', 'ACTIVE', 'VERIFIED', 'https://ui-avatars.com/api/?name=Admin&background=111827&color=fff')
            `);
        }

        console.log('🚀 Database ready and migrated.');
    } catch (err) {
        console.error('❌ Schema/Migration error:', err.message);
    } finally {
        connection.release();
    }
}

(async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Connected to MySQL.');
        connection.release();
        await initializeDatabase();
    } catch (err) {
        console.error('❌ DATABASE CONNECTION ERROR:', err.message);
        process.exit(1); 
    }
})();

// --- API ROUTES ---

app.get('/api/check-health', (req, res) => {
    res.json({ status: 'online', database: 'connected' });
});

/**
 * Paystack Specific Endpoints
 */
app.get('/api/paystack/key', (req, res) => {
    if (!PUBLIC_KEY) {
        return res.status(500).json({ error: "Public Key not configured." });
    }
    res.json({ publicKey: PUBLIC_KEY });
});

/**
 * PLATFORM FINANCIALS: Initialize a payment record
 * Call this before redirecting the user to Paystack
 */
app.post('/api/paystack/initialize-confirmation', authenticateToken, async (req, res) => {
    const { reference, access_code, amount, payment_type, metadata } = req.body;
    const userId = req.user.id;

    try {
        await pool.query(
            'INSERT INTO payment_confirmations (reference, access_code, user_id, amount, payment_type, metadata) VALUES (?, ?, ?, ?, ?, ?)',
            [reference, access_code, userId, amount, payment_type || 'DEPOSIT', JSON.stringify(metadata || {})]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to log payment intent:', error);
        res.status(500).json({ error: "Internal ledger error" });
    }
});

/**
 * PLATFORM FINANCIALS: Get all pending payments for Superuser review
 */
app.get('/api/admin/financials/pending', authenticateToken, authorizeRoles('SUPERUSER'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT pc.*, u.name as userName, u.email as userEmail 
             FROM payment_confirmations pc 
             JOIN users u ON pc.user_id = u.id 
             WHERE pc.status = 'PENDING' 
             ORDER BY pc.created_at DESC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PLATFORM FINANCIALS: Superuser manual approval
 */
app.put('/api/admin/financials/approve-payment', authenticateToken, authorizeRoles('SUPERUSER'), async (req, res) => {
    const { reference } = req.body;
    const superuserId = req.user.id;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        
        // 1. Mark the confirmation as completed
        const [result] = await connection.query(
            'UPDATE payment_confirmations SET status = "COMPLETED", approved_by = ? WHERE reference = ? AND status = "PENDING"',
            [superuserId, reference]
        );

        if (result.affectedRows === 0) throw new Error("Payment not found or already processed.");

        await connection.commit();
        res.json({ success: true, message: "Payment reconciled and approved." });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

app.post('/api/paystack/withdraw', authenticateToken, authorizeRoles('ADMIN', 'SUPERUSER'), async (req, res) => {
    // We now get the userId from req.user (the verified token) 
    // instead of trusting req.body.userId
    const userId = req.user.id; 
    const { amount, recipientEmail, accountNumber, provider } = req.body;
    
    try {
        if (amount <= 0) {
            return res.status(400).json({ success: false, message: "Invalid request parameters." });
        }

        // 3. Balance Check: Query the DB to ensure this user/group actually has this amount.
        const [balanceRows] = await pool.query('SELECT total_pool FROM savings_groups WHERE id = (SELECT group_id FROM group_memberships WHERE user_id = ? AND role = "ADMIN" LIMIT 1)', [userId]);
        if (balanceRows.length === 0 || balanceRows[0].total_pool < amount) {
            return res.status(403).json({ success: false, message: "Insufficient group funds for withdrawal." });
        }

        // 1. Create a Transfer Recipient
        const recipient = await paystackRequest('/transferrecipient', 'POST', {
            type: "mobile_money",
            name: recipientEmail.split('@')[0],
            account_number: accountNumber,
            bank_code: provider === 'MTN' ? 'MTN' : (provider === 'Telecel' ? 'VOD' : 'ATL'),
            currency: "GHS"
        });

        if (!recipient.status) throw new Error(recipient.message);

        // 2. Initiate the Transfer
        const transfer = await paystackRequest('/transfer', 'POST', {
            source: "balance",
            amount: Math.round(amount * 100),
            recipient: recipient.data.recipient_code,
            reason: `Withdrawal for ${recipientEmail}`
        });

        if (!transfer.status) throw new Error(transfer.message);

        res.json({
            success: true,
            transfer_code: transfer.data.transfer_code,
            message: 'Transfer initiated successfully'
        });
    } catch (error) {
        console.error('Withdrawal Error:', error.message);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

app.get('/api/groups', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM savings_groups ORDER BY name ASC');
        res.json(rows);
    } catch (error) {
        throw error;
    }
});

app.post('/api/groups', authenticateToken, async (req, res) => {
    // Use the ID from the token, not the request body
    const creatorId = req.user.id;
    const { id, name, contributionAmount, currency, frequency, inviteCode, welcomeMessage, icon, scheduledPayoutAmount } = req.body;
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query(
            `INSERT INTO savings_groups (id, name, contribution_amount, currency, frequency, invite_code, welcome_message, icon, scheduled_payout_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, name, contributionAmount, currency, frequency, inviteCode, welcomeMessage, icon, scheduledPayoutAmount || 0, 'PENDING_VERIFICATION']
        );
        if (creatorId) {
            await connection.query(`INSERT INTO group_memberships (user_id, group_id, role, status) VALUES (?, ?, 'ADMIN', 'ACTIVE')`, [creatorId, id]);
            await connection.query(`UPDATE savings_groups SET members_count = 1 WHERE id = ?`, [id]);
        }
        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        console.error('Group creation failed:', error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

app.put('/api/groups/:id', authenticateToken, async (req, res) => {
    const { name, contributionAmount, currency, frequency, welcomeMessage, icon, payoutSchedule, scheduledPayoutAmount, callActive } = req.body;
    const groupId = req.params.id;
    const userId = req.user.id;

    // Layer 3: Relationship Check - Only an ADMIN of this group (or SUPERUSER) can update it
    const [membership] = await pool.query(
        'SELECT role FROM group_memberships WHERE user_id = ? AND group_id = ?',
        [userId, groupId]
    );

    if ((membership.length === 0 || membership[0].role !== 'ADMIN') && req.user.role !== 'SUPERUSER') {
        return res.status(403).json({ error: "Unauthorized. You are not an admin of this group." });
    }

    const updates = [];
    const values = [];

    if (name) { updates.push('name = ?'); values.push(name); }
    if (contributionAmount) { updates.push('contribution_amount = ?'); values.push(contributionAmount); }
    if (currency) { updates.push('currency = ?'); values.push(currency); }
    if (frequency) { updates.push('frequency = ?'); values.push(frequency); }
    if (welcomeMessage) { updates.push('welcome_message = ?'); values.push(welcomeMessage); }
    if (icon) { updates.push('icon = ?'); values.push(icon); }
    if (payoutSchedule) { updates.push('payout_schedule = ?'); values.push(JSON.stringify(payoutSchedule)); }
    if (scheduledPayoutAmount !== undefined) { updates.push('scheduled_payout_amount = ?'); values.push(scheduledPayoutAmount); }
    if (callActive !== undefined) { updates.push('call_active = ?'); values.push(callActive); }

    if (updates.length === 0) return res.json({ success: true, message: 'No changes provided.' });

    values.push(groupId);
    const sql = `UPDATE savings_groups SET ${updates.join(', ')} WHERE id = ?`;
    try {
        await pool.query(sql, values);
        res.json({ success: true });
    } catch (error) {
        console.error(`Group update failed for ID ${groupId}:`, error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/groups/:id/status', authenticateToken, authorizeRoles('SUPERUSER'), async (req, res) => {
    const { status, approvedBy } = req.body;
    if (!['ACTIVE', 'REJECTED', 'PENDING_VERIFICATION', 'SUSPENDED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    try {
        if (approvedBy) {
            await pool.query('UPDATE savings_groups SET status = ?, approved_by = ? WHERE id = ?', [status, approvedBy, req.params.id]);
        } else {
            await pool.query('UPDATE savings_groups SET status = ? WHERE id = ?', [status, req.params.id]);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/groups/:id', authenticateToken, authorizeRoles('SUPERUSER'), async (req, res) => {
    try {
        // Soft delete to preserve transaction history for wallet access
        await pool.query('UPDATE savings_groups SET status = "DELETED" WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users', authenticateToken, authorizeRoles('SUPERUSER'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users ORDER BY join_date DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GET USER'S GROUPS ---
app.get('/api/users/:userId/groups', authenticateToken, async (req, res) => {
    // Identity Check: Users can only see their own memberships
    if (req.user.id !== req.params.userId && req.user.role !== 'SUPERUSER') {
        return res.status(403).json({ error: "Access denied." });
    }
    try {
        const [rows] = await pool.query(
            `SELECT sg.*, gm.role as membership_role, gm.status as membership_status, gm.joined_at
             FROM savings_groups sg
             JOIN group_memberships gm ON sg.id = gm.group_id
             WHERE gm.user_id = ? AND gm.status != 'SUSPENDED'
             ORDER BY gm.joined_at DESC`,
            [req.params.userId]
        );
        res.json(rows);
    } catch (error) {
        console.error('GET /api/users/:userId/groups error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users/:email', authenticateToken, async (req, res) => {
    // Only allow users to look up themselves or allow SUPERUSER/ADMIN
    if (req.user.email !== req.params.email && req.user.role === 'MEMBER') {
        return res.status(403).json({ error: "Unauthorized access to user profile." });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [req.params.email]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: "User not found" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { id, name, email, phoneNumber, avatar, kycDocumentImage, occupation, location, kycId } = req.body;
    try {
        // Security: Never trust 'role' from the body on public registration.
        // Force new users to 'MEMBER' status.
        const defaultRole = 'MEMBER';
        const sql = `
            INSERT INTO users (id, name, email, phone_number, role, avatar, kyc_document_image, occupation, location, kyc_id, status, verification_status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING')
        `;
        await pool.query(sql, [id, name, email, phoneNumber, defaultRole, avatar, kycDocumentImage, occupation, location, kycId]);
        res.json({ success: true });
    } catch (error) {
        console.error('User registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
    const { status, verificationStatus, role, reliabilityScore, avatar, kycDocumentImage, name, occupation, phoneNumber } = req.body;
    const targetId = req.params.id;
    const requesterId = req.user.id;

    // Security: Only allow users to update themselves, OR allow SUPERUSER to update anyone.
    if (targetId !== requesterId && req.user.role !== 'SUPERUSER') {
        return res.status(403).json({ error: "Access denied. You can only update your own profile." });
    }

    // Only SUPERUSER can promote roles or change verification status
    const isSuper = req.user.role === 'SUPERUSER';

    const updates = [];
    const values = [];
    
    if (isSuper && status) { updates.push('status = ?'); values.push(status); }
    if (isSuper && verificationStatus) { updates.push('verification_status = ?'); values.push(verificationStatus); }
    if (isSuper && role) { updates.push('role = ?'); values.push(role); }
    if (reliabilityScore !== undefined) { updates.push('reliability_score = ?'); values.push(reliabilityScore); }
    if (avatar) { updates.push('avatar = ?'); values.push(avatar); }
    if (kycDocumentImage) { updates.push('kyc_document_image = ?'); values.push(kycDocumentImage); }
    if (name) { updates.push('name = ?'); values.push(name); }
    if (occupation) { updates.push('occupation = ?'); values.push(occupation); }
    if (phoneNumber) { updates.push('phone_number = ?'); values.push(phoneNumber); }
    
    if (updates.length === 0) return res.json({ success: true });
    
    values.push(req.params.id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    try {
        await pool.query(sql, values);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/users/:id', authenticateToken, authorizeRoles('SUPERUSER'), async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
    const { id, userId, groupId, type, amount, verifierId } = req.body;
    
    // 🛡️ FRAUD PREVENTION: Only admins can mark transactions as COMPLETED. 
    // Users can only create PENDING transactions.
    const status = (req.user.role === 'SUPERUSER' || req.user.role === 'ADMIN') ? (req.body.status || 'PENDING') : 'PENDING';

    if (userId !== req.user.id && req.user.role !== 'SUPERUSER') {
        return res.status(403).json({ error: "Access denied." });
    }

    try {
        await pool.query('INSERT INTO transactions (id, user_id, group_id, type, amount, status, verifier_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, userId, groupId, type, amount, status, verifierId || null]);
        if (groupId && status === 'COMPLETED') {
            const mod = type === 'CONTRIBUTION' ? '+' : '-';
            await pool.query(`UPDATE savings_groups SET total_pool = total_pool ${mod} ? WHERE id = ?`, [amount, groupId]);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/groups/:groupId/new-cycle', authenticateToken, authorizeRoles('ADMIN', 'SUPERUSER'), async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        // Get transaction details
        const [txs] = await connection.query('SELECT * FROM transactions WHERE id = ?', [id]);
        if (txs.length > 0) {
            const tx = txs[0];
            // Only refund pool for Payouts/Withdrawals. 
            // For CONTRIBUTIONS, we do NOT deduct from pool (per request), effectively keeping the money but resetting member status.
            if (tx.group_id && tx.status === 'COMPLETED' && (tx.type === 'PAYOUT' || tx.type === 'WITHDRAWAL')) {
                await connection.query('UPDATE savings_groups SET total_pool = total_pool + ? WHERE id = ?', [tx.amount, tx.group_id]);
            }
            await connection.query('DELETE FROM transactions WHERE id = ?', [id]);
        }
        
        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

app.put('/api/transactions/:id/rollback', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE transactions SET is_rolled_back = 1 WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/transactions/bulk-rollback', async (req, res) => {
    const { transactionIds } = req.body;
    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
        return res.status(400).json({ message: "No transaction IDs provided." });
    }
    try {
        const placeholders = transactionIds.map(() => '?').join(',');
        await pool.query(`UPDATE transactions SET is_rolled_back = 1 WHERE id IN (${placeholders})`, transactionIds);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/transactions/verification-pending/:userId', authenticateToken, async (req, res) => {
    if (req.user.id !== req.params.userId && req.user.role !== 'SUPERUSER') {
        return res.status(403).json({ error: "Access denied." });
    }
    try {
        const [rows] = await pool.query(
            'SELECT t.*, u.name as userName FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.verifier_id = ? AND t.status = "PENDING"',
            [req.params.userId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/transactions/:id/verify', authenticateToken, authorizeRoles('ADMIN', 'SUPERUSER'), async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [txs] = await connection.query('SELECT * FROM transactions WHERE id = ?', [id]);
        if (txs.length > 0) {
            const tx = txs[0];
            
            // 🛡️ Admin Check: Verify the requester is actually an admin of the group the tx belongs to
            if (req.user.role !== 'SUPERUSER') {
                const [isOwner] = await connection.query(
                    'SELECT 1 FROM group_memberships WHERE user_id = ? AND group_id = ? AND role = "ADMIN"',
                    [req.user.id, tx.group_id]
                );
                if (isOwner.length === 0) throw new Error("Unauthorized to verify this transaction.");
            }

            if (tx.status !== 'COMPLETED') {
                await connection.query('UPDATE transactions SET status = ? WHERE id = ?', ['COMPLETED', id]);
                if (tx.group_id && (tx.type === 'PAYOUT' || tx.type === 'WITHDRAWAL')) {
                     await connection.query('UPDATE savings_groups SET total_pool = total_pool - ? WHERE id = ?', [tx.amount, tx.group_id]);
                }
            }
        }
        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

app.get('/api/transactions', authenticateToken, authorizeRoles('SUPERUSER'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT t.*, u.name as userName FROM transactions t LEFT JOIN users u ON t.user_id = u.id ORDER BY t.date DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/transactions/:userId', authenticateToken, async (req, res) => {
    const requesterId = req.user.id;
    try {
        const { groupId } = req.query;
        
        // Security: Prevent users from seeing each other's transactions
        if (requesterId !== req.params.userId && req.user.role === 'MEMBER') {
            return res.status(403).json({ error: "Unauthorized access to transactions." });
        }

        let sql = 'SELECT * FROM transactions WHERE user_id = ?';
        const params = [req.params.userId];

        if (groupId) {
            sql += ' AND group_id = ?';
            params.push(groupId);
        }

        sql += ' ORDER BY date DESC';
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/groups/:groupId/transactions/contributions', authenticateToken, async (req, res) => {
    const { groupId } = req.params;
    // Membership check
    const [membership] = await pool.query(
        'SELECT 1 FROM group_memberships WHERE user_id = ? AND group_id = ? AND status = "ACTIVE"',
        [req.user.id, groupId]
    );
    if (membership.length === 0 && req.user.role !== 'SUPERUSER') {
        return res.status(403).json({ error: "Access denied." });
    }
    try {
        const [rows] = await pool.query(
            'SELECT t.*, u.name as userName FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.group_id = ? AND t.type = "CONTRIBUTION" ORDER BY t.date DESC',
            [req.params.groupId]
        );
        res.json(rows);
    } catch (error) {
        console.error('GET /api/groups/:groupId/transactions/contributions error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/groups/:groupId/transactions/payouts', authenticateToken, async (req, res) => {
    const { groupId } = req.params;
    const [membership] = await pool.query(
        'SELECT 1 FROM group_memberships WHERE user_id = ? AND group_id = ? AND status = "ACTIVE"',
        [req.user.id, groupId]
    );
    if (membership.length === 0 && req.user.role !== 'SUPERUSER') {
        return res.status(403).json({ error: "Access denied." });
    }
    try {
        const [rows] = await pool.query(
            'SELECT t.*, u.name as userName FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE t.group_id = ? AND t.type = "PAYOUT" ORDER BY t.date DESC',
            [req.params.groupId]
        );
        res.json(rows);
    } catch (error) {
        console.error('GET /api/groups/:groupId/transactions/payouts error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- GROUP CHAT MESSAGES API ---

app.get('/api/group-messages/:groupId', authenticateToken, async (req, res) => {
    const { groupId } = req.params;
    const [membership] = await pool.query(
        'SELECT 1 FROM group_memberships WHERE user_id = ? AND group_id = ? AND status = "ACTIVE"',
        [req.user.id, groupId]
    );
    if (membership.length === 0 && req.user.role !== 'SUPERUSER') {
        return res.status(403).json({ error: "Access denied." });
    }
    try {
        const [rows] = await pool.query(
            'SELECT * FROM group_messages WHERE group_id = ? ORDER BY timestamp ASC LIMIT 100',
            [req.params.groupId]
        );
        res.json(rows);
    } catch (error) {
        console.error('GET /api/group-messages/:groupId error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/group-messages', authenticateToken, async (req, res) => {
    const { id, groupId, senderId, text, type = 'text', timestamp } = req.body;
    if (senderId !== req.user.id) return res.status(403).json({ error: "Cannot spoof sender ID." });
    
    const [membership] = await pool.query(
        'SELECT 1 FROM group_memberships WHERE user_id = ? AND group_id = ? AND status = "ACTIVE"',
        [req.user.id, groupId]
    );
    if (membership.length === 0 && req.user.role !== 'SUPERUSER') {
        return res.status(403).json({ error: "Access denied." });
    }
    try {
        await pool.query(
            'INSERT INTO group_messages (id, group_id, sender_id, text, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
            [id, groupId, senderId, text, type, timestamp]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('POST /api/group-messages error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/groups/join', authenticateToken, async (req, res) => {
    const { userId, inviteCode } = req.body;
    if (userId !== req.user.id) return res.status(403).json({ error: "Access denied." });
    if (!inviteCode) {
        return res.status(400).json({ message: "User ID and invite code are required." });
    }

    const connection = await pool.getConnection();
    try {
        const [groups] = await connection.query(
            'SELECT id FROM savings_groups WHERE invite_code = ?',
            [inviteCode]
        );

        if (groups.length === 0) {
            return res.status(404).json({ message: "Group with this invite code not found." });
        }
        const groupId = groups[0].id;

        const [existing] = await connection.query(
            'SELECT * FROM group_memberships WHERE user_id = ? AND group_id = ?',
            [userId, groupId]
        );

        if (existing.length > 0) {
            if (existing[0].is_blocked) {
                return res.status(403).json({ message: "You are blocked from joining this group." });
            }
            // Reactivate if not active or if it was soft-deleted
            if (existing[0].status !== 'ACTIVE' || existing[0].is_deleted) {
                 await connection.query(
                    'UPDATE group_memberships SET status = \'ACTIVE\', is_deleted = 0 WHERE user_id = ? AND group_id = ?',
                    [userId, groupId]
                );
            }
        } else {
            await connection.query(
                'INSERT INTO group_memberships (user_id, group_id, role, status) VALUES (?, ?, \'MEMBER\', \'PENDING\')',
                [userId, groupId]
            );
        }
        
        await connection.query(
            `UPDATE savings_groups SET members_count = (SELECT COUNT(*) FROM group_memberships WHERE group_id = ? AND status = 'ACTIVE') WHERE id = ?`,
            [groupId, groupId]
        );

        res.json({ success: true, message: "Successfully joined group." });
    } catch (error) {
        console.error('POST /api/groups/join error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// --- NOTIFICATIONS API ---

app.get('/api/notifications/:userId', authenticateToken, async (req, res) => {
    const { userId } = req.params;
    if (userId !== req.user.id && req.user.role !== 'SUPERUSER') {
        return res.status(403).json({ error: "Access denied." });
    }
    try {
        const [users] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
        const role = users.length > 0 ? users[0].role : 'MEMBER';

        let query = 'SELECT * FROM notifications WHERE recipient_id = ? OR recipient_id = "ALL"';
        const params = [userId];

        if (role === 'ADMIN' || role === 'SUPERUSER') {
            query += ' OR recipient_id = "ADMIN"';
        }
        
        query += ' ORDER BY timestamp DESC LIMIT 50';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/notifications', authenticateToken, authorizeRoles('SUPERUSER'), async (req, res) => {
    const { id, recipientId, title, message, type, timestamp } = req.body;
    try {
        await pool.query(
            'INSERT INTO notifications (id, recipient_id, title, message, type, timestamp, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)',
            [id, recipientId, title, message, type, timestamp]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        const [result] = await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?', [req.params.id, req.user.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Notification not found." });
        res.json({ success: true });
    } catch (error) {
        throw error;
    }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM notifications WHERE id = ? AND recipient_id = ?', [req.params.id, req.user.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Notification not found." });
        res.json({ success: true });
    } catch (error) {
        throw error;
    }
});

// --- GROUP MEMBERSHIP MANAGEMENT API ---

app.get('/api/group-membership/status/:userId/:groupId', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM group_memberships WHERE user_id = ? AND group_id = ?',
            [req.params.userId, req.params.groupId]
        );
        res.json(rows.length > 0 ? rows[0] : { status: 'NOT_MEMBER', is_blocked: false, is_deleted: false });
    } catch (error) {
        console.error('GET /api/group-membership/status error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/group-membership/status', authenticateToken, authorizeRoles('ADMIN', 'SUPERUSER'), async (req, res) => {
    const { userId, groupId, status, verifierId } = req.body;
    if (!userId || !groupId || !status) {
        return res.status(400).json({ error: 'userId, groupId, and status are required.' });
    }
    const validStatuses = ['ACTIVE', 'PENDING', 'SUSPENDED', 'INVITED'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    try {
        let result;
        if (verifierId) {
            // Request verification
            [result] = await pool.query(
                'UPDATE group_memberships SET pending_status = ?, verifier_id = ? WHERE user_id = ? AND group_id = ?',
                [status, verifierId, userId, groupId]
            );
        } else {
            // Apply status change (direct or verified)
            [result] = await pool.query(
                'UPDATE group_memberships SET status = ?, pending_status = NULL, verifier_id = NULL WHERE user_id = ? AND group_id = ?',
                [status, userId, groupId]
            );
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Membership not found.' });
        }
        
        // Recalculate members_count
        await pool.query(
            `UPDATE savings_groups SET members_count = (SELECT COUNT(*) FROM group_memberships WHERE group_id = ? AND status = 'ACTIVE') WHERE id = ?`,
            [groupId, groupId]
        );

        res.json({ success: true, message: `Membership status updated.` });
    } catch (error) {
        console.error('PUT /api/group-membership/status error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/group-membership/join', authenticateToken, async (req, res) => {
    const { userId, groupId } = req.body;
    if (userId !== req.user.id) return res.status(403).json({ error: "Access denied." });
    try {
        // Check if membership exists
        const [existing] = await pool.query(
            'SELECT * FROM group_memberships WHERE user_id = ? AND group_id = ?',
            [userId, groupId]
        );

        if (existing.length > 0) {
            // Update existing record
            await pool.query(
                'UPDATE group_memberships SET status = ?, is_deleted = 0, is_blocked = 0 WHERE user_id = ? AND group_id = ?',
                ['ACTIVE', userId, groupId]
            );
        } else {
            // Create new membership
            await pool.query(
                'INSERT INTO group_memberships (user_id, group_id, role, status, is_blocked, is_deleted) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, groupId, 'MEMBER', 'PENDING', 0, 0]
            );
        }
        res.json({ success: true });
    } catch (error) {
        console.error('POST /api/group-membership/join error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/group-membership/block', authenticateToken, authorizeRoles('ADMIN', 'SUPERUSER'), async (req, res) => {
    const { userId, groupId } = req.body;
    try {
        const [existing] = await pool.query(
            'SELECT * FROM group_memberships WHERE user_id = ? AND group_id = ?',
            [userId, groupId]
        );

        if (existing.length > 0) {
            await pool.query(
                'UPDATE group_memberships SET is_blocked = 1 WHERE user_id = ? AND group_id = ?',
                [userId, groupId]
            );
        } else {
            await pool.query(
                'INSERT INTO group_memberships (user_id, group_id, role, status, is_blocked, is_deleted) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, groupId, 'MEMBER', 'PENDING', 1, 0]
            );
        }
        res.json({ success: true });
    } catch (error) {
        console.error('POST /api/group-membership/block error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/group-membership/reactivate', authenticateToken, authorizeRoles('ADMIN', 'SUPERUSER'), async (req, res) => {
    const { userId, groupId } = req.body;
    try {
        await pool.query(
            'UPDATE group_memberships SET is_deleted = 0, status = ? WHERE user_id = ? AND group_id = ?',
            ['ACTIVE', userId, groupId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('POST /api/group-membership/reactivate error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/group-membership/delete', authenticateToken, authorizeRoles('ADMIN', 'SUPERUSER'), async (req, res) => {
    const { userId, groupId } = req.body;
    try {
        await pool.query(
            'UPDATE group_memberships SET is_deleted = 1, status = ? WHERE user_id = ? AND group_id = ?',
            ['SUSPENDED', userId, groupId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('POST /api/group-membership/delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/group-memberships', authenticateToken, authorizeRoles('SUPERUSER'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM group_memberships');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- MEMBER SELF-MANAGEMENT ---

app.post('/api/group-membership/leave', authenticateToken, async (req, res) => {
    const { userId, groupId } = req.body;
    if (userId !== req.user.id) return res.status(403).json({ error: "Access denied." });
    try {
        // Soft delete / Suspend: User can rejoin later
        await pool.query(
            'UPDATE group_memberships SET status = ?, is_deleted = 0 WHERE user_id = ? AND group_id = ?',
            ['SUSPENDED', userId, groupId]
        );
        // Update member count
        await pool.query(
            `UPDATE savings_groups SET members_count = (SELECT COUNT(*) FROM group_memberships WHERE group_id = ? AND status = 'ACTIVE') WHERE id = ?`,
            [groupId, groupId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('POST /api/group-membership/leave error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/group-membership/:groupId/:userId', authenticateToken, authorizeRoles('ADMIN', 'SUPERUSER'), async (req, res) => {
    const { groupId, userId } = req.params;
    try {
        // 🛡️ Security Check: Ensure requester is Admin of THIS group
        if (req.user.role !== 'SUPERUSER') {
            const [isOwner] = await pool.query(
                'SELECT 1 FROM group_memberships WHERE user_id = ? AND group_id = ? AND role = "ADMIN"',
                [req.user.id, groupId]
            );
            if (isOwner.length === 0) throw new Error("Unauthorized.");
        }

        // Hard delete: Removes record entirely
        await pool.query(
            'DELETE FROM group_memberships WHERE user_id = ? AND group_id = ?',
            [userId, groupId]
        );
        // Update member count
        await pool.query(
            `UPDATE savings_groups SET members_count = (SELECT COUNT(*) FROM group_memberships WHERE group_id = ? AND status = 'ACTIVE') WHERE id = ?`,
            [groupId, groupId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/group-membership error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/groups/:groupId/new-cycle', async (req, res) => {
    const { groupId } = req.params;
    const { randomize } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 🛡️ Security Check: Ensure requester is Admin of THIS group
        if (req.user.role !== 'SUPERUSER') {
            const [isOwner] = await connection.query(
                'SELECT 1 FROM group_memberships WHERE user_id = ? AND group_id = ? AND role = "ADMIN"',
                [userId, groupId]
            );
            if (isOwner.length === 0) throw new Error("Unauthorized to manage cycles for this group.");
        }

        // 1. Get all active members of the group (excluding SUPERUSER)
        const [members] = await connection.query(
            `SELECT gm.user_id 
             FROM group_memberships gm
             JOIN users u ON gm.user_id = u.id
             WHERE gm.group_id = ? 
             AND gm.status = 'ACTIVE'
             AND u.role != 'SUPERUSER'`,
            [groupId]
        );

        if (members.length === 0) {
            throw new Error("No active members found in this group to start a new cycle.");
        }

        // 3. Calculate Cycle Dates based on Frequency
        const [groupInfo] = await connection.query('SELECT frequency FROM savings_groups WHERE id = ?', [groupId]);
        const frequency = groupInfo[0]?.frequency || 'Monthly';
        
        const startDate = new Date();
        const endDate = new Date(startDate);
        
        switch (frequency) {
            case 'Daily': endDate.setDate(startDate.getDate() + 1); break;
            case 'Weekly': endDate.setDate(startDate.getDate() + 7); break;
            case 'Bi-Weekly': endDate.setDate(startDate.getDate() + 14); break;
            case 'Yearly': endDate.setFullYear(startDate.getFullYear() + 1); break;
            case 'Monthly': 
            default:
                endDate.setMonth(startDate.getMonth() + 1);
                break;
        }

        let newSchedule = members.map(m => m.user_id);

        // 4. Create a new payout_schedule (randomized if requested)
        if (randomize) {
            newSchedule.sort(() => Math.random() - 0.5);
        }

        // 5. Update the payout_schedule, cycle_number, and dates for the group
        await connection.query(
            'UPDATE savings_groups SET payout_schedule = ?, cycle_number = COALESCE(cycle_number, 0) + 1, cycle_start_date = ?, cycle_end_date = ? WHERE id = ?',
            [JSON.stringify(newSchedule), startDate, endDate, groupId]
        );

        await connection.commit();

        // 5. Return the new payout_schedule and dates
        res.json({ 
            success: true, 
            newSchedule,
            cycleStartDate: startDate,
            cycleEndDate: endDate
        });

    } catch (error) {
        await connection.rollback();
        console.error(`Failed to start new cycle for group ${groupId}:`, error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// 🛡️ PRODUCTION HARDENING: Centralized Error Handler
app.use((err, req, res, next) => {
    console.error(`[INTERNAL ERROR] ${new Date().toISOString()}:`, err.stack);
    res.status(500).json({ 
        error: process.env.NODE_ENV === 'production' 
            ? "An unexpected error occurred. Please try again later." 
            : err.message 
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Digital Susu API active on http://localhost:${PORT}`);
});
