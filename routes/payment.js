const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
    createOrder,
    verifyPayment,
    getPaymentDetails,
    getPaymentHistory,
    handleWebhook
} = require('../controllers/paymentController');

const router = express.Router();

// @route   POST /api/payment/create-order
// @desc    Create payment order
// @access  Private
router.post('/create-order', authenticate, createOrder);

// @route   POST /api/payment/verify
// @desc    Verify payment
// @access  Private
router.post('/verify', authenticate, verifyPayment);

// @route   GET /api/payment/history
// @desc    Get user payment history
// @access  Private
router.get('/history', authenticate, getPaymentHistory);

// @route   GET /api/payment/:id
// @desc    Get payment details
// @access  Private
router.get('/:id', authenticate, getPaymentDetails);

// @route   POST /api/payment/webhook
// @desc    Handle payment webhook
// @access  Public (Webhook)
router.post('/webhook', handleWebhook);

module.exports = router;