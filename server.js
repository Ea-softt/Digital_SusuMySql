require('dotenv').config();
const express = require('express');
const https = require('https');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

/**
 * Helper to make Paystack API requests using the https module
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

/**
 * Endpoint to get the Paystack Public Key
 */
app.get('/api/paystack/key', (req, res) => {
    res.json({ publicKey: PUBLIC_KEY });
});

/**
 * Endpoint for handling withdrawals (Transfers)
 * This matches the initiateWithdrawal call in the Dashboards
 */
app.post('/api/paystack/withdraw', async (req, res) => {
    const { amount, recipientEmail, accountNumber, provider, userId } = req.body;

    try {
        // 1. Create a Transfer Recipient (Mobile Money)
        const recipient = await paystackRequest('/transferrecipient', 'POST', {
            type: "mobile_money",
            name: recipientEmail.split('@')[0],
            account_number: accountNumber,
            bank_code: provider === 'MTN' ? 'MTN' : (provider === 'Telecel' ? 'VOD' : 'ATL'),
            currency: "GHS"
        });

        if (!recipient.status) throw new Error(recipient.message);

        // 2. Initiate the Transfer from your Paystack Balance
        const transfer = await paystackRequest('/transfer', 'POST', {
            source: "balance",
            amount: Math.round(amount * 100), // Convert to pesewas
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Digital Susu Paystack Backend running on port ${PORT}`);
});