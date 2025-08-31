const Payment = require('../models/Payment');
const Registration = require('../models/Registration');

describe('Payment Model', () => {
  test('should create payment with required fields', () => {
    const paymentData = {
      registration: '507f1f77bcf86cd799439011',
      tournament: '507f1f77bcf86cd799439012',
      amount: 50,
      paymentReference: 'TOURN-20241201-ABC12'
    };

    const payment = new Payment(paymentData);
    
    expect(payment.registration.toString()).toBe('507f1f77bcf86cd799439011');
    expect(payment.tournament.toString()).toBe('507f1f77bcf86cd799439012');
    expect(payment.amount).toBe(50);
    expect(payment.paymentReference).toBe('TOURN-20241201-ABC12');
    expect(payment.verificationStatus).toBe('Pending');
  });

  test('should validate required fields', () => {
    const payment = new Payment({});
    const validationError = payment.validateSync();
    
    expect(validationError.errors.registration).toBeDefined();
    expect(validationError.errors.tournament).toBeDefined();
    expect(validationError.errors.amount).toBeDefined();
    expect(validationError.errors.paymentReference).toBeDefined();
  });

  test('should validate amount is not negative', () => {
    const payment = new Payment({
      registration: '507f1f77bcf86cd799439011',
      tournament: '507f1f77bcf86cd799439012',
      amount: -10,
      paymentReference: 'TOURN-20241201-ABC12'
    });
    
    const validationError = payment.validateSync();
    expect(validationError.errors.amount).toBeDefined();
  });

  test('should validate verification status enum', () => {
    const payment = new Payment({
      registration: '507f1f77bcf86cd799439011',
      tournament: '507f1f77bcf86cd799439012',
      amount: 50,
      paymentReference: 'TOURN-20241201-ABC12',
      verificationStatus: 'InvalidStatus'
    });
    
    const validationError = payment.validateSync();
    expect(validationError.errors.verificationStatus).toBeDefined();
  });

  test('should accept valid verification statuses', () => {
    const validStatuses = ['Pending', 'Verified', 'Rejected'];
    
    validStatuses.forEach(status => {
      const payment = new Payment({
        registration: '507f1f77bcf86cd799439011',
        tournament: '507f1f77bcf86cd799439012',
        amount: 50,
        paymentReference: 'TOURN-20241201-ABC12',
        verificationStatus: status
      });
      
      const validationError = payment.validateSync();
      expect(validationError).toBeUndefined();
    });
  });
});