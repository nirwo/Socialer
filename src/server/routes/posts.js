import express from 'express';
import multer from 'multer';
import {
  createPost,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  getUserPosts,
  getFeed
} from '../controllers/postController.js';
import {
  createComment,
  getPostComments,
  getCommentReplies,
  updateComment,
  deleteComment
} from '../controllers/commentController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import { postLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and videos are allowed.'));
    }
  }
});

// Feed and post routes
router.get('/', authenticate, getFeed);
router.post('/', authenticate, postLimiter, upload.array('media', 4), validateRequest(schemas.createPost), createPost);
router.get('/user/:id', optionalAuth, validateRequest(schemas.getUserById), getUserPosts);
router.get('/:id', optionalAuth, validateRequest(schemas.getPostById), getPostById);
router.put('/:id', authenticate, validateRequest(schemas.createPost), updatePost);
router.delete('/:id', authenticate, validateRequest(schemas.getPostById), deletePost);

// Like/unlike routes
router.post('/:id/like', authenticate, validateRequest(schemas.getPostById), likePost);

// Comment routes
router.post('/:postId/comments', authenticate, validateRequest(schemas.createComment), createComment);
router.get('/:postId/comments', optionalAuth, validateRequest(schemas.getPostById), getPostComments);
router.get('/comments/:id/replies', optionalAuth, validateRequest(schemas.getPostById), getCommentReplies);
router.put('/comments/:id', authenticate, validateRequest(schemas.createComment), updateComment);
router.delete('/comments/:id', authenticate, validateRequest(schemas.getPostById), deleteComment);

export default router;