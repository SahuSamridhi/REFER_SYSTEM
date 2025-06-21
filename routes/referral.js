const express = require('express');
const User = require('../models/User');
const Earning = require('../models/Earning');
const auth = require('../middleware/auth');

const router = express.Router();

// Get referral stats
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('directReferrals', 'name email createdAt');

    // Get level 2 referrals
    const level2Referrals = [];
    for (let directRef of user.directReferrals) {
      const level2Users = await User.find({ referredBy: directRef._id })
        .select('name email createdAt');
      level2Referrals.push(...level2Users);
    }

    // Get recent earnings
    const recentEarnings = await Earning.find({ userId: req.user._id })
      .populate('fromUserId', 'name email')
      .populate('purchaseId', 'amount productName')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      totalEarnings: user.totalEarnings,
      level1Earnings: user.level1Earnings,
      level2Earnings: user.level2Earnings,
      directReferrals: user.directReferrals,
      level2Referrals,
      recentEarnings,
      referralCode: user.referralCode
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get earnings report
router.get('/earnings', auth, async (req, res) => {
  try {
    const earnings = await Earning.find({ userId: req.user._id })
      .populate('fromUserId', 'name email')
      .populate('purchaseId', 'amount productName createdAt')
      .sort({ createdAt: -1 });

    const summary = {
      totalEarnings: earnings.reduce((sum, earning) => sum + earning.amount, 0),
      level1Total: earnings.filter(e => e.level === 1).reduce((sum, e) => sum + e.amount, 0),
      level2Total: earnings.filter(e => e.level === 2).reduce((sum, e) => sum + e.amount, 0),
      totalTransactions: earnings.length
    };

    res.json({
      summary,
      earnings
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;