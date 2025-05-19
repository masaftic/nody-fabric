import request from 'supertest';
import { Express } from 'express';
import { createTestServer } from '../helpers/test-server';
import { TestHelper } from '../helpers/test-helper';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import UserModel from '../../models/user.model';

// Mock Twilio service to avoid actual SMS sending during tests
jest.mock('../../service/twilio.service', () => ({
  twilioService: {
    createAndSendOTP: jest.fn().mockImplementation((phoneNumber) => {
      return Promise.resolve({
        success: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        message: 'OTP sent successfully'
      });
    }),
    resendOTP: jest.fn().mockImplementation((phoneNumber) => {
      return Promise.resolve({
        success: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        message: 'OTP resent successfully'
      });
    }),
    verifyOTP: jest.fn().mockImplementation((phoneNumber, otp) => {
      // Mock successful verification if OTP is "123456"
      if (otp === "123456") {
        return Promise.resolve({
          success: true,
          message: 'OTP verified successfully'
        });
      }
      return Promise.resolve({
        success: false,
        message: 'Invalid OTP'
      });
    })
  }
}));

describe('User Controller Integration Tests', () => {
  let app: Express;
  let testNationalId: string;
  let testPhone: string;
  let testUserId: string;

  // Setup test server
  beforeAll(async () => {
    app = createTestServer();
    
    // Generate unique test data
    testNationalId = `TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    testPhone = `+201${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
  }, 10000);

  // Clean up after all tests
  afterAll(async () => {
    if (testUserId) {
      await UserModel.deleteOne({ userId: testUserId });
    }
    // Delete any test users we might have created
    await UserModel.deleteMany({ nationalId: { $regex: /^TEST-/ } });
  });

  describe('userRegister', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const userData = {
        nationalId: testNationalId,
        phone: testPhone,
        governorate: 'Cairo'
      };
      
      // Act
      const response = await request(app)
        .post('/api/v1/users/register')
        .send(userData);
      
      // Assert
      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body).toHaveProperty('message', 'User registered successfully');
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('certificate');
      
      // Save user ID for later cleanup
      testUserId = response.body.userId;
      
      // Verify user exists in database
      const user = await UserModel.findOne({ userId: testUserId });
      expect(user).not.toBeNull();
      expect(user?.governorate).toBe('Cairo');
    }, 20000); // Increased timeout for Fabric CA operations
    
    it('should return BAD REQUEST if missing required fields', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/users/register')
        .send({ nationalId: 'TEST-123' }); // Missing phone and governorate
      
      // Assert
      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  // describe('sendSmsOtp', () => {
  //   it('should send OTP to a valid phone number', async () => {
  //     // Act
  //     const response = await request(app)
  //       .post('/api/v1/users/send-otp')
  //       .send({ phoneNumber: testPhone });
      
  //     // Assert
  //     expect(response.status).toBe(StatusCodes.OK);
  //     expect(response.body).toHaveProperty('message', 'OTP sent successfully');
  //   });
    
  //   it('should return BAD REQUEST for invalid phone number', async () => {
  //     // Act
  //     const response = await request(app)
  //       .post('/api/v1/users/send-otp')
  //       .send({ phoneNumber: 'invalid-phone' });
      
  //     // Assert
  //     expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  //   });
  // });

  // describe('resendSmsOtp', () => {
  //   it('should resend OTP to a valid phone number', async () => {
  //     // Act
  //     const response = await request(app)
  //       .post('/api/v1/users/resend-otp')
  //       .send({ phoneNumber: testPhone });
      
  //     // Assert
  //     expect(response.status).toBe(StatusCodes.OK);
  //     expect(response.body).toHaveProperty('message', 'OTP resent successfully');
  //   });
    
  //   it('should return BAD REQUEST for invalid phone number', async () => {
  //     // Act
  //     const response = await request(app)
  //       .post('/api/v1/users/resend-otp')
  //       .send({ phoneNumber: 'invalid-phone' });
      
  //     // Assert
  //     expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  //   });
  // });

  // describe('verifySmsOtp', () => {
  //   it('should verify a valid OTP', async () => {
  //     // Act
  //     const response = await request(app)
  //       .post('/api/v1/users/verify-otp')
  //       .send({ 
  //         phoneNumber: testPhone,
  //         otp: '123456' // This matches our mock verification
  //       });
      
  //     // Assert
  //     expect(response.status).toBe(StatusCodes.OK);
  //     expect(response.body).toHaveProperty('message', 'OTP verified successfully');
  //   });
    
  //   it('should reject an invalid OTP', async () => {
  //     // Act
  //     const response = await request(app)
  //       .post('/api/v1/users/verify-otp')
  //       .send({ 
  //         phoneNumber: testPhone,
  //         otp: '999999' // This will fail in our mock
  //       });
      
  //     // Assert
  //     expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  //   });
    
  //   it('should return BAD REQUEST if missing required fields', async () => {
  //     // Act
  //     const response = await request(app)
  //       .post('/api/v1/users/verify-otp')
  //       .send({ phoneNumber: testPhone }); // Missing OTP
      
  //     // Assert
  //     expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  //   });
  // });
});
