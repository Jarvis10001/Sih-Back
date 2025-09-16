const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    admissionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admission',
        required: true,
        index: true
    },
    orderId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    paymentId: {
        type: String,
        index: true
    },
    signature: {
        type: String
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'INR',
        enum: ['INR', 'USD', 'EUR']
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'pending',
        index: true
    },
    paymentMethod: {
        type: String,
        enum: ['card', 'netbanking', 'wallet', 'upi', 'emi']
    },
    paymentGateway: {
        type: String,
        required: true,
        default: 'razorpay'
    },
    paidAt: {
        type: Date
    },
    razorpayResponse: {
        type: mongoose.Schema.Types.Mixed // Store complete Razorpay response
    },
    
    // Fee breakdown
    feeBreakdown: {
        admissionFee: {
            type: Number,
            default: 0
        },
        registrationFee: {
            type: Number,
            default: 0
        },
        securityDeposit: {
            type: Number,
            default: 0
        },
        otherFees: {
            type: Number,
            default: 0
        }
    },

    // Refund information
    refundId: {
        type: String
    },
    refundAmount: {
        type: Number,
        default: 0
    },
    refundStatus: {
        type: String,
        enum: ['none', 'pending', 'processed', 'failed'],
        default: 'none'
    },
    refundReason: {
        type: String
    },
    refundedAt: {
        type: Date
    },

    // Additional metadata
    receipt: {
        type: String
    },
    notes: {
        type: mongoose.Schema.Types.Mixed
    },
    
    // Audit fields
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ admissionId: 1, status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ paidAt: -1 });

// Virtual for net amount (after refund)
paymentSchema.virtual('netAmount').get(function() {
    return this.amount - this.refundAmount;
});

// Virtual for payment receipt URL
paymentSchema.virtual('receiptUrl').get(function() {
    if (this.paymentId && this.status === 'completed') {
        return `/api/payment/receipt/${this._id}`;
    }
    return null;
});

// Pre-save middleware
paymentSchema.pre('save', function(next) {
    // Auto-calculate fee breakdown if not provided
    if (this.isNew && !this.feeBreakdown.admissionFee && this.amount) {
        // Default breakdown if not specified
        this.feeBreakdown = {
            admissionFee: Math.floor(this.amount * 0.77), // 77%
            registrationFee: Math.floor(this.amount * 0.08), // 8%
            securityDeposit: Math.floor(this.amount * 0.15), // 15%
            otherFees: 0
        };
    }
    next();
});

// Instance methods
paymentSchema.methods.isCompleted = function() {
    return this.status === 'completed' && this.paymentId;
};

paymentSchema.methods.canRefund = function() {
    return this.status === 'completed' && 
           this.refundStatus === 'none' && 
           this.amount > this.refundAmount;
};

paymentSchema.methods.getReceiptData = function() {
    return {
        id: this._id,
        orderId: this.orderId,
        paymentId: this.paymentId,
        amount: this.amount,
        currency: this.currency,
        status: this.status,
        paidAt: this.paidAt,
        feeBreakdown: this.feeBreakdown,
        refundAmount: this.refundAmount,
        netAmount: this.netAmount
    };
};

// Static methods
paymentSchema.statics.findByUserId = function(userId, options = {}) {
    const query = this.find({ userId });
    
    if (options.status) {
        query.where('status', options.status);
    }
    
    if (options.populate) {
        query.populate(options.populate);
    }
    
    return query.sort({ createdAt: -1 });
};

paymentSchema.statics.getPaymentStats = async function(userId) {
    const stats = await this.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' }
            }
        }
    ]);
    
    return stats.reduce((acc, stat) => {
        acc[stat._id] = {
            count: stat.count,
            totalAmount: stat.totalAmount
        };
        return acc;
    }, {});
};

module.exports = mongoose.model('Payment', paymentSchema);