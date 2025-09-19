import express from 'express';
import {
  updateProfile,
  getUserById,
  searchUsers,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing
} from '../controllers/userController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validateRequest, schemas } from '../middleware/validation.js';

const router = express.Router();

// Search users (public)
router.get('/search', optionalAuth, searchUsers);

// User profile routes
router.put('/me', authenticate, validateRequest(schemas.updateProfile), updateProfile);
router.get('/:id', optionalAuth, validateRequest(schemas.getUserById), getUserById);

// Follow/unfollow routes
router.post('/:id/follow', authenticate, validateRequest(schemas.getUserById), followUser);
router.delete('/:id/follow', authenticate, validateRequest(schemas.getUserById), unfollowUser);

// Followers/following routes
router.get('/:id/followers', optionalAuth, validateRequest(schemas.getUserById), getFollowers);
router.get('/:id/following', optionalAuth, validateRequest(schemas.getUserById), getFollowing);

export default router;