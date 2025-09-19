import { z } from 'zod';

export const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const result = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      req.validatedData = result;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid request data',
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      console.error('Validation error:', error);
      return res.status(500).json({
        error: 'Validation error',
        message: 'Internal server error',
      });
    }
  };
};

// Common validation schemas
export const schemas = {
  register: z.object({
    body: z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be at most 30 characters'),
      firstName: z.string().min(1, 'First name is required').max(50, 'First name must be at most 50 characters'),
      lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be at most 50 characters'),
    }),
  }),

  login: z.object({
    body: z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(1, 'Password is required'),
    }),
  }),

  createPost: z.object({
    body: z.object({
      content: z.string().min(1, 'Post content is required').max(5000, 'Post content must be at most 5000 characters').optional(),
      visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).default('PUBLIC'),
      location: z.string().max(100, 'Location must be at most 100 characters').optional(),
      tags: z.array(z.string().max(50, 'Tag must be at most 50 characters')).max(10, 'Maximum 10 tags allowed').optional(),
    }),
  }),

  updateProfile: z.object({
    body: z.object({
      firstName: z.string().min(1, 'First name is required').max(50, 'First name must be at most 50 characters').optional(),
      lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be at most 50 characters').optional(),
      bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
      location: z.string().max(100, 'Location must be at most 100 characters').optional(),
      website: z.string().url('Invalid website URL').optional(),
      dateOfBirth: z.string().datetime('Invalid date format').optional(),
      isPrivate: z.boolean().optional(),
    }),
  }),

  createComment: z.object({
    body: z.object({
      content: z.string().min(1, 'Comment content is required').max(1000, 'Comment must be at most 1000 characters'),
      parentId: z.string().cuid('Invalid parent comment ID').optional(),
    }),
    params: z.object({
      postId: z.string().cuid('Invalid post ID'),
    }),
  }),

  sendMessage: z.object({
    body: z.object({
      content: z.string().min(1, 'Message content is required').max(1000, 'Message must be at most 1000 characters'),
      receiverId: z.string().cuid('Invalid receiver ID'),
    }),
  }),

  getUserById: z.object({
    params: z.object({
      id: z.string().cuid('Invalid user ID'),
    }),
  }),

  getPostById: z.object({
    params: z.object({
      id: z.string().cuid('Invalid post ID'),
    }),
  }),

  pagination: z.object({
    query: z.object({
      page: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).optional().default(1),
      limit: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional().default(10),
    }),
  }),
};