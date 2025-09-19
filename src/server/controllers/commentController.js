import { prisma } from '../config/database.js';

export const createComment = async (req, res) => {
  try {
    const { postId } = req.validatedData.params;
    const { content, parentId } = req.validatedData.body;
    const userId = req.user.id;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, visibility: true }
    });

    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        message: 'The post you are trying to comment on does not exist'
      });
    }

    // Check access to post
    if (post.visibility === 'PRIVATE' && post.authorId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You cannot comment on this private post'
      });
    }

    if (post.visibility === 'FRIENDS' && post.authorId !== userId) {
      const isFollowing = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: post.authorId
          }
        }
      });

      if (!isFollowing) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You cannot comment on this post'
        });
      }
    }

    // If replying to a comment, check if parent comment exists
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, postId: true }
      });

      if (!parentComment || parentComment.postId !== postId) {
        return res.status(404).json({
          error: 'Parent comment not found',
          message: 'The comment you are replying to does not exist'
        });
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        userId,
        postId,
        parentId,
      },
      include: {
        user: {
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
            replies: true,
          }
        }
      }
    });

    // Create notification for post author
    if (post.authorId !== userId) {
      await prisma.notification.create({
        data: {
          type: 'COMMENT',
          message: `${req.user.firstName} ${req.user.lastName} commented on your post`,
          recipientId: post.authorId,
          triggererId: userId,
          relatedId: postId,
        }
      });
    }

    res.status(201).json({
      message: 'Comment created successfully',
      data: { comment }
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({
      error: 'Failed to create comment',
      message: 'Internal server error'
    });
  }
};

export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.validatedData.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Check if post exists and user has access
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, visibility: true }
    });

    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        message: 'The requested post does not exist'
      });
    }

    const comments = await prisma.comment.findMany({
      where: {
        postId,
        parentId: null, // Only get top-level comments
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isVerified: true,
          }
        },
        replies: {
          take: 3, // Get first 3 replies
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
                isVerified: true,
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: {
            replies: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit, 10)
    });

    const totalComments = await prisma.comment.count({
      where: {
        postId,
        parentId: null,
      }
    });

    res.json({
      message: 'Comments retrieved successfully',
      data: {
        comments,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total: totalComments,
          pages: Math.ceil(totalComments / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      error: 'Failed to retrieve comments',
      message: 'Internal server error'
    });
  }
};

export const getCommentReplies = async (req, res) => {
  try {
    const { id: commentId } = req.validatedData.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const replies = await prisma.comment.findMany({
      where: { parentId: commentId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isVerified: true,
          }
        }
      },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: parseInt(limit, 10)
    });

    const totalReplies = await prisma.comment.count({
      where: { parentId: commentId }
    });

    res.json({
      message: 'Replies retrieved successfully',
      data: {
        replies,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total: totalReplies,
          pages: Math.ceil(totalReplies / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({
      error: 'Failed to retrieve replies',
      message: 'Internal server error'
    });
  }
};

export const updateComment = async (req, res) => {
  try {
    const { id } = req.validatedData.params;
    const { content } = req.validatedData.body;
    const userId = req.user.id;

    const existingComment = await prisma.comment.findUnique({
      where: { id },
      select: { id: true, userId: true }
    });

    if (!existingComment) {
      return res.status(404).json({
        error: 'Comment not found',
        message: 'The requested comment does not exist'
      });
    }

    if (existingComment.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only edit your own comments'
      });
    }

    const comment = await prisma.comment.update({
      where: { id },
      data: { content },
      include: {
        user: {
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
            replies: true,
          }
        }
      }
    });

    res.json({
      message: 'Comment updated successfully',
      data: { comment }
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({
      error: 'Failed to update comment',
      message: 'Internal server error'
    });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const { id } = req.validatedData.params;
    const userId = req.user.id;

    const existingComment = await prisma.comment.findUnique({
      where: { id },
      select: { id: true, userId: true }
    });

    if (!existingComment) {
      return res.status(404).json({
        error: 'Comment not found',
        message: 'The requested comment does not exist'
      });
    }

    if (existingComment.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only delete your own comments'
      });
    }

    await prisma.comment.delete({
      where: { id }
    });

    res.json({
      message: 'Comment deleted successfully',
      data: null
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      error: 'Failed to delete comment',
      message: 'Internal server error'
    });
  }
};