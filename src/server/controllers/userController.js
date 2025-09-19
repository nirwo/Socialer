import { prisma } from '../config/database.js';

export const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, bio, location, website, dateOfBirth, isPrivate } = req.validatedData.body;
    const userId = req.user.id;

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;
    if (website !== undefined) updateData.website = website;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = new Date(dateOfBirth);
    if (isPrivate !== undefined) updateData.isPrivate = isPrivate;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        avatar: true,
        coverPhoto: true,
        location: true,
        website: true,
        isVerified: true,
        isPrivate: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    res.json({
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Profile update failed',
      message: 'Internal server error'
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.validatedData.params;
    const currentUserId = req.user?.id;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        avatar: true,
        coverPhoto: true,
        location: true,
        website: true,
        isVerified: true,
        isPrivate: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user does not exist'
      });
    }

    // Check if current user is following this user
    let isFollowing = false;
    if (currentUserId && currentUserId !== user.id) {
      const followRelation = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: user.id
          }
        }
      });
      isFollowing = !!followRelation;
    }

    res.json({
      message: 'User retrieved successfully',
      data: {
        user: {
          ...user,
          isFollowing,
          isOwnProfile: currentUserId === user.id
        }
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to retrieve user',
      message: 'Internal server error'
    });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        error: 'Invalid search query',
        message: 'Search query must be at least 2 characters long'
      });
    }

    const offset = (page - 1) * limit;
    const searchTerm = q.trim();

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: searchTerm, mode: 'insensitive' } },
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } },
        ]
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true,
        isVerified: true,
        _count: {
          select: {
            followers: true,
          }
        }
      },
      orderBy: [
        { isVerified: 'desc' },
        { _count: { followers: 'desc' } },
        { createdAt: 'desc' }
      ],
      skip: offset,
      take: parseInt(limit, 10)
    });

    const totalUsers = await prisma.user.count({
      where: {
        OR: [
          { username: { contains: searchTerm, mode: 'insensitive' } },
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } },
        ]
      }
    });

    res.json({
      message: 'Users search completed',
      data: {
        users,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total: totalUsers,
          pages: Math.ceil(totalUsers / limit)
        }
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: 'Internal server error'
    });
  }
};

export const followUser = async (req, res) => {
  try {
    const { id: followingId } = req.validatedData.params;
    const followerId = req.user.id;

    if (followerId === followingId) {
      return res.status(400).json({
        error: 'Invalid action',
        message: 'You cannot follow yourself'
      });
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: followingId }
    });

    if (!targetUser) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The user you are trying to follow does not exist'
      });
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId
        }
      }
    });

    if (existingFollow) {
      return res.status(409).json({
        error: 'Already following',
        message: 'You are already following this user'
      });
    }

    // Create follow relationship
    await prisma.follow.create({
      data: {
        followerId,
        followingId
      }
    });

    // Create notification for the followed user
    await prisma.notification.create({
      data: {
        type: 'FOLLOW',
        message: `${req.user.firstName} ${req.user.lastName} started following you`,
        recipientId: followingId,
        triggererId: followerId,
      }
    });

    res.json({
      message: 'Successfully followed user',
      data: null
    });
  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({
      error: 'Failed to follow user',
      message: 'Internal server error'
    });
  }
};

export const unfollowUser = async (req, res) => {
  try {
    const { id: followingId } = req.validatedData.params;
    const followerId = req.user.id;

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId
        }
      }
    });

    if (!existingFollow) {
      return res.status(404).json({
        error: 'Not following',
        message: 'You are not following this user'
      });
    }

    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId
        }
      }
    });

    res.json({
      message: 'Successfully unfollowed user',
      data: null
    });
  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({
      error: 'Failed to unfollow user',
      message: 'Internal server error'
    });
  }
};

export const getFollowers = async (req, res) => {
  try {
    const { id: userId } = req.validatedData.params;
    const { page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
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
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit, 10)
    });

    const totalFollowers = await prisma.follow.count({
      where: { followingId: userId }
    });

    res.json({
      message: 'Followers retrieved successfully',
      data: {
        followers: followers.map(f => f.follower),
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total: totalFollowers,
          pages: Math.ceil(totalFollowers / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({
      error: 'Failed to retrieve followers',
      message: 'Internal server error'
    });
  }
};

export const getFollowing = async (req, res) => {
  try {
    const { id: userId } = req.validatedData.params;
    const { page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
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
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit, 10)
    });

    const totalFollowing = await prisma.follow.count({
      where: { followerId: userId }
    });

    res.json({
      message: 'Following retrieved successfully',
      data: {
        following: following.map(f => f.following),
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total: totalFollowing,
          pages: Math.ceil(totalFollowing / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({
      error: 'Failed to retrieve following',
      message: 'Internal server error'
    });
  }
};