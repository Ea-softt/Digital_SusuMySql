import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import https from 'https';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import Joi from 'joi';
import crypto from 'crypto';

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
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "connect-src": ["'self'", "http://localhost:3000", "http://localhost:3001", "https://api.paystack.co"],
            "img-src": ["'self'", "data:", "blob:", "https://picsum.photos", "https://ui-avatars.com", "https://i.pravatar.cc", "https://*.paystack.co"],
            "script-src": ["'self'", "'unsafe-inline'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "frame-src": ["'self'", "https://checkout.paystack.com", "https://checkout.paystack.co", "https://*.paystack.co"],
            "font-src": ["'self'", "https:", "data:"],
            "object-src": ["'none'"]
        },
    },
}));

// 🛡️ PRODUCTION HARDENING: Rate Limiting (Prevents Brute Force/DoS)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Higher limit to accommodate administrative polling and dashboard usage
    message: { error: "Too many requests from this IP, please try again after 15 minutes" }
});

app.use('/api/', apiLimiter);

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(bodyParser.json({ 
    limit: '20mb',
    verify: (req, res, buf) => { req.rawBody = buf; } // 🛡️ Essential for Webhook verification
}));

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
    const authHeader = req.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

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
 * Joi Validation Schemas
 */
const schemas = {
    register: Joi.object({
        id: Joi.string().required(),
        name: Joi.string().min(3).required(),
        email: Joi.string().email().required(),
        password: Joi.string().pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).required(),
        phoneNumber: Joi.string().length(10).pattern(/^[0-9]+$/).required(),
        role: Joi.string().valid('MEMBER', 'ADMIN').default('MEMBER'),
        avatar: Joi.string().allow('', null),
        occupation: Joi.string().min(2).required(),
        location: Joi.string().allow('', null),
        kycId: Joi.string().pattern(/^GHA-\d{9}-\d$/).required(),
        kycDocumentFront: Joi.string().required(),
        kycDocumentBack: Joi.string().required()
    }),
    createGroup: Joi.object({
        id: Joi.string().required(),
        name: Joi.string().min(3).required(),
        contributionAmount: Joi.number().positive().required(),
        currency: Joi.string().length(3).default('GHS'),
        frequency: Joi.string().valid('Daily', 'Weekly', 'Bi-Weekly', 'Monthly', 'Yearly').required(),
        inviteCode: Joi.string().required(),
        welcomeMessage: Joi.string().allow('', null),
        icon: Joi.string().allow('', null),
        scheduledPayoutAmount: Joi.number().min(0),
        creatorId: Joi.string()
    }),
    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),
    resetRequest: Joi.object({
        email: Joi.string().email().required()
    }),
    resetPassword: Joi.object({
        email: Joi.string().email().required(),
        code: Joi.string().length(6).required(),
        newPassword: Joi.string().pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).required()
    })
};

const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    next();
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

/**
 * Helper to map DB snake_case columns to Frontend camelCase properties
 */
