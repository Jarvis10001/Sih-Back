const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Admission = require('../models/Admission');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    Create payment order
// @route   POST /api/payment/create-order
// @access  Private
const createOrder = async (req, res) => {
    try {
        const { amount, currency = 'INR', receipt } = req.body;
        const userId = req.user.id;

        // Validate amount
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount'
            });
        }

        // Check if user has submitted admission form
        const admission = await Admission.findOne({ userId });
        if (!admission) {
            return res.status(404).json({
                success: false,
                message: 'Admission form not found. Please submit admission form first.'
            });
        }

        // Check if payment already exists for this admission
        const existingPayment = await Payment.findOne({ 
            userId, 
            admissionId: admission._id,
            status: 'completed'
        });

        if (existingPayment) {
            return res.status(400).json({
                success: false,
                message: 'Payment already completed for this admission'
            });
        }

        // Create Razorpay order
        const orderOptions = {
            amount: amount * 100, // Convert to paisa
            currency,
            receipt: receipt || `receipt_${Date.now()}`,
            notes: {
                userId: userId.toString(),
                admissionId: admission._id.toString(),
                purpose: 'admission_fee'
            }
        };

        const order = await razorpay.orders.create(orderOptions);

        // Create payment record in database
        const payment = new Payment({
            userId,
            admissionId: admission._id,
            razorpayOrderId: order.id,
            amount: amount,
            currency,
            status: 'created',
            createdAt: new Date()
        });

        await payment.save();

        res.json({
            success: true,
            message: 'Order created successfully',
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
                receipt: order.receipt
            },
            paymentId: payment._id
        });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment order',
            error: error.message
        });
    }
};

// @desc    Verify payment
// @route   POST /api/payment/verify
// @access  Private
const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        // Validate required fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Missing required payment verification data'
            });
        }

        // Create signature verification string
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        // Verify signature
        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }

        // Find payment record
        const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found'
            });
        }

        // Update payment status
        payment.razorpayPaymentId = razorpay_payment_id;
        payment.razorpaySignature = razorpay_signature;
        payment.status = 'completed';
        payment.paidAt = new Date();

        await payment.save();

        // Update admission status
        await Admission.findByIdAndUpdate(
            payment.admissionId,
            { 
                paymentStatus: 'completed',
                paymentDate: new Date()
            }
        );

        res.json({
            success: true,
            message: 'Payment verified successfully',
            payment: {
                id: payment._id,
                amount: payment.amount,
                status: payment.status,
                paidAt: payment.paidAt
            }
        });

    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Payment verification failed',
            error: error.message
        });
    }
};

// @desc    Get payment details
// @route   GET /api/payment/:id
// @access  Private
const getPaymentDetails = async (req, res) => {
    try {
        const paymentId = req.params.id;
        const userId = req.user.id;

        const payment = await Payment.findOne({ 
            _id: paymentId, 
            userId 
        }).populate('admissionId', 'personalInfo courseDetails');

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        res.json({
            success: true,
            payment
        });

    } catch (error) {
        console.error('Get payment details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment details',
            error: error.message
        });
    }
};

// @desc    Get user payment history
// @route   GET /api/payment/history
// @access  Private
const getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user.id;

        const payments = await Payment.find({ userId })
            .populate('admissionId', 'personalInfo courseDetails')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: payments.length,
            payments
        });

    } catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment history',
            error: error.message
        });
    }
};

// @desc    Handle payment webhook
// @route   POST /api/payment/webhook
// @access  Public (Webhook)
const handleWebhook = async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const receivedSignature = req.headers['x-razorpay-signature'];

        // Verify webhook signature
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (receivedSignature !== expectedSignature) {
            return res.status(400).json({
                success: false,
                message: 'Invalid webhook signature'
            });
        }

        const { event, payload } = req.body;

        // Handle different webhook events
        switch (event) {
            case 'payment.captured':
                await handlePaymentCaptured(payload.payment.entity);
                break;
            case 'payment.failed':
                await handlePaymentFailed(payload.payment.entity);
                break;
            default:
                console.log(`Unhandled webhook event: ${event}`);
        }

        res.json({
            success: true,
            message: 'Webhook processed successfully'
        });

    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({
            success: false,
            message: 'Webhook processing failed',
            error: error.message
        });
    }
};

// Helper function to handle payment captured
const handlePaymentCaptured = async (paymentEntity) => {
    try {
        const payment = await Payment.findOne({ 
            razorpayPaymentId: paymentEntity.id 
        });

        if (payment && payment.status !== 'completed') {
            payment.status = 'completed';
            payment.paidAt = new Date(paymentEntity.created_at * 1000);
            await payment.save();

            // Update admission status
            await Admission.findByIdAndUpdate(
                payment.admissionId,
                { 
                    paymentStatus: 'completed',
                    paymentDate: payment.paidAt
                }
            );
        }
    } catch (error) {
        console.error('Handle payment captured error:', error);
    }
};

// Helper function to handle payment failed
const handlePaymentFailed = async (paymentEntity) => {
    try {
        const payment = await Payment.findOne({ 
            razorpayPaymentId: paymentEntity.id 
        });

        if (payment) {
            payment.status = 'failed';
            payment.failureReason = paymentEntity.error_description;
            await payment.save();
        }
    } catch (error) {
        console.error('Handle payment failed error:', error);
    }
};

module.exports = {
    createOrder,
    verifyPayment,
    getPaymentDetails,
    getPaymentHistory,
    handleWebhook
};