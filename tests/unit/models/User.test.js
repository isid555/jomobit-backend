const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../../src/models/User');

describe('User Model', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        auth0Id: 'auth0|123456',
        email: 'test@example.com',
        status: 'active',
        emailVerified: true,
        metadata: {
          name: 'Test User',
          picture: 'https://example.com/avatar.jpg'
        },
        roles: ['user'],
        permissions: ['read:posts']
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.auth0Id).toBe(userData.auth0Id);
      expect(savedUser.email).toBe(userData.email);
      expect(savedUser.status).toBe(userData.status);
      expect(savedUser.emailVerified).toBe(userData.emailVerified);
      expect(savedUser.roles).toEqual(userData.roles);
      expect(savedUser.permissions).toEqual(userData.permissions);
    });

    it('should require auth0Id field', async () => {
      const userData = {
        email: 'test@example.com'
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow('auth0Id');
    });

    it('should require email field', async () => {
      const userData = {
        auth0Id: 'auth0|123456'
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow('email');
    });

    it('should enforce unique auth0Id', async () => {
      const userData1 = {
        auth0Id: 'auth0|123456',
        email: 'test1@example.com'
      };
      const userData2 = {
        auth0Id: 'auth0|123456',
        email: 'test2@example.com'
      };

      await new User(userData1).save();
      
      await expect(new User(userData2).save()).rejects.toThrow();
    });

    it('should enforce unique email', async () => {
      const userData1 = {
        auth0Id: 'auth0|123456',
        email: 'test@example.com'
      };
      const userData2 = {
        auth0Id: 'auth0|789012',
        email: 'test@example.com'
      };

      await new User(userData1).save();
      
      await expect(new User(userData2).save()).rejects.toThrow();
    });

    it('should convert email to lowercase', async () => {
      const userData = {
        auth0Id: 'auth0|123456',
        email: 'TEST@EXAMPLE.COM'
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.email).toBe('test@example.com');
    });

    it('should set default status to pending', async () => {
      const userData = {
        auth0Id: 'auth0|123456',
        email: 'test@example.com'
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.status).toBe('pending');
    });

    it('should validate status enum values', async () => {
      const userData = {
        auth0Id: 'auth0|123456',
        email: 'test@example.com',
        status: 'invalid_status'
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow();
    });

    it('should validate roles enum values', async () => {
      const userData = {
        auth0Id: 'auth0|123456',
        email: 'test@example.com',
        roles: ['invalid_role']
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow();
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test users
      await User.create([
        {
          auth0Id: 'auth0|123456',
          email: 'user1@example.com',
          status: 'active',
          roles: ['user']
        },
        {
          auth0Id: 'auth0|789012',
          email: 'user2@example.com',
          status: 'pending',
          roles: ['user']
        },
        {
          auth0Id: 'auth0|345678',
          email: 'admin@example.com',
          status: 'active',
          roles: ['admin']
        }
      ]);
    });

    describe('findByAuth0Id', () => {
      it('should find user by Auth0 ID', async () => {
        const user = await User.findByAuth0Id('auth0|123456');
        
        expect(user).toBeTruthy();
        expect(user.email).toBe('user1@example.com');
      });

      it('should return null for non-existent Auth0 ID', async () => {
        const user = await User.findByAuth0Id('auth0|nonexistent');
        
        expect(user).toBeNull();
      });
    });

    describe('findByEmail', () => {
      it('should find user by email', async () => {
        const user = await User.findByEmail('user1@example.com');
        
        expect(user).toBeTruthy();
        expect(user.auth0Id).toBe('auth0|123456');
      });

      it('should find user by email case-insensitively', async () => {
        const user = await User.findByEmail('USER1@EXAMPLE.COM');
        
        expect(user).toBeTruthy();
        expect(user.auth0Id).toBe('auth0|123456');
      });

      it('should return null for non-existent email', async () => {
        const user = await User.findByEmail('nonexistent@example.com');
        
        expect(user).toBeNull();
      });
    });

    describe('createOrUpdateFromAuth0', () => {
      it('should create new user from Auth0 data', async () => {
        const auth0User = {
          user_id: 'auth0|newuser',
          email: 'newuser@example.com',
          email_verified: true,
          name: 'New User',
          picture: 'https://example.com/avatar.jpg',
          'https://jomobit.com/roles': ['user'],
          permissions: ['read:posts']
        };

        const user = await User.createOrUpdateFromAuth0(auth0User);

        expect(user.auth0Id).toBe('auth0|newuser');
        expect(user.email).toBe('newuser@example.com');
        expect(user.emailVerified).toBe(true);
        expect(user.status).toBe('active');
        expect(user.metadata.name).toBe('New User');
        expect(user.roles).toEqual(['user']);
        expect(user.permissions).toEqual(['read:posts']);
      });

      it('should update existing user from Auth0 data', async () => {
        const auth0User = {
          user_id: 'auth0|123456',
          email: 'user1@example.com',
          email_verified: true,
          name: 'Updated User',
          picture: 'https://example.com/new-avatar.jpg',
          'https://jomobit.com/roles': ['user', 'moderator'],
          permissions: ['read:posts', 'write:posts']
        };

        const user = await User.createOrUpdateFromAuth0(auth0User);

        expect(user.auth0Id).toBe('auth0|123456');
        expect(user.metadata.name).toBe('Updated User');
        expect(user.roles).toEqual(['user', 'moderator']);
        expect(user.permissions).toEqual(['read:posts', 'write:posts']);
      });

      it('should set status to pending for unverified email', async () => {
        const auth0User = {
          user_id: 'auth0|unverified',
          email: 'unverified@example.com',
          email_verified: false,
          name: 'Unverified User'
        };

        const user = await User.createOrUpdateFromAuth0(auth0User);

        expect(user.status).toBe('pending');
        expect(user.emailVerified).toBe(false);
      });

      it('should handle missing optional fields', async () => {
        const auth0User = {
          user_id: 'auth0|minimal',
          email: 'minimal@example.com'
        };

        const user = await User.createOrUpdateFromAuth0(auth0User);

        expect(user.auth0Id).toBe('auth0|minimal');
        expect(user.email).toBe('minimal@example.com');
        expect(user.roles).toEqual(['user']);
        expect(user.permissions).toEqual([]);
      });
    });

    describe('getActiveUsersCount', () => {
      it('should return count of active users', async () => {
        const count = await User.getActiveUsersCount();
        
        expect(count).toBe(2); // user1 and admin are active
      });
    });

    describe('getUsersByStatus', () => {
      it('should return users by status', async () => {
        const activeUsers = await User.getUsersByStatus('active');
        
        expect(activeUsers).toHaveLength(2);
        expect(activeUsers.every(user => user.status === 'active')).toBe(true);
      });

      it('should support pagination options', async () => {
        const users = await User.getUsersByStatus('active', { limit: 1 });
        
        expect(users).toHaveLength(1);
      });

      it('should support sorting options', async () => {
        const users = await User.getUsersByStatus('active', { 
          sort: { email: 1 } 
        });
        
        expect(users[0].email).toBe('admin@example.com');
        expect(users[1].email).toBe('user1@example.com');
      });
    });
  });

  describe('Instance Methods', () => {
    let user;

    beforeEach(async () => {
      user = await User.create({
        auth0Id: 'auth0|123456',
        email: 'test@example.com',
        status: 'active',
        roles: ['user', 'moderator'],
        permissions: ['read:posts', 'write:posts']
      });
    });

    describe('hasRole', () => {
      it('should return true for existing role', () => {
        expect(user.hasRole('user')).toBe(true);
        expect(user.hasRole('moderator')).toBe(true);
      });

      it('should return false for non-existing role', () => {
        expect(user.hasRole('admin')).toBe(false);
      });
    });

    describe('hasPermission', () => {
      it('should return true for existing permission', () => {
        expect(user.hasPermission('read:posts')).toBe(true);
        expect(user.hasPermission('write:posts')).toBe(true);
      });

      it('should return false for non-existing permission', () => {
        expect(user.hasPermission('delete:posts')).toBe(false);
      });
    });

    describe('isAdmin', () => {
      it('should return false for non-admin user', () => {
        expect(user.isAdmin()).toBe(false);
      });

      it('should return true for admin user', async () => {
        user.roles.push('admin');
        await user.save();
        
        expect(user.isAdmin()).toBe(true);
      });
    });

    describe('updateLastLogin', () => {
      it('should update lastLoginAt timestamp', async () => {
        const originalLastLogin = user.lastLoginAt;
        
        await user.updateLastLogin();
        
        expect(user.lastLoginAt).not.toBe(originalLastLogin);
        expect(user.lastLoginAt).toBeInstanceOf(Date);
      });
    });

    describe('suspend', () => {
      it('should set status to suspended', async () => {
        await user.suspend();
        
        expect(user.status).toBe('suspended');
      });
    });

    describe('activate', () => {
      it('should set status to active', async () => {
        user.status = 'suspended';
        await user.save();
        
        await user.activate();
        
        expect(user.status).toBe('active');
      });
    });
  });

  describe('Middleware', () => {
    it('should update updatedAt timestamp on save', async () => {
      const user = await User.create({
        auth0Id: 'auth0|123456',
        email: 'test@example.com'
      });

      const originalUpdatedAt = user.updatedAt;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      user.metadata.name = 'Updated Name';
      await user.save();
      
      expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('JSON Transformation', () => {
    it('should remove __v field from JSON output', async () => {
      const user = await User.create({
        auth0Id: 'auth0|123456',
        email: 'test@example.com'
      });

      const userJson = user.toJSON();
      
      expect(userJson.__v).toBeUndefined();
      expect(userJson.auth0Id).toBe('auth0|123456');
    });
  });
});