const mapUserRow = (user) => {
    if (!user) return null;
    return {
        ...user,
        phoneNumber: user.phone_number,
        // 🛡️ DATA INTEGRITY: Robust mapping for image fields to prevent "Missing" UI states
        kycDocumentFront: user.kyc_document_front || user.kycDocumentFront || user.kyc_document_image || user.idDocumentUrl || null,
        kycDocumentBack: user.kyc_document_back || user.kycDocumentBack || null,
        kycDocumentImage: user.kyc_document_image, // legacy
        kycId: user.kyc_id,
        status: user.status,
        verificationStatus: user.verification_status || user.verificationStatus,
        joinDate: user.join_date,
        reliabilityScore: user.reliability_score,
        ipAddress: user.ip_address,
        metadata: typeof user.metadata === 'string' ? JSON.parse(user.metadata) : user.metadata
    };
};

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
                kyc_document_front LONGTEXT,
                kyc_document_back LONGTEXT,
                status ENUM('ACTIVE', 'PENDING', 'SUSPENDED', 'INVITED', 'NEW') DEFAULT 'NEW',
                verification_status ENUM('VERIFIED', 'PENDING', 'REJECTED', 'UNVERIFIED') DEFAULT 'UNVERIFIED',
                join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                metadata JSON,
                ip_address VARCHAR(45),
                reliability_score INT DEFAULT 100
            )
        `);

        // 🛡️ DATA INTEGRITY: Force columns to LONGTEXT immediately to prevent Base64 truncation
        console.log('🔄 Ensuring image columns have maximum storage capacity...');
        await connection.query(`ALTER TABLE users MODIFY COLUMN avatar LONGTEXT`);
        await connection.query(`ALTER TABLE users MODIFY COLUMN kyc_document_image LONGTEXT`);
        await connection.query(`ALTER TABLE users MODIFY COLUMN kyc_document_front LONGTEXT`);
        await connection.query(`ALTER TABLE users MODIFY COLUMN kyc_document_back LONGTEXT`);
        await connection.query(`ALTER TABLE savings_groups MODIFY COLUMN icon LONGTEXT`);

        // Migration checks for missing columns
        console.log('🔄 Enforcing LONGTEXT storage for image data...');
        await connection.query(`ALTER TABLE users MODIFY COLUMN avatar LONGTEXT`);
        await connection.query(`ALTER TABLE users MODIFY COLUMN kyc_document_image LONGTEXT`);
        const [kycImgCols] = await connection.query(`SHOW COLUMNS FROM users LIKE 'kyc_document_image'`);
        if (kycImgCols.length === 0) await connection.query(`ALTER TABLE users ADD COLUMN kyc_document_image LONGTEXT AFTER avatar`);

        const [kycFrontCols] = await connection.query(`SHOW COLUMNS FROM users LIKE 'kyc_document_front'`);
        if (kycFrontCols.length === 0) {
            await connection.query(`ALTER TABLE users ADD COLUMN kyc_document_front LONGTEXT AFTER kyc_id`);
        }
        const [kycBackCols] = await connection.query(`SHOW COLUMNS FROM users LIKE 'kyc_document_back'`);
        if (kycBackCols.length === 0) {
            await connection.query(`ALTER TABLE users ADD COLUMN kyc_document_back LONGTEXT AFTER kyc_document_front`);
        }
        const [metaCols] = await connection.query(`SHOW COLUMNS FROM users LIKE 'metadata'`);
        if (metaCols.length === 0) {
            await connection.query(`ALTER TABLE users ADD COLUMN metadata JSON AFTER reliability_score`);
        }
        const [ipCols] = await connection.query(`SHOW COLUMNS FROM users LIKE 'ip_address'`);
        if (ipCols.length === 0) {
            await connection.query(`ALTER TABLE users ADD COLUMN ip_address VARCHAR(45) AFTER metadata`);
        }

        const [passCols] = await connection.query(`SHOW COLUMNS FROM users LIKE 'password'`);
        if (passCols.length === 0) {
            await connection.query(`ALTER TABLE users ADD COLUMN password VARCHAR(255) AFTER email`);
        }

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
            CREATE TABLE IF NOT EXISTS password_resets (
                email VARCHAR(100) PRIMARY KEY,
                token VARCHAR(10) NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
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
        
        // Final verification of column types
        await connection.query(`ALTER TABLE users MODIFY COLUMN kyc_document_front LONGTEXT`);
        await connection.query(`ALTER TABLE users MODIFY COLUMN kyc_document_back LONGTEXT`);
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
            const hashed = await bcrypt.hash('admin123', 10);
            await connection.query(`
                INSERT INTO users (id, name, email, password, role, status, verification_status, avatar)
                VALUES ('u0', 'System Admin', 'admin@system.com', ?, 'SUPERUSER', 'ACTIVE', 'VERIFIED', 'https://ui-avatars.com/api/?name=Admin&background=111827&color=fff')
            `, [hashed]);
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

app.get('/', (req, res) => {
    res.json({ message: "Digital Susu API is running", version: "1.0.0", health: "/api/check-health" });
});

app.get('/api/check-health', (req, res) => {
    res.json({ status: 'online', database: 'connected' });
});

// 🛡️ GLOBAL JWT ENFORCEMENT
// Protects all routes defined below this point unless explicitly excluded
app.use('/api', (req, res, next) => {
    const publicPaths = ['/check-health', '/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];
    if (publicPaths.includes(req.path) || req.path.startsWith('/webhooks/')) {
        return next();
    }
    // Enforce authentication for everything else
    authenticateToken(req, res, next);
});

// --- AUTHENTICATION API (PUBLIC) ---

app.post('/api/auth/register', validate(schemas.register), async (req, res, next) => {
    const { id, name, email, password, phoneNumber, avatar, kycDocumentFront, kycDocumentBack, occupation, location, kycId, metadata } = req.body;
    try {
        // 🛡️ SECURITY: Backend validation to ensure front and back ID images are unique
        if (kycDocumentFront === kycDocumentBack) {
            return res.status(400).json({ error: "Front and back ID documents cannot be the same image." });
        }

        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) return res.status(409).json({ error: "Email already registered." });

        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (id, name, email, password, role, phone_number, avatar, kyc_document_front, kyc_document_back, occupation, location, kyc_id, status, verification_status, metadata, ip_address) 
                     VALUES (?, ?, ?, ?, 'MEMBER', ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING', ?, ?)`;
        
        await pool.query(sql, [id, name, email, hashedPassword, phoneNumber, avatar, kycDocumentFront, kycDocumentBack, occupation, location, kycId, metadata || null, req.ip]);
        
        const token = jwt.sign({ id, email, role: 'MEMBER' }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ success: true, token });
    } catch (error) { next(error); }
});

