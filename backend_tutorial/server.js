
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const PORT = 3001;

app.use(cors());
// Increased limit significantly for base64 ID document images
app.use(bodyParser.json({ limit: '20mb' }));

// Middleware to log all incoming requests for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'password', 
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

app.get('/api/groups', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM savings_groups ORDER BY name ASC');
        res.json(rows);
    } catch (error) {
        console.error('GET /api/groups error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/groups', async (req, res) => {
    const { id, name, contributionAmount, currency, frequency, inviteCode, welcomeMessage, icon, creatorId } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query(
            `INSERT INTO savings_groups (id, name, contribution_amount, currency, frequency, invite_code, welcome_message, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, name, contributionAmount, currency, frequency, inviteCode, welcomeMessage, icon]
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

app.put('/api/groups/:id', async (req, res) => {
    const { name, contributionAmount, currency, frequency, welcomeMessage, icon, payoutSchedule } = req.body;
    const updates = [];
    const values = [];

    if (name) { updates.push('name = ?'); values.push(name); }
    if (contributionAmount) { updates.push('contribution_amount = ?'); values.push(contributionAmount); }
    if (currency) { updates.push('currency = ?'); values.push(currency); }
    if (frequency) { updates.push('frequency = ?'); values.push(frequency); }
    if (welcomeMessage) { updates.push('welcome_message = ?'); values.push(welcomeMessage); }
    if (icon) { updates.push('icon = ?'); values.push(icon); }
    if (payoutSchedule) { updates.push('payout_schedule = ?'); values.push(JSON.stringify(payoutSchedule)); }

    if (updates.length === 0) return res.json({ success: true, message: 'No changes provided.' });

    values.push(req.params.id);
    const sql = `UPDATE savings_groups SET ${updates.join(', ')} WHERE id = ?`;
    try {
        await pool.query(sql, values);
        res.json({ success: true });
    } catch (error) {
        console.error(`Group update failed for ID ${req.params.id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users ORDER BY join_date DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GET USER'S GROUPS ---
app.get('/api/users/:userId/groups', async (req, res) => {
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

app.get('/api/users/:email', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [req.params.email]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: "User not found" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { id, name, email, phoneNumber, role, avatar, kycDocumentImage, occupation, location, kycId } = req.body;
    try {
        const sql = `
            INSERT INTO users (id, name, email, phone_number, role, avatar, kyc_document_image, occupation, location, kyc_id, status, verification_status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING')
        `;
        await pool.query(sql, [id, name, email, phoneNumber, role, avatar, kycDocumentImage, occupation, location, kycId]);
        res.json({ success: true });
    } catch (error) {
        console.error('User registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { status, verificationStatus, role, reliabilityScore, avatar, kycDocumentImage, name, occupation, phoneNumber } = req.body;
    const updates = [];
    const values = [];
    
    if (status) { updates.push('status = ?'); values.push(status); }
    if (verificationStatus) { updates.push('verification_status = ?'); values.push(verificationStatus); }
    if (role) { updates.push('role = ?'); values.push(role); }
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

app.delete('/api/users/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/transactions', async (req, res) => {
    const { id, userId, groupId, type, amount, status } = req.body;
    try {
        await pool.query('INSERT INTO transactions (id, user_id, group_id, type, amount, status) VALUES (?, ?, ?, ?, ?, ?)', [id, userId, groupId, type, amount, status]);
        if (groupId && status === 'COMPLETED') {
            const mod = type === 'CONTRIBUTION' ? '+' : '-';
            await pool.query(`UPDATE savings_groups SET total_pool = total_pool ${mod} ? WHERE id = ?`, [amount, groupId]);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/transactions/:userId', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC', [req.params.userId]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/groups/:groupId/transactions/contributions', async (req, res) => {
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

// --- GROUP CHAT MESSAGES API ---

app.get('/api/group-messages/:groupId', async (req, res) => {
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
    const { id, groupId, senderId, text, type = 'text', timestamp } = req.body;
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

// --- GROUP MEMBERSHIP MANAGEMENT API ---

app.get('/api/group-membership/status/:userId/:groupId', async (req, res) => {
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

app.post('/api/group-membership/join', async (req, res) => {
    const { userId, groupId } = req.body;
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
                [userId, groupId, 'MEMBER', 'ACTIVE', 0, 0]
            );
        }
        res.json({ success: true });
    } catch (error) {
        console.error('POST /api/group-membership/join error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/group-membership/block', async (req, res) => {
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

app.post('/api/group-membership/reactivate', async (req, res) => {
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

app.post('/api/group-membership/delete', async (req, res) => {
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

app.get('/api/group-memberships', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM group_memberships');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



app.listen(PORT, () => {
    console.log(`🚀 Digital Susu API active on http://localhost:${PORT}`);
});
