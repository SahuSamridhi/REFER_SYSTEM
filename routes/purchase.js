const express = require('express');
const User = require('../models/User');
const Purchase = require('../models/Purchase');
const Earning = require('../models/Earning');
const auth = require('../middleware/auth');

const router = express.Router();

// Create purchase and calculate earnings
router.post('/create', auth, async (req, res) => {
  try {
    const { amount, profit, productName } = req.body;

    // Validate minimum purchase amount
    if (amount < 1000) {
      return res.status(400).json({ message: 'Purchase amount must be above 1000Rs' });
    }

    // Create purchase
    const purchase = new Purchase({
      userId: req.user._id,
      amount,
      profit,
      productName
    });

    await purchase.save();

    // Calculate and distribute earnings
    const user = await User.findById(req.user._id).populate('referredBy');
    
    if (user.referredBy) {
      // Level 1 earning (5% to direct parent)
      const level1Earning = profit * 0.05;
      
      const earning1 = new Earning({
        userId: user.referredBy._id,
        fromUserId: req.user._id,
        purchaseId: purchase._id,
        amount: level1Earning,
        level: 1,
        percentage: 5
      });

      await earning1.save();

      // Update parent's earnings
      await User.findByIdAndUpdate(user.referredBy._id, {
        $inc: { 
          totalEarnings: level1Earning,
          level1Earnings: level1Earning
        }
      });

      // Send real-time notification to Level 1 parent
      req.io.to(user.referredBy._id.toString()).emit('new-earning', {
        amount: level1Earning,
        level: 1,
        from: user.name,
        product: productName,
        timestamp: new Date()
      });

      // Level 2 earning (1% to grandparent)
      const grandParent = await User.findById(user.referredBy.referredBy);
      if (grandParent) {
        const level2Earning = profit * 0.01;
        
        const earning2 = new Earning({
          userId: grandParent._id,
          fromUserId: req.user._id,
          purchaseId: purchase._id,
          amount: level2Earning,
          level: 2,
          percentage: 1
        });

        await earning2.save();

        // Update grandparent's earnings
        await User.findByIdAndUpdate(grandParent._id, {
          $inc: { 
            totalEarnings: level2Earning,
            level2Earnings: level2Earning
          }
        });

        // Send real-time notification to Level 2 parent
        req.io.to(grandParent._id.toString()).emit('new-earning', {
          amount: level2Earning,
          level: 2,
          from: user.name,
          product: productName,
          timestamp: new Date()
        });
      }
    }

    res.status(201).json({
      message: 'Purchase created and earnings distributed successfully',
      purchase
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's purchases
router.get('/my-purchases', auth, async (req, res) => {
  try {
    const purchases = await Purchase.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;