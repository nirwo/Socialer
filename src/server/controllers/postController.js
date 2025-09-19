import { prisma } from '../config/database.js';

export const createPost = async (req, res) => {
  try {
    const { content, visibility = 'PUBLIC', location, tags = [] } = req.validatedData.body;
    const authorId = req.user.id;

    if (!content && (!req.files || req.files.length === 0)) {
      return res.status(400).json({
        error: 'Empty post',
        message: 'Post must contain either text content or media'
      });
    }

    const mediaUrls = req.files ? req.files.map(file => file.path) : [];
    const mediaTypes = req.files ? req.files.map(file => {
      if (file.mimetype.startsWith('image/')) return 'IMAGE';
      if (file.mimetype.startsWith('video/')) return 'VIDEO';
      if (file.mimetype.startsWith('audio/')) return 'AUDIO';
      return 'DOCUMENT';
    }) : [];

    const post = await prisma.post.create({
      data: {
        content,
        mediaUrls,
        mediaTypes,
        visibility,
        location,
        tags,
        authorId,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isVerified: true,
          }
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
          }
        }
      }
    });

    res.status(201).json({
      message: 'Post created successfully',
      data: { post }
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      error: 'Failed to create post',
      message: 'Internal server error'
    });
  }
};

export const getPostById = async (req, res) => {
  try {
    const { id } = req.validatedData.params;
    const currentUserId = req.user?.id;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isVerified: true,
          }
        },
        likes: currentUserId ? {
          where: { userId: currentUserId },
          select: { id: true }
        } : false,
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
          }
        }
      }
    });

    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        message: 'The requested post does not exist'
      });
    }

    // Check if user has access to view this post
    if (post.visibility === 'PRIVATE' && post.authorId !== currentUserId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to view this post'
      });
    }

    if (post.visibility === 'FRIENDS' && post.authorId !== currentUserId) {
      // Check if current user follows the author
      if (currentUserId) {
        const isFollowing = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: post.authorId
            }
          }
        });

        if (!isFollowing) {
          return res.status(403).json({
            error: 'Access denied',
            message: 'This post is only visible to friends'
          });
        }
      } else {
        return res.status(403).json({
          error: 'Access denied',
          message: 'This post is only visible to friends'
        });
      }
    }

    const postData = {
      ...post,
      isLiked: currentUserId ? post.likes.length > 0 : false,
      likes: undefined, // Remove the likes array from response
    };

    res.json({
      message: 'Post retrieved successfully',
      data: { post: postData }
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({
      error: 'Failed to retrieve post',
      message: 'Internal server error'
    });
  }
};

export const updatePost = async (req, res) => {
  try {
    const { id } = req.validatedData.params;
    const { content, visibility, location, tags } = req.validatedData.body;
    const userId = req.user.id;

    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: { id: true, authorId: true }
    });

    if (!existingPost) {
      return res.status(404).json({
        error: 'Post not found',
        message: 'The requested post does not exist'
      });
    }

    if (existingPost.authorId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only edit your own posts'
      });
    }

    const updateData = {};
    if (content !== undefined) updateData.content = content;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (location !== undefined) updateData.location = location;
    if (tags !== undefined) updateData.tags = tags;

    const post = await prisma.post.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isVerified: true,
          }
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
          }
        }
      }
    });

    res.json({
      message: 'Post updated successfully',
      data: { post }
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({
      error: 'Failed to update post',
      message: 'Internal server error'
    });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { id } = req.validatedData.params;
    const userId = req.user.id;

    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: { id: true, authorId: true }
    });

    if (!existingPost) {
      return res.status(404).json({
        error: 'Post not found',
        message: 'The requested post does not exist'
      });
    }

    if (existingPost.authorId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only delete your own posts'
      });
    }

    await prisma.post.delete({
      where: { id }
    });

    res.json({
      message: 'Post deleted successfully',
      data: null
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      error: 'Failed to delete post',
      message: 'Internal server error'
    });
  }
};

