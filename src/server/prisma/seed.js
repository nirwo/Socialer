import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create demo users
  const users = [
    {
      email: 'john.doe@example.com',
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      bio: 'Software developer passionate about technology and innovation',
      location: 'San Francisco, CA',
      website: 'https://johndoe.dev',
      isVerified: true,
    },
    {
      email: 'jane.smith@example.com',
      username: 'janesmith',
      firstName: 'Jane',
      lastName: 'Smith',
      bio: 'Designer, photographer, and coffee enthusiast ☕',
      location: 'New York, NY',
      isVerified: true,
    },
    {
      email: 'mike.wilson@example.com',
      username: 'mikewilson',
      firstName: 'Mike',
      lastName: 'Wilson',
      bio: 'Entrepreneur building the future',
      location: 'Austin, TX',
    },
    {
      email: 'sarah.davis@example.com',
      username: 'sarahdavis',
      firstName: 'Sarah',
      lastName: 'Davis',
      bio: 'Marketing specialist and travel lover 🌍',
      location: 'Los Angeles, CA',
    },
    {
      email: 'alex.johnson@example.com',
      username: 'alexjohnson',
      firstName: 'Alex',
      lastName: 'Johnson',
      bio: 'Full-stack developer and open source contributor',
      location: 'Seattle, WA',
    }
  ];

  // Create users
  const createdUsers = [];
  for (const userData of users) {
    const hashedPassword = await bcrypt.hash('password123', 12);

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        passwordHash: hashedPassword,
      },
    });

    createdUsers.push(user);
    console.log(`✅ Created user: ${user.username}`);
  }

  // Create follow relationships
  const followRelationships = [
    [0, 1], // John follows Jane
    [0, 2], // John follows Mike
    [1, 0], // Jane follows John
    [1, 3], // Jane follows Sarah
    [2, 0], // Mike follows John
    [2, 4], // Mike follows Alex
    [3, 1], // Sarah follows Jane
    [3, 4], // Sarah follows Alex
    [4, 2], // Alex follows Mike
    [4, 3], // Alex follows Sarah
  ];

  for (const [followerIndex, followingIndex] of followRelationships) {
    await prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: createdUsers[followerIndex].id,
          followingId: createdUsers[followingIndex].id,
        }
      },
      update: {},
      create: {
        followerId: createdUsers[followerIndex].id,
        followingId: createdUsers[followingIndex].id,
      },
    });
  }
  console.log('✅ Created follow relationships');

  // Create sample posts
  const posts = [
    {
      content: 'Just shipped a new feature! Really excited about what we\'re building. 🚀',
      authorIndex: 0,
      tags: ['development', 'excited'],
      visibility: 'PUBLIC',
    },
    {
      content: 'Beautiful sunset in Central Park today. Sometimes you need to stop and appreciate the little things.',
      authorIndex: 1,
      tags: ['photography', 'nature'],
      visibility: 'PUBLIC',
    },
    {
      content: 'Working on something big. Can\'t share details yet, but stay tuned! 👀',
      authorIndex: 2,
      tags: ['startup', 'entrepreneur'],
      visibility: 'FRIENDS',
    },
    {
      content: 'Just finished an amazing marketing campaign. The results are incredible! 📈',
      authorIndex: 3,
      tags: ['marketing', 'success'],
      visibility: 'PUBLIC',
    },
    {
      content: 'Open source contribution of the day: fixed a critical bug in a popular React library. Feels good to give back to the community! 💻',
      authorIndex: 4,
      tags: ['opensource', 'react', 'community'],
      visibility: 'PUBLIC',
    },
    {
      content: 'Coffee and code - the perfect combination for a productive morning ☕️',
      authorIndex: 0,
      tags: ['coffee', 'productivity'],
      visibility: 'PUBLIC',
    },
    {
      content: 'New blog post is live! Writing about the intersection of design and technology.',
      authorIndex: 1,
      tags: ['blog', 'design', 'technology'],
      visibility: 'PUBLIC',
    },
  ];

  const createdPosts = [];
  for (const postData of posts) {
    const post = await prisma.post.create({
      data: {
        content: postData.content,
        authorId: createdUsers[postData.authorIndex].id,
        tags: postData.tags,
        visibility: postData.visibility,
        mediaUrls: [],
        mediaTypes: [],
      },
    });

    createdPosts.push(post);
    console.log(`✅ Created post by ${createdUsers[postData.authorIndex].username}`);
  }

  // Create sample likes
  const likes = [
    [1, 0], // Jane likes John's first post
    [2, 0], // Mike likes John's first post
    [0, 1], // John likes Jane's post
    [3, 1], // Sarah likes Jane's post
    [4, 1], // Alex likes Jane's post
    [1, 4], // Jane likes Alex's post
    [3, 4], // Sarah likes Alex's post
    [0, 3], // John likes Sarah's post
  ];

  for (const [userIndex, postIndex] of likes) {
    await prisma.like.create({
      data: {
        userId: createdUsers[userIndex].id,
        postId: createdPosts[postIndex].id,
      },
    });
  }
  console.log('✅ Created likes');

  // Create sample comments
  const comments = [
    {
      content: 'Congratulations on the launch! 🎉',
      userIndex: 1,
      postIndex: 0,
    },
    {
      content: 'This looks amazing! Can\'t wait to try it out.',
      userIndex: 2,
      postIndex: 0,
    },
    {
      content: 'Gorgeous photo! Central Park is one of my favorite places.',
      userIndex: 0,
      postIndex: 1,
    },
    {
      content: 'Great shot! What camera did you use?',
      userIndex: 4,
      postIndex: 1,
    },
    {
      content: 'Thanks for contributing to the community! Open source is amazing.',
      userIndex: 1,
      postIndex: 4,
    },
  ];

  for (const commentData of comments) {
    await prisma.comment.create({
      data: {
        content: commentData.content,
        userId: createdUsers[commentData.userIndex].id,
        postId: createdPosts[commentData.postIndex].id,
      },
    });
  }
  console.log('✅ Created comments');

  // Create sample messages
  const messages = [
    {
      content: 'Hey! Love your latest post about the new feature.',
      senderIndex: 1,
      receiverIndex: 0,
    },
    {
      content: 'Thanks! It was a lot of work but totally worth it.',
      senderIndex: 0,
      receiverIndex: 1,
    },
    {
      content: 'Would love to collaborate on something together.',
      senderIndex: 2,
      receiverIndex: 0,
    },
    {
      content: 'That sounds interesting! Let\'s chat more about it.',
      senderIndex: 0,
      receiverIndex: 2,
    },
  ];

  for (const messageData of messages) {
    await prisma.message.create({
      data: {
        content: messageData.content,
        senderId: createdUsers[messageData.senderIndex].id,
        receiverId: createdUsers[messageData.receiverIndex].id,
      },
    });
  }
  console.log('✅ Created messages');

  console.log('🎉 Database seeded successfully!');
  console.log('\n📊 Summary:');
  console.log(`• ${createdUsers.length} users created`);
  console.log(`• ${followRelationships.length} follow relationships created`);
  console.log(`• ${createdPosts.length} posts created`);
  console.log(`• ${likes.length} likes created`);
  console.log(`• ${comments.length} comments created`);
  console.log(`• ${messages.length} messages created`);
  console.log('\n🔐 Demo credentials:');
  console.log('Email: john.doe@example.com | Password: password123');
  console.log('Email: jane.smith@example.com | Password: password123');
  console.log('All demo users use password: password123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });