import request from "supertest";
import app from "../../src/server/index.js";
import { prisma } from "../setup.js";

describe("Auth Endpoints", () => {
  test("POST /api/auth/register should create a new user", async () => {
    const userData = {
      email: "test@example.com",
      password: "TestPass123",
      username: "testuser",
      firstName: "Test",
      lastName: "User"
    };

    const response = await request(app)
      .post("/api/auth/register")
      .send(userData)
      .expect(201);

    expect(response.body.message).toBe("User registered successfully");
    expect(response.body.data.user.email).toBe(userData.email);
    expect(response.body.data.token).toBeTruthy();
  });

  test("POST /api/auth/login should authenticate user", async () => {
    // First create a user
    await request(app)
      .post("/api/auth/register")
      .send({
        email: "login@example.com",
        password: "TestPass123",
        username: "loginuser",
        firstName: "Login",
        lastName: "User"
      });

    // Then login
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "login@example.com",
        password: "TestPass123"
      })
      .expect(200);

    expect(response.body.message).toBe("Login successful");
    expect(response.body.data.token).toBeTruthy();
  });
});