export const likePost = async (req, res) => {
  try {
    const { id: postId } = req.validatedData.params;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true }
    });

    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        message: 'The requested post does not exist'
      });
    }

    const existingLike = await prisma.like.findUnique({
      where: {
        userId_postId: {
          userId,
          postId
        }
      }
    });

    if (existingLike) {
      // Unlike the post
      await prisma.like.delete({
        where: {
          userId_postId: {
            userId,
            postId
          }
        }
      });

      res.json({
        message: 'Post unliked successfully',
        data: { isLiked: false }
      });
    } else {
      // Like the post
      await prisma.like.create({
        data: {
          userId,
          postId
        }
      });

      // Create notification if liking someone else's post
      if (post.authorId !== userId) {
        await prisma.notification.create({
          data: {
            type: 'LIKE',
            message: `${req.user.firstName} ${req.user.lastName} liked your post`,
            recipientId: post.authorId,
            triggererId: userId,
            relatedId: postId,
          }
        });
      }

      res.json({
        message: 'Post liked successfully',
        data: { isLiked: true }
      });
    }
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({
      error: 'Failed to like/unlike post',
      message: 'Internal server error'
    });
  }
};

export const getUserPosts = async (req, res) => {
  try {
    const { id: userId } = req.validatedData.params;
    const { page = 1, limit = 10 } = req.query;
    const currentUserId = req.user?.id;

    const offset = (page - 1) * limit;

    // Check if requesting user has access to view posts
    let visibilityFilter = { visibility: 'PUBLIC' };

    if (currentUserId === userId) {
      // User viewing their own posts - show all
      visibilityFilter = {};
    } else if (currentUserId) {
      // Check if current user follows the target user
      const isFollowing = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: userId
          }
        }
      });

      if (isFollowing) {
        visibilityFilter = {
          visibility: { in: ['PUBLIC', 'FRIENDS'] }
        };
      }
    }

    const posts = await prisma.post.findMany({
      where: {
        authorId: userId,
        ...visibilityFilter
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isVerified: true,
          }
        },
        likes: currentUserId ? {
          where: { userId: currentUserId },
          select: { id: true }
        } : false,
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit, 10)
    });

    const totalPosts = await prisma.post.count({
      where: {
        authorId: userId,
        ...visibilityFilter
      }
    });

    const postsData = posts.map(post => ({
      ...post,
      isLiked: currentUserId ? post.likes.length > 0 : false,
      likes: undefined, // Remove the likes array from response
    }));

    res.json({
      message: 'Posts retrieved successfully',
      data: {
        posts: postsData,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total: totalPosts,
          pages: Math.ceil(totalPosts / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({
      error: 'Failed to retrieve posts',
      message: 'Internal server error'
    });
  }
};

export const getFeed = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.id;
    const offset = (page - 1) * limit;

    // Get users that the current user is following
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true }
    });

    const followingIds = following.map(f => f.followingId);
    followingIds.push(userId); // Include user's own posts

    const posts = await prisma.post.findMany({
      where: {
        authorId: { in: followingIds },
        OR: [
          { visibility: 'PUBLIC' },
          {
            AND: [
              { visibility: 'FRIENDS' },
              { authorId: { in: followingIds } }
            ]
          },
          { authorId: userId } // User's own posts regardless of visibility
        ]
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isVerified: true,
          }
        },
        likes: {
          where: { userId },
          select: { id: true }
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit, 10)
    });

    const postsData = posts.map(post => ({
      ...post,
      isLiked: post.likes.length > 0,
      likes: undefined, // Remove the likes array from response
    }));

    res.json({
      message: 'Feed retrieved successfully',
      data: {
        posts: postsData,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          hasMore: posts.length === parseInt(limit, 10)
        }
      }
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({
      error: 'Failed to retrieve feed',
      message: 'Internal server error'
    });
  }
};