app.post('/api/auth/login', validate(schemas.login), async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ error: "Invalid credentials." });

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: "Invalid credentials." });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) { next(error); }
});

app.post('/api/auth/forgot-password', validate(schemas.resetRequest), async (req, res, next) => {
    const { email } = req.body;
    try {
        const [user] = await pool.query('SELECT name FROM users WHERE email = ?', [email]);
        if (user.length === 0) {
            return res.json({ success: true, message: "If an account exists, instructions have been sent." });
        }

        // Generate a 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour expiry

        await pool.query(
            'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = ?, expires_at = ?',
            [email, code, expiresAt, code, expiresAt]
        );

        // In production, send this via email. For now, we return it for the demo/tutorial.
        console.log(`🔑 PASSWORD RESET CODE FOR ${email}: ${code}`);
        res.json({ success: true, message: "Reset code sent to your email.", demoCode: code });
    } catch (error) { next(error); }
});

app.post('/api/auth/reset-password', validate(schemas.resetPassword), async (req, res, next) => {
    const { email, code, newPassword } = req.body;
    try {
        const [record] = await pool.query('SELECT * FROM password_resets WHERE email = ? AND token = ? AND expires_at > NOW()', [email, code]);
        
        if (record.length === 0) {
            return res.status(400).json({ error: "Invalid or expired reset code." });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = ? WHERE email = ?', [hashed, email]);
        await pool.query('DELETE FROM password_resets WHERE email = ?', [email]);

        res.json({ success: true, message: "Password updated successfully." });
    } catch (error) { next(error); }
});

// --- KYC AI ANALYSIS ENDPOINT ---
app.post('/api/users/:id/kyc-analyze', authorizeRoles('SUPERUSER'), async (req, res, next) => {
    const userId = req.params.id;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) return res.status(404).json({ error: "User not found" });

        const user = mapUserRow(rows[0]); // Use mapUserRow to get camelCase properties

        const hasFrontImage = !!user.kycDocumentFront;
        const hasBackImage = !!user.kycDocumentBack;
        const hasAvatar = !!user.avatar;

        let overallScore = 0;
        
        // 🛡️ SIMULATED OCR EXTRACTION
        // In a real system, these variables would be populated by an OCR provider like Google Vision.
        const extractedIdFromCard = user.kycId; 
        const extractedNameFromCard = user.name;
        const extractedLocationFromCard = user.location;

        // --- Analysis Engine ---

        // 1. Face Match (Avatar vs. ID Front)
        const faceMatch = (hasAvatar && hasFrontImage) ? 'Confirmed' : (hasAvatar ? 'Uncertain' : 'Failed');
        if (faceMatch === 'Confirmed') overallScore += 30;

        // 2. Text Extraction (from ID images)
        const textExtraction = (hasFrontImage && hasBackImage) ? 'Successful' : (hasFrontImage ? 'Partial' : 'Failed');
        if (textExtraction === 'Successful') overallScore += 20;

        // 3. ID Number Match (Provider vs OCR)
        const idRegex = /^GHA-\d{9}-\d$/; // Enforce strict Ghana Card format
        const isFormatCorrect = idRegex.test(user.kycId || '');
        const idNumberMatch = (user.kycId && extractedIdFromCard === user.kycId && isFormatCorrect) ? 'Matched' : 'Mismatch';
        if (idNumberMatch === 'Matched') overallScore += 15;

        // 4. Location Match (Registration GPS vs ID Address)
        const isLocInGhana = (loc) => {
            if (!loc) return false;
            const l = loc.toUpperCase();
            // Check for keyword "Ghana" or "GH"
            if (l.includes('GHANA') || l.includes('GH')) return true;
            // Check GPS coordinates (Bounding box for Ghana)
            const coords = loc.split(',').map(p => parseFloat(p.trim()));
            return (coords.length === 2 && coords[0] >= 4.5 && coords[0] <= 11.5 && coords[1] >= -3.5 && coords[1] <= 1.5);
        };
        const locationMatch = (user.location && extractedLocationFromCard === user.location && isLocInGhana(user.location)) ? 'Matched' : 'Mismatch';
        if (locationMatch === 'Matched') overallScore += 15;

        // 5. Document Consistency (Front vs. Back)
        // 🛡️ SECURITY: Flag if the same image was uploaded for both front and back
        const isDuplicateImage = hasFrontImage && hasBackImage && user.kycDocumentFront === user.kycDocumentBack;
        const documentConsistency = isDuplicateImage ? 'Failed (Duplicate Photo)' : 
                                   (hasFrontImage && hasBackImage && extractedNameFromCard === user.name) ? 'Consistent' : 'Inconsistent';
        
        if (documentConsistency === 'Consistent') {
            overallScore += 10;
        } else if (isDuplicateImage) {
            overallScore -= 50; // Critical penalty for fraud attempt
        }

        // 6. Fraud Check (Reliability + Metadata)
        const fraudCheck = (user.reliabilityScore >= 80 && idNumberMatch === 'Matched') ? 'Passed' : 'Flagged';
        if (fraudCheck === 'Passed') overallScore += 10;

        // Adjust overall score to be within 0-100
        overallScore = Math.min(100, Math.max(0, overallScore));

        // Generate message based on score
        let message = overallScore >= 90 ? "Identity verified with high confidence. Document authentic." 
                    : overallScore >= 70 ? "Minor discrepancies detected. Manual review recommended."
                    : "Significant discrepancies or missing information. Rejection likely.";

        const result = { faceMatch, textExtraction, fraudCheck, idNumberMatch, locationMatch, documentConsistency, overallScore, message };

        // Simulate network delay for AI processing
        await new Promise(resolve => setTimeout(resolve, 1500));

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// --- WEBHOOKS (VERIFIED) ---

app.post('/api/webhooks/paystack', async (req, res) => {
    const hash = crypto.createHmac('sha512', SECRET_KEY).update(req.rawBody).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) return res.sendStatus(401);
    
    const event = req.body;
    if (event.event === 'charge.success') {
        // Logic to finalize platform financial records
    }
    res.sendStatus(200);
});


/**
 * Paystack Specific Endpoints
 */
app.get('/api/paystack/key', authenticateToken, (req, res) => {
    if (!PUBLIC_KEY) {
        return res.status(500).json({ error: "Public Key not configured." });
    }
    res.json({ publicKey: PUBLIC_KEY });
});

/**
 * PLATFORM FINANCIALS: Initialize a payment record
 * Call this before redirecting the user to Paystack
 */
app.post('/api/paystack/initialize-confirmation', async (req, res) => {
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
app.get('/api/admin/financials/pending', authorizeRoles('SUPERUSER'), async (req, res) => {
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
 * PLATFORM FINANCIALS: Verify actual payment status with Paystack
 */
app.get('/api/admin/financials/verify-paystack/:reference', authorizeRoles('SUPERUSER'), async (req, res) => {
    try {
        const result = await paystackRequest(`/transaction/verify/${req.params.reference}`, 'GET');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PLATFORM FINANCIALS: Superuser manual approval
 */
app.put('/api/admin/financials/approve-payment', authorizeRoles('SUPERUSER'), async (req, res) => {
    const { reference } = req.body;
    const superuserId = req.user.id;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        
        // 1. Update the payment_confirmations record
        const [result] = await connection.query(
            'UPDATE payment_confirmations SET status = "COMPLETED", approved_by = ? WHERE reference = ? AND status = "PENDING"',
            [superuserId, reference]
        );

        if (result.affectedRows === 0) throw new Error("Payment not found or already processed.");

        // 2. Synchronize the Platform Transaction Ledger
        await connection.query(
            'UPDATE transactions SET status = "COMPLETED" WHERE id = ?',
            [reference]
        );

        await connection.commit();
        res.json({ success: true, message: "Payment reconciled and approved." });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

app.post('/api/paystack/withdraw', authorizeRoles('ADMIN', 'SUPERUSER'), async (req, res) => {
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

app.get('/api/groups', async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT * FROM savings_groups WHERE status != "DELETED" ORDER BY name ASC');
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

app.post('/api/groups', validate(schemas.createGroup), async (req, res, next) => {
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
        next(error);
    } finally {
        connection.release();
    }
});

app.put('/api/groups/:id', async (req, res) => {
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
        next(error);
    }
});

app.put('/api/groups/:id/status', authorizeRoles('SUPERUSER'), async (req, res) => {
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
        next(error);
    }
});

app.delete('/api/groups/:id', authorizeRoles('SUPERUSER'), async (req, res) => {
    try {
        // Soft delete to preserve transaction history for wallet access
        await pool.query('UPDATE savings_groups SET status = "DELETED" WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

app.get('/api/users', authorizeRoles('SUPERUSER'), async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users ORDER BY join_date DESC');
        res.json(rows.map(mapUserRow));
    } catch (error) {
        next(error);
    }
});

// --- GET USER'S GROUPS ---
app.get('/api/users/:userId/groups', async (req, res) => {
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
        next(error);
    }
});

app.get('/api/users/:email', async (req, res, next) => {
    try {
        if (req.user.email !== req.params.email && req.user.role !== 'SUPERUSER') {
            return res.status(403).json({ error: "Access denied." });
        }
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [req.params.email]);
        if (rows.length > 0) res.json(mapUserRow(rows[0]));
        else res.status(404).json({ message: "User not found" });
    } catch (error) {
        next(error);
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { status, verificationStatus, role, reliabilityScore, avatar, kycDocumentFront, kycDocumentBack, name, occupation, phoneNumber } = req.body;
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
    if (kycDocumentFront) { updates.push('kyc_document_front = ?'); values.push(kycDocumentFront); }
    if (kycDocumentBack) { updates.push('kyc_document_back = ?'); values.push(kycDocumentBack); }
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
        next(error);
    }
});

app.delete('/api/users/:id', authorizeRoles('SUPERUSER'), async (req, res, next) => {
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

app.post('/api/transactions', async (req, res, next) => {
    // 🛡️ SECURITY: Never trust 'userId' from the frontend body
    const { id, groupId, type, amount, verifierId } = req.body;
    const userId = req.user.id; 
    
    // 🛡️ FRAUD PREVENTION: Only admins can mark transactions as COMPLETED. 
    // Users can only create PENDING transactions.
    const status = (req.user.role === 'SUPERUSER' || req.user.role === 'ADMIN') ? (req.body.status || 'PENDING') : 'PENDING';

    if (!id || !type || !amount) {
        return res.status(400).json({ error: "Missing required transaction data." });
    }

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
        next(error);
    }
});

app.post('/api/groups/:groupId/new-cycle', authorizeRoles('ADMIN', 'SUPERUSER'), async (req, res, next) => {
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
        next(error);
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
        next(error);
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

app.get('/api/transactions/verification-pending/:userId', async (req, res) => {
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
        next(error);
    }
});

app.put('/api/transactions/:id/verify', authorizeRoles('ADMIN', 'SUPERUSER'), async (req, res) => {
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
        next(error);
    } finally {
        connection.release();
    }
});

app.get('/api/transactions', authorizeRoles('SUPERUSER'), async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT t.*, u.name as userName FROM transactions t LEFT JOIN users u ON t.user_id = u.id ORDER BY t.date DESC');
        res.json(rows);
    } catch (error) {
        next(error);
    }
});

app.get('/api/transactions/:userId', async (req, res) => {
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

app.get('/api/groups/:groupId/transactions/contributions', async (req, res) => {
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

app.get('/api/groups/:groupId/transactions/payouts', async (req, res) => {
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

app.get('/api/group-messages/:groupId', async (req, res) => {
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

app.post('/api/group-messages', async (req, res) => {
    const { id, groupId, text, type = 'text', timestamp } = req.body;
    
    // 🛡️ SECURITY: Use ID from token to prevent impersonation
    const senderId = req.user.id;
    
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

app.post('/api/groups/join', async (req, res) => {
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
        next(error);
    } finally {
        connection.release();
    }
});

// --- NOTIFICATIONS API ---

app.get('/api/notifications/:userId', async (req, res, next) => {
    const { userId } = req.params;
    // 🛡️ OWNERSHIP CHECK: Users can only see their own notifications
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
        next(error);
    }
});

app.post('/api/notifications', authorizeRoles('SUPERUSER'), async (req, res, next) => {
    const { id, recipientId, title, message, type, timestamp } = req.body;
    try {
        await pool.query(
            'INSERT INTO notifications (id, recipient_id, title, message, type, timestamp, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)',
            [id, recipientId, title, message, type, timestamp]
        );
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

app.put('/api/notifications/:id/read', async (req, res) => {
    try {
        const [result] = await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?', [req.params.id, req.user.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Notification not found." });
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.delete('/api/notifications/:id', async (req, res, next) => {
    try {
        const [result] = await pool.query('DELETE FROM notifications WHERE id = ? AND recipient_id = ?', [req.params.id, req.user.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Notification not found." });
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.get('/api/group-memberships', async (req, res, next) => {
    try {
        // 🛡️ SECURITY: Ownership Check
        // Superusers see everything. Regular users/admins only see memberships 
        // for the groups they belong to.
        let sql = 'SELECT * FROM group_memberships';
        let params = [];

        if (req.user.role !== 'SUPERUSER') {
            sql = `
                SELECT gm.* FROM group_memberships gm
                WHERE gm.group_id IN (SELECT group_id FROM group_memberships WHERE user_id = ?)
            `;
            params = [req.user.id];
        }

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) { next(error); }
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
